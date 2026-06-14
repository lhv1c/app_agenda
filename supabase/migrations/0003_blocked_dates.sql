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
