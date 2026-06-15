# Cota anual, taxa e relatório de receita — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar a ordem/taxa de cada reserva confirmada (1ª/2ª = 20% do salário mínimo, 3ª+ = 40%, por ano civil do irmão) e entregar um relatório de receita por ano ao admin, além de mostrar a ordem ao membro.

**Architecture:** Tabela `salario_minimo(ano, valor)` editável pelo admin + view `revenue_entries` (`security_invoker`) que deriva ordinal/rate por irmão/ano via `row_number()`. Frontend lê a view (admin vê tudo, membro vê só o próprio via RLS), calcula o valor da taxa no cliente e renderiza num relatório por ano e num selo na tela do membro.

**Tech Stack:** Postgres/Supabase (RLS, view), React + TypeScript, TanStack Query, react-router, Tailwind (Prancha).

Spec: `docs/superpowers/specs/2026-06-15-receita-cota-anual-design.md`

---

## Notas de contexto (ler antes de começar)

- **Sem suíte de testes automatizados** no repo. Verificação por tarefa = `npx tsc -b` + `npm run build` + conferência manual. É a disciplina equivalente aqui.
- **Migration não roda via CLI** (sem service role key local; login Supabase CLI falha non-TTY). O passo de banco é: criar o arquivo `.sql` versionado **e o usuário aplica no SQL Editor do painel**. O plano marca isso explícito; não tente `supabase db push`.
- Commits via **Bash tool** (não usar here-string `@'...'@` do PowerShell). Sem co-author Claude. Rodar de `C:/Users/luizh/Documents/01_Projetos/01_AGENDA_APP`.
- Padrões do projeto já confirmados: RLS com `grant ... to authenticated` + policy `is_admin()` (ver `0003_blocked_dates.sql`); API em `src/api/*.ts` com `supabase.from(...)`; rotas em `App.tsx`; componentes Prancha em `src/components/ui.tsx` (`Select` já existe).
- `revenue_entries` usa `security_invoker = on` — **obrigatório**; sem isso a view vaza reservas/nome de todos pra qualquer membro.
- Toda migration termina com `notify pgrst, 'reload schema';`.

---

## File Structure

- **Create** `supabase/migrations/0004_receita.sql` — `salario_minimo` + view `revenue_entries` + RLS + grants.
- **Create** `src/lib/money.ts` — `formatBRL`.
- **Modify** `src/types.ts` — interface `RevenueEntry`.
- **Create** `src/api/revenue.ts` — leitura do relatório/anos/ordinais + CRUD do salário mínimo.
- **Create** `src/components/AdminLayout.tsx` — layout das páginas admin com mini-nav (Secretaria · Receita) + `<Outlet/>`.
- **Modify** `src/App.tsx` — envolver rotas admin no `AdminLayout`, adicionar `/admin/receita`.
- **Create** `src/pages/admin/RevenueReportPage.tsx` — relatório por ano + edição do SM.
- **Modify** `src/pages/MyReservationsPage.tsx` — selo de ordem na confirmada.

---

## Task 1: Migration — `salario_minimo` + view `revenue_entries`

**Files:**
- Create: `supabase/migrations/0004_receita.sql`

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- ============================================================================
-- Agenda do Salão — v2: cota anual, taxa por reserva e receita
-- Cada irmão tem 2 reservas/ano a 20% do salário mínimo; da 3ª em diante, 40%.
-- Ano civil pela data do evento, só reservas confirmadas. Tabela do salário
-- mínimo por ano (admin edita) + view que deriva ordem/taxa por irmão/ano.
-- ============================================================================

-- Salário mínimo por ano (base do cálculo da taxa) -------------------------
create table if not exists public.salario_minimo (
  ano        int primary key,
  valor      numeric(10,2) not null check (valor > 0),
  updated_at timestamptz not null default now()
);

alter table public.salario_minimo enable row level security;

-- Leitura liberada a autenticados (a view depende disso sob security_invoker;
-- valor do SM não é sensível). Escrita só admin.
grant select, insert, update on public.salario_minimo to authenticated;

