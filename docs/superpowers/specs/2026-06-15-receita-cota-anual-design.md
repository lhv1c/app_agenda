# Cota anual, taxa por reserva e relatório de receita

**Data:** 2026-06-15
**Item do backlog v2:** "Controle financeiro (valor + pagamento/caução)" — versão enxuta, só receita prevista (sem pagamento). Relaciona com "Relatório de ocupação por mês".

## Problema

A Loja cobra dos irmãos pelo uso do salão, mas não há registro disso no app.
Regra atual: cada irmão tem direito a **2 reservas por ano** à taxa de **20% do
salário mínimo**; da **3ª em diante** (no mesmo ano) a taxa sobe pra **40% do
salário mínimo**. A tesouraria precisa de um **relatório de receita prevista**
por ano. Hoje isso é controlado fora do app (na mão).

## Objetivo

1. Registrar/derivar, por reserva **confirmada**, qual é a ordem dela no ano
   civil do irmão (1ª, 2ª, extra) e a taxa correspondente (20% ou 40% do salário
   mínimo do ano do evento).
2. Dar ao admin um **relatório de receita por ano**: lista detalhada das
   confirmadas + total.
3. Mostrar ao **membro**, em cada reserva **confirmada**, se é a 1ª/2ª/extra do
   ano dele (só a ordem, sem valor).

## Decisões do brainstorming

- **Cota:** ano **civil** (jan–dez), contada pela **data do evento** (`data`),
  só reservas **confirmadas**. Recusada/cancelada/pendente não contam.
- **Taxa:** 1ª e 2ª do ano = 20% do salário mínimo; 3ª+ = 40%. Constantes (2 /
  0.20 / 0.40) — mudam raramente, vivem na migration.
- **Salário mínimo:** tabela própria `salario_minimo(ano, valor)`, o admin
  edita. A taxa de uma reserva usa o SM **do ano do evento** (preserva
  histórico: relatório de anos passados não recalcula com SM novo).
- **Escopo:** só **receita prevista** (valor derivado). **Sem** status de
  pagamento, sem forma de pagamento, sem caução. Esses ficam como item futuro.
- **Cota não bloqueia reserva.** Extras são permitidas; só custam 40%. O fluxo
  de reserva (validação, janela, 1 confirmada por data) **não muda**.
- **Relatório:** por ano → lista detalhada + total geral.
- **Membro:** só a ordem ("2ª reserva do ano" / "3ª reserva (extra)"). Sem % nem
  R$ — não depende do SM estar cadastrado.

## Arquitetura

### Banco (migration `0004_receita.sql`)

**Tabela `salario_minimo`:**

```sql
create table public.salario_minimo (
  ano        int primary key,
  valor      numeric(10,2) not null check (valor > 0),
  updated_at timestamptz not null default now()
);
```

- RLS on. Select pra `authenticated` (valor do SM não é sensível e a view
  depende dele sob `security_invoker`). Insert/update só `is_admin()`.
- Grant `select, insert, update` pra `authenticated` (a RLS governa o acesso
  real).

**View `revenue_entries`** (`security_invoker = on` → herda a RLS de
`reservations`: admin vê todas, membro vê só as próprias):

```sql
create view public.revenue_entries with (security_invoker = on) as
  select
    r.id,
    r.user_id,
    p.nome,
    r.data,
    extract(year from r.data)::int as ano,
    row_number() over (
      partition by r.user_id, extract(year from r.data)
      order by r.data, r.created_at
    )::int as ordinal,
    sm.valor as sm,
    (case
       when row_number() over (
         partition by r.user_id, extract(year from r.data)
         order by r.data, r.created_at) <= 2
       then 0.20 else 0.40
     end)::numeric as rate
  from public.reservations r
  join public.profiles p on p.id = r.user_id
  left join public.salario_minimo sm on sm.ano = extract(year from r.data)::int
  where r.status = 'confirmada';
```

- `ordinal` correto pros dois papéis: como é particionado por `user_id`, mesmo
  quando a RLS reduz as linhas visíveis (membro), o membro enxerga **todas** as
  próprias confirmadas → a contagem fica certa.
- `valor_taxa` **não** vai na view (precisa de `rate * sm` e arredondamento; SM
  pode ser null). É calculado no cliente: `valor_taxa = sm == null ? null :
  round(rate * sm, 2)`. Mantém a view simples e deixa o "SM faltando" explícito.
- Grant `select` pra `authenticated`.

**Nota de segurança:** `security_invoker = on` é obrigatório aqui. Sem ele a
view roda como dono e vazaria nome+reservas de todos pra qualquer membro.
Sempre `notify pgrst, 'reload schema';` ao fim do DDL.

### API + libs (frontend)

**`src/lib/money.ts`:**

```ts
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
/** Formata número em Real (R$ 1.234,56). */
export function formatBRL(value: number): string {
  return brl.format(value)
}
```

**`src/api/revenue.ts`:**

- `fetchRevenueEntries(ano: number): Promise<RevenueEntry[]>` — `from
  ('revenue_entries').select('*').eq('ano', ano).order('data')`.
