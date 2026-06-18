-- ============================================================================
-- Agenda do Salão — v2: gestão de membros
-- Admin lista/promove/rebaixa/desativa contas. Desativar = flag (preserva tudo);
-- não bane no auth. Travas anti-lockout no trigger guard_profile_update.
-- ============================================================================

-- Coluna de status da conta. default true cobre membros antigos e o
-- handle_new_user (a coluna assume o default no insert, não precisa mexer nele).
alter table public.profiles
  add column if not exists ativo boolean not null default true;

-- ----------------------------------------------------------------------------
-- RLS: admin pode editar OUTROS perfis (a profiles_update_own só deixa o próprio
-- via auth.uid() = id). Esta política abre o update para qualquer admin; as
-- regras de negócio (travas) vivem no trigger abaixo.
-- ----------------------------------------------------------------------------
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- guard_profile_update estendido (já ligado pelo trigger before_profile_update
-- do 0002; aqui só recriamos a função):
--  - não-admin: nunca muda role/email/ativo (força os valores antigos);
--  - admin: travas anti-lockout (no self-demote, no self-deactivate, e não
--    pode deixar a Loja sem nenhum admin ativo).
-- ----------------------------------------------------------------------------
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.role  := old.role;
    new.email := old.email;
    new.ativo := old.ativo;
    return new;
  end if;

  -- 1) não rebaixar a si mesmo
  if new.id = auth.uid() and old.role = 'admin' and new.role <> 'admin' then
    raise exception 'Você não pode rebaixar a si mesmo.';
  end if;
  -- 2) não desativar a si mesmo
  if new.id = auth.uid() and old.ativo and not new.ativo then
    raise exception 'Você não pode desativar a própria conta.';
  end if;
  -- 3) não deixar a Loja sem nenhum admin ativo
  if (old.role = 'admin' and old.ativo)
     and (new.role <> 'admin' or not new.ativo)
     and not exists (
       select 1 from public.profiles
       where role = 'admin' and ativo and id <> new.id
     )
  then
    raise exception 'Não é possível: esta é a última conta de administrador ativa.';
  end if;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Hardening: reserva de conta inativa é rejeitada (defesa em profundidade; o
-- gate de login já cobre o caminho normal). Recria a função vigente do 0003
-- somando o check no topo, mantendo idempotência.
-- ----------------------------------------------------------------------------
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

  if not exists (
    select 1 from public.profiles where id = new.user_id and ativo
  ) then
    raise exception 'Conta inativa não pode reservar.';
  end if;

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