drop policy if exists sm_select on public.salario_minimo;
create policy sm_select on public.salario_minimo
  for select using (true);

drop policy if exists sm_admin_insert on public.salario_minimo;
create policy sm_admin_insert on public.salario_minimo
  for insert with check (public.is_admin());

drop policy if exists sm_admin_update on public.salario_minimo;
create policy sm_admin_update on public.salario_minimo
  for update using (public.is_admin()) with check (public.is_admin());

-- View de receita: 1 linha por confirmada, com ordem no ano civil do irmão,
-- a taxa (20%/40%) e o salário mínimo do ano. security_invoker => herda a RLS
-- de reservations (admin vê tudo; membro vê só as próprias).
create or replace view public.revenue_entries with (security_invoker = on) as
  with confirmadas as (
    select
      r.id,
      r.user_id,
      r.data,
      extract(year from r.data)::int as ano,
      row_number() over (
        partition by r.user_id, extract(year from r.data)
        order by r.data, r.created_at
      )::int as ordinal
    from public.reservations r
    where r.status = 'confirmada'
  )
  select
    c.id,
    c.user_id,
    p.nome,
    c.data,
    c.ano,
    c.ordinal,
    (case when c.ordinal <= 2 then 0.20 else 0.40 end)::numeric as rate,
    sm.valor as sm
  from confirmadas c
  join public.profiles p on p.id = c.user_id
  left join public.salario_minimo sm on sm.ano = c.ano;

grant select on public.revenue_entries to authenticated;

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Aplicar no banco (usuário)**

Pedir ao usuário para colar o conteúdo de `0004_receita.sql` no **SQL Editor do Supabase** e rodar. Confirmar que terminou sem erro e que o `notify pgrst, 'reload schema';` rodou. **Não prosseguir pras tarefas que leem a view sem isso.**

Verificação rápida no SQL Editor:
```sql
select * from public.revenue_entries limit 5;
insert into public.salario_minimo (ano, valor) values (2026, 1518.00)
  on conflict (ano) do update set valor = excluded.valor;
```
Esperado: a 1ª query retorna confirmadas (ou vazio) sem erro de permissão; a 2ª insere/atualiza o SM de 2026.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0004_receita.sql
git commit -m "feat(db): salario_minimo + view revenue_entries (cota/taxa anual)"
```

---

## Task 2: `formatBRL`

**Files:**
- Create: `src/lib/money.ts`

- [ ] **Step 1: Criar o arquivo**

```ts
const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

