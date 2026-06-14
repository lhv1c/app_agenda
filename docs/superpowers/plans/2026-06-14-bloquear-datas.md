# Bloquear Datas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin marca datas como indisponíveis (com motivo); o calendário do membro mostra a data bloqueada e o motivo, e o banco rejeita reservas nessas datas.

**Architecture:** Tabela própria `blocked_dates` (sinal separado das reservas; a view `date_availability` não muda). O calendário cruza os dois sinais no cliente; o banco protege via triggers (rejeita reserva em data bloqueada; impede bloquear data já confirmada).

**Tech Stack:** React + TypeScript + Vite, react-day-picker, @tanstack/react-query, Supabase (Postgres + RLS). **Sem framework de teste** — verificação por `npm run build` (tsc + vite) + checagem manual no `npm run dev`.

**Spec:** `docs/superpowers/specs/2026-06-14-bloquear-datas-design.md`

---

## File Structure

- **Create** `supabase/migrations/0003_blocked_dates.sql` — tabela, RLS, triggers.
- **Modify** `src/types.ts` — tipo `BlockedDate`.
- **Create** `src/api/blockedDates.ts` — fetch/block/unblock.
- **Modify** `src/pages/CalendarPage.tsx` — query + disabled + modifier + legenda + painel.
- **Modify** `src/pages/admin/AdminDashboardPage.tsx` — seção "Datas bloqueadas".

Deploy do banco é **manual via Dashboard SQL Editor** (sem Supabase CLI local). A Task 1 entrega o SQL; quem executa aplica no painel.

---

## Task 1: Migration — tabela, RLS e triggers

**Files:**
- Create: `supabase/migrations/0003_blocked_dates.sql`

- [ ] **Step 1: Escrever a migration**

Conteúdo completo do arquivo:

```sql
-- ============================================================================
-- Agenda do Salão — v2 item 3: bloquear datas
-- Admin marca datas indisponíveis (feriado/manutenção). Reserva em data
-- bloqueada é rejeitada; não se bloqueia data com reserva já confirmada.
-- ============================================================================

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

-- Impede bloquear data que já tem reserva confirmada; carimba created_by.
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

-- Rejeita reserva em data bloqueada (recria a validação existente + check novo).
create or replace function public.validate_reservation_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.status := 'pendente';
  new.decided_at := null;
  new.decided_by := null;

  if new.data < (current_date + 4) or new.data > (current_date + 60) then
    raise exception 'Data fora do período permitido (mínimo 4 dias, máximo 60).';
  end if;

  if exists (select 1 from public.blocked_dates where data = new.data) then
    raise exception 'Data bloqueada.';
  end if;

  if exists (
    select 1 from public.reservations
    where data = new.data and status = 'confirmada'
  ) then
    raise exception 'Data já confirmada.';
  end if;

  if exists (
    select 1 from public.reservations
    where data = new.data
      and user_id = new.user_id
      and status in ('pendente', 'confirmada')
  ) then
    raise exception 'Você já tem uma reserva ativa nesta data.';
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
```

> Nota: `validate_reservation_insert` é recriada por inteiro a partir de
> `supabase/migrations/0001_init.sql:104-142`, só somando o check de data bloqueada.
> Confira que o corpo bate com o `0001` (janela, confirmada, reserva ativa) antes de aplicar.

- [ ] **Step 2: Aplicar no Supabase**

Dashboard → SQL Editor → New query → colar o conteúdo acima → **Run**.
Esperado: `Success. No rows returned`.

- [ ] **Step 3: Conferir no banco**

Rodar no SQL Editor:
```sql
select * from public.blocked_dates;                 -- tabela existe, vazia
select tgname from pg_trigger where tgrelid = 'public.blocked_dates'::regclass;
-- esperado: before_block_insert
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0003_blocked_dates.sql
git commit -m "feat(db): tabela blocked_dates + triggers de bloqueio"
```

---

## Task 2: Tipo + API de datas bloqueadas