- `fetchMyRevenueOrdinals(userId): Promise<Record<string, number>>` — lê
  `revenue_entries` filtrado por `user_id`, devolve mapa `id → ordinal` (a RLS já
  restringe; o filtro explícito é defensivo). Usado na tela do membro.
- `fetchSalarioMinimo(ano: number): Promise<number | null>` — uma linha de
  `salario_minimo` ou null.
- `upsertSalarioMinimo(ano: number, valor: number): Promise<void>` — `upsert`
  por `ano`.

**Tipo (`src/types.ts`):**

```ts
export interface RevenueEntry {
  id: string
  user_id: string
  nome: string
  data: string // yyyy-MM-dd
  ano: number
  ordinal: number
  rate: number // 0.20 | 0.40
  sm: number | null
}
```

### UI

**Rota nova `/admin/receita`** + layout de admin com mini-nav.

`App.tsx`: envolver as rotas de admin num `AdminLayout` (Outlet):

```tsx
<Route element={<AdminRoute />}>
  <Route element={<AdminLayout />}>
    <Route path="/admin" element={<AdminDashboardPage />} />
    <Route path="/admin/receita" element={<RevenueReportPage />} />
  </Route>
</Route>
```

**`src/components/AdminNav.tsx`** (ou dentro do `AdminLayout`): mini-nav com 2
links no padrão Prancha — **Secretaria** (`/admin`, `end`) e **Receita**
(`/admin/receita`). Estilo discreto (pílulas/abas com sublinhado ouro no ativo,
reaproveitando a linguagem do TabBar). A TabBar continua com 4 itens (não ganha
5º — apertado no mobile); "Admin" segue única e abre a Secretaria por padrão.

**`src/pages/admin/RevenueReportPage.tsx`** (Prancha):

- `PageHeader` "Relatório de receita".
- **Seletor de ano** (`Select`): anos derivados das confirmadas (mín..máx) +
  ano atual garantido. Estado inicial = ano atual.
- **Salário mínimo do ano:** mostra `formatBRL(sm)`; admin edita inline (campo +
  "Salvar", `upsertSalarioMinimo`). Se não cadastrado → `Alert info` "Defina o
  salário mínimo de {ano} para calcular os valores" + campo.
- **Lista detalhada:** uma linha por confirmada (ordenada por data): nome do
  irmão · `formatShort(data)` · selo da ordem (1ª / 2ª / **extra** — extra com
  realce ouro) · `{rate*100}%` · `formatBRL(valor_taxa)` ou "—" se SM null.
- **Total do ano** no rodapé: soma dos `valor_taxa`. Se algum SM faltar → mostra
  total das linhas com valor + aviso "{n} reserva(s) sem valor (defina o salário
  mínimo)".
- `EmptyState` quando o ano não tem confirmada.

**`src/pages/MyReservationsPage.tsx`** (membro):

- Buscar `fetchMyRevenueOrdinals(userId)` junto das reservas.
- Em cada item com `status === 'confirmada'` que tenha ordinal, render uma linha
  no padrão `eyebrow`: `ordinal === 1` → "1ª reserva do ano"; `=== 2` → "2ª
  reserva do ano"; `>= 3` → "{ordinal}ª reserva (extra)". Pendente/recusada/
  cancelada não mostram nada novo.

## Componentes (resumo de responsabilidade)

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/0004_receita.sql` | tabela `salario_minimo`, view `revenue_entries`, RLS, grants |
| `src/lib/money.ts` | `formatBRL` |
| `src/api/revenue.ts` | leitura do relatório/ordinais + CRUD do SM |
| `src/components/AdminNav.tsx` + `AdminLayout` | mini-nav entre Secretaria e Receita |
| `src/pages/admin/RevenueReportPage.tsx` | relatório por ano + edição do SM |
| `src/pages/MyReservationsPage.tsx` (alterado) | selo de ordem na confirmada |
| `src/types.ts` (alterado) | `RevenueEntry` |

## Fora de escopo

- Status/forma de pagamento, caução (item financeiro futuro).
- Bloquear reserva ao exceder a cota (extras são permitidas).
- Mostrar valor/% pro membro (só a ordem).
- Exportar CSV (item separado do backlog).
- Editar a regra (2/20%/40%) por tela — é constante de código.
- Relatório agrupado por irmão ou por mês (escolhido: lista detalhada + total).

## Testes / verificação

- `tsc -b` + `npm run build` limpos.
- Migration aplicada no SQL Editor; `notify pgrst, 'reload schema';`.
- Manual (admin): cadastrar SM do ano; confirmar reservas e ver ordem/taxa/valor
  certos; 3ª reserva do mesmo irmão no ano vira "extra" a 40%; total bate; ano
  sem SM mostra aviso e "—"; trocar de ano recalcula.
- Manual (membro): reserva confirmada mostra "Nª reserva do ano"/"(extra)";
  pendente não mostra selo; não vaza dado de outro irmão.
- Conferência visual (Prancha) do relatório e da mini-nav, desktop + mobile.