/** Formata número em Real brasileiro (ex.: 1234.5 -> "R$ 1.234,50"). */
export function formatBRL(value: number): string {
  return brl.format(value)
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: exit 0 (export ainda não usado não acusa erro).

- [ ] **Step 3: Commit**

```bash
git add src/lib/money.ts
git commit -m "feat(lib): formatBRL"
```

---

## Task 3: Tipo `RevenueEntry` + API `revenue.ts`

**Files:**
- Modify: `src/types.ts`
- Create: `src/api/revenue.ts`

- [ ] **Step 1: Adicionar o tipo no fim de `src/types.ts`**

```ts
/** Linha do relatório de receita (view revenue_entries). Uma por confirmada. */
export interface RevenueEntry {
  id: string
  user_id: string
  nome: string
  data: string // yyyy-MM-dd
  ano: number
  ordinal: number
  rate: number // 0.20 (1ª/2ª) | 0.40 (extra)
  sm: number | null // salário mínimo do ano, ou null se não cadastrado
}
```

- [ ] **Step 2: Criar `src/api/revenue.ts`**

```ts
import { supabase } from '../lib/supabase'
import type { RevenueEntry } from '../types'

/** Anos distintos com reserva confirmada (pra preencher o seletor). */
export async function fetchRevenueYears(): Promise<number[]> {
  const { data, error } = await supabase
    .from('revenue_entries')
    .select('ano')
  if (error) throw error
  const anos = new Set<number>((data ?? []).map((r) => (r as { ano: number }).ano))
  anos.add(new Date().getFullYear())
  return [...anos].sort((a, b) => b - a) // mais recente primeiro
}

/** Linhas de receita de um ano (admin vê todas; RLS governa). */
export async function fetchRevenueEntries(ano: number): Promise<RevenueEntry[]> {
  const { data, error } = await supabase
    .from('revenue_entries')
    .select('*')
    .eq('ano', ano)
    .order('data', { ascending: true })
  if (error) throw error
  return (data ?? []) as RevenueEntry[]
}

/** Mapa id -> ordinal das confirmadas do próprio membro (selo na tela dele). */
export async function fetchMyRevenueOrdinals(
  userId: string,
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('revenue_entries')
    .select('id, ordinal')
    .eq('user_id', userId)
  if (error) throw error
  const map: Record<string, number> = {}
  for (const r of data ?? []) {
    const row = r as { id: string; ordinal: number }
    map[row.id] = row.ordinal
  }
  return map
}

/** Salário mínimo cadastrado de um ano, ou null. */
export async function fetchSalarioMinimo(ano: number): Promise<number | null> {
  const { data, error } = await supabase
    .from('salario_minimo')
    .select('valor')
    .eq('ano', ano)
    .maybeSingle()
  if (error) throw error
  return data ? (data as { valor: number }).valor : null
}

/** Admin: cria/atualiza o salário mínimo de um ano. */
export async function upsertSalarioMinimo(
  ano: number,
  valor: number,
): Promise<void> {
  const { error } = await supabase
    .from('salario_minimo')
    .upsert(
      { ano, valor, updated_at: new Date().toISOString() },
      { onConflict: 'ano' },
    )
  if (error) throw error
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/api/revenue.ts
git commit -m "feat(api): revenue_entries + salario_minimo (tipos e queries)"
```

---

## Task 4: `AdminLayout` (mini-nav) + rota `/admin/receita`

**Files:**
- Create: `src/components/AdminLayout.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Criar `src/components/AdminLayout.tsx`**

Mini-nav com 2 abas no padrão Prancha (sublinhado ouro no ativo), acima do `<Outlet/>`:

```tsx
import { NavLink, Outlet } from 'react-router-dom'

const tabClass =
  'relative px-1 py-2 font-mono text-xs uppercase tracking-[0.12em] transition-colors'

function AdminTab({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `${tabClass} ${isActive ? 'text-granada' : 'text-tinta-mid hover:text-granada'}`
      }
    >
      {({ isActive }) => (
        <>
          {label}
          {isActive && (
            <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-ouro" />
          )}
        </>
      )}
    </NavLink>
  )
}

/** Casca das páginas de admin: abas Secretaria / Receita + conteúdo. */
export function AdminLayout() {
  return (
    <div className="space-y-6">
      <nav className="flex gap-6 border-b border-linha">
        <AdminTab to="/admin" label="Secretaria" end />
        <AdminTab to="/admin/receita" label="Receita" />
      </nav>
      <Outlet />
    </div>
  )
}
```

- [ ] **Step 2: Religar as rotas de admin em `src/App.tsx`**

Adicionar os imports (junto aos demais, após a linha do `AdminDashboardPage`):

```tsx
import { AdminLayout } from './components/AdminLayout'
import { RevenueReportPage } from './pages/admin/RevenueReportPage'
```

Substituir o bloco:

```tsx
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
          </Route>
