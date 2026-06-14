# Spec — Bloquear datas (v2, item 3)

## Contexto

O admin precisa marcar datas como indisponíveis (feriado, manutenção, evento da
Loja) sem que isso seja uma reserva. Hoje só existem dois sinais no calendário:
reserva confirmada e pedidos pendentes (view `date_availability`, agregada sobre
`reservations`). Não há como o admin "fechar" uma data por outro motivo.

Resultado esperado: admin bloqueia/desbloqueia datas pelo painel; o calendário do
membro mostra a data como indisponível **com o motivo**; tentar reservar uma data
bloqueada é rejeitado no banco.

### Decisões fechadas (brainstorming 2026-06-14)
- **Granularidade:** uma data por vez (sem range).
- **Motivo:** visível pro membro no calendário.
- **Conflito:** se a data já tem reserva **confirmada**, o bloqueio é **impedido**
  (admin cancela a reserva antes).

## Arquitetura

Bloqueio é um **sinal separado** das reservas — tabela própria `blocked_dates`,
consultada à parte. A view `date_availability` **não muda** (continua só sobre
reservas). O calendário cruza os dois sinais no cliente.

### 1. Banco — `supabase/migrations/0003_blocked_dates.sql` (novo)

```sql
create table if not exists public.blocked_dates (
  data       date primary key,           -- PK garante 1 bloqueio por data
  motivo     text not null,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public.blocked_dates enable row level security;

-- Todos os autenticados leem (calendário mostra a data + motivo).
grant select on public.blocked_dates to authenticated;
-- Insert/delete liberados na tabela, mas a RLS restringe a admin.
grant insert, delete on public.blocked_dates to authenticated;

drop policy if exists blocked_select on public.blocked_dates;
create policy blocked_select on public.blocked_dates
  for select using (true);

drop policy if exists blocked_admin_insert on public.blocked_dates;
create policy blocked_admin_insert on public.blocked_dates
  for insert with check (public.is_admin());

drop policy if exists blocked_admin_delete on public.blocked_dates;
create policy blocked_admin_delete on public.blocked_dates
  for delete using (public.is_admin());
```

- **Guard de conflito** (impede bloquear data com reserva confirmada), trigger
  `BEFORE INSERT` em `blocked_dates`:

```sql
create or replace function public.guard_block_date()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.reservations
    where data = new.data and status = 'confirmada'
  ) then
    raise exception 'Data tem reserva confirmada.';
  end if;
  new.created_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists before_block_insert on public.blocked_dates;
create trigger before_block_insert
  before insert on public.blocked_dates
  for each row execute function public.guard_block_date();
```

- **Rejeitar reserva em data bloqueada:** recriar `validate_reservation_insert()`
  (base `0001_init.sql:104`) adicionando, junto das checagens existentes:

```sql
  if exists (select 1 from public.blocked_dates where data = new.data) then
    raise exception 'Data bloqueada.';
  end if;
```

- Encerrar com `notify pgrst, 'reload schema';`.

### 2. Tipos + API

- `src/types.ts`: `export interface BlockedDate { data: string; motivo: string }`.
- `src/api/blockedDates.ts` (novo):
  - `fetchBlockedDates(fromISO, toISO): Promise<BlockedDate[]>` — select `data, motivo`
    com `gte/lte` em `data` (mesmo padrão de `availability.ts`).
  - `blockDate(data: string, motivo: string)` — insert; propaga erro (trigger pode
    rejeitar por conflito).
  - `unblockDate(data: string)` — delete `eq('data', data)`.

### 3. Calendário do membro — `src/pages/CalendarPage.tsx`

- Nova query `['blocked', rangeFrom, rangeTo]` → `fetchBlockedDates`.
- `blockedDates` (array de `Date`) e helper `blockedOn(date): BlockedDate | undefined`.
- `disabled` do `DayPicker` passa a incluir `isBlocked(date)`.
- Novo modifier `bloqueada` + `modifiersClassNames` (tratamento visual via
  **frontend-design** na implementação — cinza/hachura discreta, distinta de
  "confirmada" granada). Item novo na `Legend`.
- `ReservationPanel`: quando a data está bloqueada, renderiza `Alert tone="info"`
  com o `motivo` (ex.: "Data indisponível: feriado") — antes dos outros ramos.

### 4. Admin — `src/pages/admin/AdminDashboardPage.tsx`

Nova seção "Datas bloqueadas" (mesmo padrão de `<section>` + `PageHeader as="h2"`
das outras, separada por `<Rule />`):
- Form: `Input type="date"` (mín. hoje) + `Input` motivo + `Button` "Bloquear".
  Usa mutation `blockDate`; em erro mostra `Alert` ("Data tem reserva confirmada"
  vs genérico). Invalida queries `['blocked']` e `['availability']`.
- Lista das datas bloqueadas (a partir de hoje em diante) com `data` formatada +
  `motivo` + `Button variant="outline"` "Desbloquear" (mutation `unblockDate`).
- Layout/refino visual da seção via **frontend-design** na implementação.

## Tratamento de erro
- `blockDate` rejeitado pelo trigger (data confirmada) → `Alert` no form admin.
- Insert/delete por não-admin → bloqueado pela RLS (não exposto na UI, mas defesa
  em profundidade).
- Membro tentando reservar data bloqueada (corrida: bloqueada após carregar o
  calendário) → trigger `validate_reservation_insert` rejeita; o `Alert tone="error"`
  já existente no `ReservationPanel` cobre.

## Verificação
1. Aplicar `0003` no SQL Editor; conferir tabela + policies + triggers.
2. `npm run build` limpo.
3. `npm run dev`:
   - Como admin: bloquear uma data livre → some do calendário do membro (disabled +
     motivo no painel). Desbloquear → volta a reservável.
   - Tentar bloquear data com reserva confirmada → erro "Data tem reserva confirmada".
   - Como membro: tocar data bloqueada → vê motivo; não consegue solicitar.
   - Tentar reservar data bloqueada via corrida (bloquear depois de abrir o calendário,
     então solicitar) → rejeitado com erro.
4. Conferir que RLS barra insert/delete de membro comum (via console/API).
