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