```

por:

```tsx
          <Route element={<AdminRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/receita" element={<RevenueReportPage />} />
            </Route>
          </Route>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: **falha esperada** — `RevenueReportPage` ainda não existe ("Cannot find module './pages/admin/RevenueReportPage'"). Será criado na Task 5. Não commitar ainda; seguir pra Task 5 e commitar as duas juntas.

> Nota de execução: Tasks 4 e 5 são acopladas (o import). Implementar 5 antes de rodar o typecheck final e commitar. O commit fica no fim da Task 5.

---

## Task 5: `RevenueReportPage`

**Files:**
- Create: `src/pages/admin/RevenueReportPage.tsx`

- [ ] **Step 1: Criar a página**

```tsx
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchRevenueEntries,
  fetchRevenueYears,
  fetchSalarioMinimo,
  upsertSalarioMinimo,
} from '../../api/revenue'
import { formatShort, fromISODate } from '../../lib/dates'
import { formatBRL } from '../../lib/money'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
} from '../../components/ui'
import type { RevenueEntry } from '../../types'

/** Valor da taxa de uma linha: null quando o SM do ano não está cadastrado. */
function valorTaxa(e: RevenueEntry): number | null {
  if (e.sm == null) return null
  return Math.round(e.rate * e.sm * 100) / 100
}

/** Rótulo da ordem: 1ª, 2ª, ou "Nª (extra)" da 3ª em diante. */
function ordemLabel(ordinal: number): string {
  return ordinal <= 2 ? `${ordinal}ª` : `${ordinal}ª (extra)`
}

export function RevenueReportPage() {
  const queryClient = useQueryClient()
  const anoAtual = new Date().getFullYear()
  const [ano, setAno] = useState(anoAtual)

  const yearsQuery = useQuery({
    queryKey: ['revenue-years'],
    queryFn: fetchRevenueYears,
  })
  const entriesQuery = useQuery({
    queryKey: ['revenue-entries', ano],
    queryFn: () => fetchRevenueEntries(ano),
  })
  const smQuery = useQuery({
    queryKey: ['salario-minimo', ano],
    queryFn: () => fetchSalarioMinimo(ano),
  })

  const anos = yearsQuery.data ?? [anoAtual]
  const entries = entriesQuery.data ?? []

  // Total do ano (só as linhas com SM cadastrado) + quantas ficaram sem valor.
  const { total, semValor } = useMemo(() => {
    let total = 0
    let semValor = 0
    for (const e of entries) {
      const v = valorTaxa(e)
      if (v == null) semValor += 1
      else total += v
    }
    return { total, semValor }
  }, [entries])

  return (
    <section className="space-y-6">
      <PageHeader
        as="h2"
        eyebrow="Tesouraria"
        title="Relatório de receita"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Ano">
          <Select value={String(ano)} onChange={(e) => setAno(Number(e.target.value))}>
            {anos.map((a) => (
              <option key={a} value={String(a)}>
                {a}
              </option>
            ))}
          </Select>
        </Field>
        <SalarioMinimoEditor
          ano={ano}
          valor={smQuery.data ?? null}
          loading={smQuery.isLoading}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['salario-minimo', ano] })
            queryClient.invalidateQueries({ queryKey: ['revenue-entries', ano] })
          }}
        />
      </div>

      {entriesQuery.isLoading ? (
        <div className="flex justify-center py-10 text-granada">
          <Spinner className="size-7" />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState>Nenhuma reserva confirmada em {ano}.</EmptyState>
      ) : (
        <>
          <ul className="space-y-3">
            {entries.map((e) => {
              const v = valorTaxa(e)
              const extra = e.ordinal > 2
              return (
                <Card key={e.id} className="flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-lg text-granada">{e.nome}</p>
                    <p className="eyebrow text-[9px]!">
                      {formatShort(fromISODate(e.data))}
                    </p>
                    <span
                      className={`mt-1 inline-block rounded-[4px] border px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.1em] ${
                        extra
                          ? 'border-ouro/60 bg-ouro/10 text-ouro'
                          : 'border-linha bg-pergaminho text-tinta-mid'
                      }`}
                    >
                      {ordemLabel(e.ordinal)} · {Math.round(e.rate * 100)}%
                    </span>
                  </div>
                  <div className="shrink-0 text-right font-display text-lg text-tinta">
                    {v == null ? (
                      <span className="text-tinta-mid">—</span>
                    ) : (
                      formatBRL(v)
                    )}
                  </div>
                </Card>
              )
            })}
          </ul>

          <div className="flex items-baseline justify-between border-t border-ouro/30 pt-4">
            <span className="eyebrow">Total {ano}</span>
            <span className="font-display text-2xl text-granada">
              {formatBRL(total)}
            </span>
          </div>
          {semValor > 0 && (
            <Alert tone="info">
              {semValor} reserva(s) sem valor — defina o salário mínimo de {ano}.
            </Alert>
          )}
        </>
      )}
    </section>
  )
}

/** Mostra/edita o salário mínimo do ano selecionado. */
function SalarioMinimoEditor({
  ano,
  valor,
  loading,
  onSaved,
}: {
  ano: number
  valor: number | null
  loading: boolean
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')

  const mutation = useMutation({
    mutationFn: (v: number) => upsertSalarioMinimo(ano, v),
    onSuccess: () => {
      setEditing(false)
      onSaved()
    },
  })

  function start() {
    setRaw(valor != null ? String(valor) : '')
    setEditing(true)
  }

  function save() {
    const v = Number(raw.replace(',', '.'))
    if (!Number.isFinite(v) || v <= 0) return
    mutation.mutate(v)
  }

  if (loading) {
    return (
      <Field label={`Salário mínimo ${ano}`}>
        <div className="flex h-11 items-center text-tinta-mid">
          <Spinner className="size-4" />
        </div>
      </Field>
    )
  }

  if (editing) {
    return (
      <Field label={`Salário mínimo ${ano}`}>
        <div className="flex gap-2">
          <Input
            type="text"
            inputMode="decimal"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="1518,00"
            autoFocus
          />
          <Button onClick={save} loading={mutation.isPending} className="shrink-0">
            Salvar
          </Button>
        </div>
      </Field>
    )
  }

  return (
    <Field label={`Salário mínimo ${ano}`}>
      <div className="flex items-center gap-3">
        <span className="font-display text-lg text-tinta">
          {valor != null ? formatBRL(valor) : 'Não definido'}
        </span>
        <Button variant="ghost" onClick={start} className="shrink-0">
          {valor != null ? 'Editar' : 'Definir'}
        </Button>
      </div>
    </Field>
  )
}
```