**Files:**
- Modify: `src/types.ts`
- Create: `src/api/blockedDates.ts`

- [ ] **Step 1: Adicionar o tipo em `src/types.ts`**

Após a interface `DateAvailability` (fim do arquivo), adicionar:

```ts
/** Data bloqueada pelo admin (indisponível para reserva). */
export interface BlockedDate {
  data: string // yyyy-MM-dd
  motivo: string
}
```

- [ ] **Step 2: Criar `src/api/blockedDates.ts`**

```ts
import { supabase } from '../lib/supabase'
import type { BlockedDate } from '../types'

/** Datas bloqueadas entre dois ISO dates (inclusive). */
export async function fetchBlockedDates(
  fromISO: string,
  toISO: string,
): Promise<BlockedDate[]> {
  const { data, error } = await supabase
    .from('blocked_dates')
    .select('data, motivo')
    .gte('data', fromISO)
    .lte('data', toISO)
    .order('data', { ascending: true })
  if (error) throw error
  return (data ?? []) as BlockedDate[]
}

/** Admin: bloqueia uma data. Trigger rejeita se houver reserva confirmada. */
export async function blockDate(data: string, motivo: string): Promise<void> {
  const { error } = await supabase
    .from('blocked_dates')
    .insert({ data, motivo })
  if (error) throw error
}

/** Admin: remove o bloqueio de uma data. */
export async function unblockDate(data: string): Promise<void> {
  const { error } = await supabase.from('blocked_dates').delete().eq('data', data)
  if (error) throw error
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npm run build`
Esperado: build passa (tsc sem erro).

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/api/blockedDates.ts
git commit -m "feat(api): tipo e funções de datas bloqueadas"
```

---

## Task 3: Calendário do membro reflete o bloqueio

**Files:**
- Modify: `src/pages/CalendarPage.tsx`

- [ ] **Step 1: Importar a API**

No bloco de imports, após `import { fetchAvailability } from '../api/availability'`:

```ts
import { fetchBlockedDates } from '../api/blockedDates'
```

E no import de tipos, somar `BlockedDate`:

```ts
import type { BlockedDate, DateAvailability, Reservation } from '../types'
```

- [ ] **Step 2: Query + derivados das datas bloqueadas**

Após o `availabilityQuery` (logo após as linhas que definem `myReservationsQuery`),
adicionar a query:

```ts
  const blockedQuery = useQuery({
    queryKey: ['blocked', rangeFrom, rangeTo],
    queryFn: () => fetchBlockedDates(rangeFrom, rangeTo),
  })
```

Após `const myReservations = myReservationsQuery.data ?? []`:

```ts
  const blocked = blockedQuery.data ?? []
```

Após o `useMemo` de `myActiveDates`, adicionar:

```ts
  const blockedDates = useMemo(
    () => blocked.map((b) => fromISODate(b.data)),
    [blocked],
  )
```

E os helpers (junto dos outros `isConfirmed`/`availabilityOn`):

```ts
  function isBlocked(date: Date) {
    return blockedDates.some((d) => isSameDay(d, date))
  }
  function blockedOn(date: Date): BlockedDate | undefined {
    return blocked.find((b) => isSameDay(fromISODate(b.data), date))
  }
```

- [ ] **Step 3: Incluir bloqueio no loading e no `disabled` do DayPicker**

Trocar a linha do `loading`:

```ts
  const loading =
    availabilityQuery.isLoading ||
    myReservationsQuery.isLoading ||
    blockedQuery.isLoading
```

Trocar o `disabled` do `<DayPicker>`:

```tsx
            disabled={(date) =>
              !isBookable(date) || isConfirmed(date) || isBlocked(date)
            }
```

- [ ] **Step 4: Modifier + legenda (visual provisório; refino na Task 5)**

No `modifiers` do `<DayPicker>`, somar:

```tsx
              bloqueada: blockedDates,
```

No `modifiersClassNames`, somar (estilo provisório — ajustado na Task 5):

```tsx
              bloqueada:
                'bg-linha text-tinta-mid/60 rounded-full line-through',
```

No componente `Legend`, somar ao array `items`:

```ts
    { className: 'bg-linha', label: 'Bloqueada' },
```

- [ ] **Step 5: Painel mostra o motivo**

No `CalendarPage`, passar a prop pro painel — trocar a renderização do
`<ReservationPanel ... />` adicionando:

```tsx
          blocked={blockedOn(selected)}
```

Na assinatura de `ReservationPanel`, somar a prop:

```ts
  blocked,
```
e no tipo das props:
```ts
  blocked?: BlockedDate
```

No corpo do `ReservationPanel`, como **primeiro ramo** do bloco condicional
(antes de `isConfirmed ? ...`):

```tsx
      {blocked ? (
        <Alert tone="info">Data indisponível: {blocked.motivo}</Alert>
      ) : isConfirmed ? (
```

- [ ] **Step 6: Verificar build**

Run: `npm run build`
Esperado: passa, sem erro de tipo.

- [ ] **Step 7: Checagem manual**

`npm run dev`. Sem dados bloqueados ainda → calendário inalterado (a verificação
real do bloqueio acontece na Task 4 quando der pra criar bloqueio pela UI). Conferir
que nada quebrou e a legenda mostra "Bloqueada".

- [ ] **Step 8: Commit**

```bash
git add src/pages/CalendarPage.tsx
git commit -m "feat(calendario): datas bloqueadas desabilitadas + motivo no painel"
```

---

## Task 4: Seção admin para bloquear/desbloquear

**Files:**
- Modify: `src/pages/admin/AdminDashboardPage.tsx`

- [ ] **Step 1: Imports**

No topo, somar:

```ts
import { useState } from 'react'
import { blockDate, fetchBlockedDates, unblockDate } from '../../api/blockedDates'
```
(se `useMemo` já vem de `react`, juntar `useState` no mesmo import).

Garantir que `Alert`, `Field`, `Input` venham de `'../../components/ui'` (somar os
que faltarem ao import existente de ui).

- [ ] **Step 2: Estado + queries/mutations no componente**

Dentro de `AdminDashboardPage`, junto das outras queries:

```ts
  const [novaData, setNovaData] = useState('')
  const [motivo, setMotivo] = useState('')
  const [blockError, setBlockError] = useState<string | null>(null)

  const hojeISO = new Date().toISOString().slice(0, 10)

  const blockedQuery = useQuery({
    queryKey: ['blocked-admin'],
    queryFn: () => fetchBlockedDates(hojeISO, '2100-01-01'),
  })
  const blocked = blockedQuery.data ?? []

  const blockMutation = useMutation({
    mutationFn: () => blockDate(novaData, motivo.trim()),
    onSuccess: () => {
      setNovaData('')
      setMotivo('')
      setBlockError(null)
      queryClient.invalidateQueries({ queryKey: ['blocked-admin'] })
      queryClient.invalidateQueries({ queryKey: ['blocked'] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : ''
      setBlockError(
        msg.includes('confirmada')
          ? 'Essa data já tem uma reserva confirmada.'
          : 'Não foi possível bloquear a data.',
      )
    },
  })

  const unblockMutation = useMutation({
    mutationFn: (data: string) => unblockDate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-admin'] })
      queryClient.invalidateQueries({ queryKey: ['blocked'] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
  })
```

- [ ] **Step 3: Seção JSX (visual provisório; refino na Task 5)**

Antes do fechamento do container da página (após a seção de confirmadas, separada
por `<Rule />`), adicionar:

```tsx
      <Rule />

      <section className="space-y-5">
        <PageHeader
          as="h2"
          eyebrow="Calendário"
          title="Datas bloqueadas"
        />

        <Card className="space-y-4">
          {blockError && <Alert tone="error">{blockError}</Alert>}
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (!novaData || !motivo.trim()) return
              blockMutation.mutate()
            }}
          >
            <Field label="Data">
              <Input
                type="date"
                min={hojeISO}
                value={novaData}
                onChange={(e) => setNovaData(e.target.value)}
                required
              />
            </Field>
            <Field label="Motivo">
              <Input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Feriado, manutenção, evento da Loja…"
                required
              />
            </Field>
            <Button
              type="submit"
              loading={blockMutation.isPending}
              className="w-full"
            >
              Bloquear data
            </Button>
          </form>
        </Card>

        {blockedQuery.isLoading ? (
          <div className="flex justify-center py-6 text-granada">
            <Spinner className="size-6" />
          </div>
        ) : blocked.length === 0 ? (
          <EmptyState>Nenhuma data bloqueada.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {blocked.map((b) => (
              <Card key={b.data} className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <span className="font-display text-lg capitalize text-granada">
                    {formatLong(fromISODate(b.data))}
                  </span>
                  <p className="font-body text-sm text-tinta-mid">{b.motivo}</p>
                </div>
                <Button
                  variant="outline"
                  className="shrink-0"
                  loading={
                    unblockMutation.isPending &&
                    unblockMutation.variables === b.data
                  }
                  onClick={() => unblockMutation.mutate(b.data)}
                >
                  Desbloquear
                </Button>
              </Card>
            ))}
          </ul>
        )}
      </section>
```

> `formatLong`, `fromISODate`, `Card`, `EmptyState`, `Spinner`, `Button`, `PageHeader`,
> `Rule` já são importados no arquivo. Confirmar que `Alert`, `Field`, `Input` também
> estão (Step 1).

- [ ] **Step 4: Verificar build**

Run: `npm run build`
Esperado: passa.

- [ ] **Step 5: Checagem manual end-to-end**

`npm run dev`, logado como admin (`cienciaejustica@gmail.com`):
1. Bloquear uma data livre futura → aparece na lista.
2. Abrir o calendário (como membro/outra aba) → data desabilitada; tocando, painel
   mostra "Data indisponível: <motivo>".
3. Desbloquear → some da lista; data volta a reservável.
4. Tentar bloquear uma data que tenha reserva confirmada → `Alert` "Essa data já tem
   uma reserva confirmada."

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/AdminDashboardPage.tsx
git commit -m "feat(admin): bloquear e desbloquear datas"
```

---

## Task 5: Refino visual (frontend-design)

**Files:**
- Modify: `src/pages/CalendarPage.tsx` (modifier `bloqueada` + legenda)
- Modify: `src/pages/admin/AdminDashboardPage.tsx` (seção "Datas bloqueadas")

- [ ] **Step 1: Invocar a skill frontend-design**

Use a skill `frontend-design` pra definir o tratamento visual da data bloqueada
(distinto de "confirmada" granada — algo neutro/hachurado que leia como
"indisponível", não como "evento") e o polimento da seção admin, mantendo a
identidade Prancha (ver memória `design-system-prancha`).

- [ ] **Step 2: Aplicar o estilo no modifier e na legenda**

Substituir o `bloqueada` provisório em `modifiersClassNames` e o item de legenda
pelo resultado do frontend-design.

- [ ] **Step 3: Verificar build + screenshot**

Run: `npm run build` (passa). Conferir visualmente no `npm run dev` (calendário com
data bloqueada + seção admin).

- [ ] **Step 4: Commit**

```bash
git add src/pages/CalendarPage.tsx src/pages/admin/AdminDashboardPage.tsx
git commit -m "style(bloqueio): tratamento visual da data bloqueada e seção admin"
```

---

## Verificação final
1. Migration `0003` aplicada; tabela + policies + triggers conferidos no SQL Editor.
2. `npm run build` limpo.
3. Fluxo e2e (Task 4 Step 5) OK: bloquear → calendário reflete + motivo; desbloquear →
   volta; conflito com confirmada → erro.
4. RLS: membro comum não consegue insert/delete em `blocked_dates` (testar via console).
5. Atualizar memória de status (item 3 do v2 feito) e o backlog `docs/v2-backlog.md`.