- [ ] **Step 2: Typecheck + build (cobre Tasks 4 e 5)**

Run: `npx tsc -b`
Expected: exit 0.

Run: `npm run build`
Expected: build conclui (warning de chunk >500KB esperado, não bloqueia).

- [ ] **Step 3: Conferência manual (admin)**

`npm run dev`, logado como admin → tab Admin → aba **Receita**:
- Seletor de ano funciona; default = ano atual.
- "Salário mínimo {ano}": define/edita; valor aparece formatado em R$.
- Lista: cada confirmada com nome, data, selo de ordem (1ª/2ª/extra) + %, e valor; 3ª confirmada do mesmo irmão no ano = "extra" a 40%.
- Total bate com a soma; ano sem SM mostra "—" nas linhas + Alert e total parcial.
- Trocar de ano recalcula tudo. Ano sem confirmada → EmptyState.

- [ ] **Step 4: Commit (Tasks 4 + 5)**

```bash
git add src/components/AdminLayout.tsx src/App.tsx src/pages/admin/RevenueReportPage.tsx
git commit -m "feat(admin): relatório de receita por ano + mini-nav admin"
```

---

## Task 6: Selo de ordem na tela do membro

**Files:**
- Modify: `src/pages/MyReservationsPage.tsx`

- [ ] **Step 1: Buscar os ordinais do próprio membro**

No topo de `src/pages/MyReservationsPage.tsx`, ampliar imports:

```tsx
import { cancelReservation, fetchMyReservations } from '../api/reservations'
import { fetchMyRevenueOrdinals } from '../api/revenue'
```

Dentro de `MyReservationsPage`, após o `useQuery` de `my-reservations`, adicionar:

```tsx
  const { data: ordinais } = useQuery({
    queryKey: ['my-revenue-ordinals', userId],
    queryFn: () => fetchMyRevenueOrdinals(userId),
  })
```

E passar o ordinal pro item, na renderização da lista (dentro do `.map`):

```tsx
            <ReservationItem
              key={r.id}
              reservation={r}
              ordinal={ordinais?.[r.id]}
              onCancel={() => cancelMutation.mutate(r.id)}
              cancelling={
                cancelMutation.isPending && cancelMutation.variables === r.id
              }
            />
```

- [ ] **Step 2: Renderizar o selo no item**

Atualizar a assinatura e o corpo de `ReservationItem`:

```tsx
function ReservationItem({
  reservation,
  ordinal,
  onCancel,
  cancelling,
}: {
  reservation: Reservation
  ordinal?: number
  onCancel: () => void
  cancelling: boolean
}) {
  const canCancel =
    reservation.status === 'pendente' || reservation.status === 'confirmada'
  const ordemTexto =
    reservation.status === 'confirmada' && ordinal != null
      ? ordinal <= 2
        ? `${ordinal}ª reserva do ano`
        : `${ordinal}ª reserva (extra)`
      : null
  return (
    <Card className="flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-display text-xl capitalize text-granada">
            {formatShort(fromISODate(reservation.data))}
          </span>
          <StatusBadge status={reservation.status} />
        </div>
        {ordemTexto && <p className="eyebrow mt-1">{ordemTexto}</p>}
        {reservation.num_convidados != null && (
          <p className="font-body text-sm text-tinta-mid">
            {reservation.num_convidados} convidado(s)
          </p>
        )}
        {reservation.observacoes && (
          <p className="font-body text-sm text-tinta-mid">
            {reservation.observacoes}
          </p>
        )}
      </div>
      {canCancel && (
        <Button variant="outline" onClick={onCancel} loading={cancelling} className="shrink-0">
          Cancelar
        </Button>
      )}
    </Card>
  )
}
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc -b`
Expected: exit 0.

Run: `npm run build`
Expected: build conclui (warning de chunk esperado).

- [ ] **Step 4: Conferência manual (membro)**

`npm run dev`, logado como **membro** com ao menos uma confirmada → tab Reservas:
- Reserva confirmada mostra "Nª reserva do ano" / "Nª reserva (extra)".
- Pendente/recusada/cancelada **não** mostram o selo.
- Não aparece dado de outro irmão (a view restringe via RLS).

- [ ] **Step 5: Commit**

```bash
git add src/pages/MyReservationsPage.tsx
git commit -m "feat(membro): selo de ordem (1ª/2ª/extra) na reserva confirmada"
```

---

## Self-Review (já aplicado)

**Spec coverage:**
- Cota ano civil / data do evento / só confirmadas → view `revenue_entries` (Task 1, `where status='confirmada'`, `partition by user_id, year(data)`). ✅
- Taxa 20%/40% (constantes) → `case when ordinal<=2 then 0.20 else 0.40` na view. ✅
- `salario_minimo(ano,valor)` admin edita, taxa usa SM do ano do evento → tabela + RLS (Task 1) + `SalarioMinimoEditor` (Task 5) + `left join sm on sm.ano=c.ano`. ✅
- Só receita prevista, sem pagamento → nenhum campo de pagamento em lugar nenhum. ✅
- Cota não bloqueia reserva → fluxo de reserva intocado (nenhuma task mexe na validação). ✅
- Relatório por ano: lista detalhada + total → Task 5. ✅
- Membro vê só a ordem → Task 6 (`ordemTexto`, sem % nem R$). ✅
- Rota `/admin/receita` + mini-nav, TabBar inalterada → Task 4. ✅
- `security_invoker` na view → Task 1 Step 1. ✅
- `formatBRL` via Intl → Task 2. ✅
- EmptyState ano sem confirmada; aviso de SM faltando → Task 5. ✅

**Placeholder scan:** sem TBD/TODO; todo passo com código real. As únicas ações "humanas" são aplicar a migration (Task 1 Step 2, inevitável — sem service key local) e as conferências manuais (sem suíte de testes). ✅

**Type consistency:** `RevenueEntry` (Task 3) usado em Tasks 5/6 com os mesmos campos (`id`, `nome`, `data`, `ano`, `ordinal`, `rate`, `sm`); `fetchMyRevenueOrdinals` devolve `Record<string,number>` consumido como `ordinais?.[r.id]` (Task 6); `upsertSalarioMinimo(ano, valor)` chamado com `(ano, v:number)` (Task 5). `Select`/`Field`/`Input`/`Alert`/`Card`/`EmptyState`/`Button`/`PageHeader`/`Spinner` todos existem em `ui.tsx`. ✅
