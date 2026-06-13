-- ============================================================================
-- Agenda do Salão — Loja Ciência e Justiça (Marialva)
-- Esquema inicial: perfis, códigos de convite, reservas, RLS, triggers e view.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tabelas
-- ----------------------------------------------------------------------------

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nome       text not null,
  email      text not null,
  role       text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.invite_codes (
  code       text primary key,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id             uuid primary key default gen_random_uuid(),
  data           date not null,
  user_id        uuid not null references auth.users (id) on delete cascade,
  num_convidados int  check (num_convidados is null or num_convidados >= 0),
  observacoes    text,
  status         text not null default 'pendente'
                 check (status in ('pendente', 'confirmada', 'recusada', 'cancelada')),
  created_at     timestamptz not null default now(),
  decided_at     timestamptz,
  decided_by     uuid references auth.users (id)
);

create index if not exists reservations_data_idx on public.reservations (data);
create index if not exists reservations_user_idx on public.reservations (user_id);

-- No máximo uma reserva confirmada por data.
create unique index if not exists one_confirmed_per_date
  on public.reservations (data)
  where status = 'confirmada';

-- FK extra para o PostgREST embutir o perfil do solicitante nas views do admin
-- (reservations.user_id -> profiles.id, além da FK para auth.users). profiles.id
-- é 1:1 com auth.users.id, então a constraint é sempre satisfeita.
do $$ begin
  alter table public.reservations
    add constraint reservations_user_profile_fk
    foreign key (user_id) references public.profiles (id) on delete cascade;
exception when duplicate_object then null;
end $$;

-- ----------------------------------------------------------------------------
-- Helper: is_admin() (SECURITY DEFINER evita recursão de RLS em profiles)
-- ----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ----------------------------------------------------------------------------
-- Bootstrap de perfil ao criar usuário no auth
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    new.email,
    case when new.email = 'cienciaejustica@gmail.com' then 'admin' else 'member' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Validação de inserção de reserva (janela 3..60 dias, sem conflito)
-- ----------------------------------------------------------------------------

create or replace function public.validate_reservation_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Toda nova reserva entra como pendente.
  new.status := 'pendente';
  new.decided_at := null;
  new.decided_by := null;

  -- Janela: abre 60 dias antes, fecha 3 dias antes (bloqueia faltando <= 3 dias,
  -- logo o primeiro dia válido é hoje + 4).
  if new.data < (current_date + 4) or new.data > (current_date + 60) then
    raise exception 'Data fora do período permitido (mínimo 4 dias, máximo 60).';
  end if;

  -- Data já confirmada para outro evento.
  if exists (
    select 1 from public.reservations
    where data = new.data and status = 'confirmada'
  ) then
    raise exception 'Data já confirmada.';
  end if;

  -- Mesmo usuário já tem reserva ativa nesta data.
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

drop trigger if exists before_reservation_insert on public.reservations;
create trigger before_reservation_insert
  before insert on public.reservations
  for each row execute function public.validate_reservation_insert();

-- ----------------------------------------------------------------------------
-- Decisão do admin: carimba decided_*, e auto-recusa a fila ao confirmar
-- ----------------------------------------------------------------------------

create or replace function public.stamp_reservation_decision()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('confirmada', 'recusada') then
    new.decided_at := now();
    new.decided_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists before_reservation_update on public.reservations;
create trigger before_reservation_update
  before update on public.reservations
  for each row execute function public.stamp_reservation_decision();

create or replace function public.reject_pending_siblings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'confirmada'
     and old.status is distinct from 'confirmada' then
    update public.reservations
      set status = 'recusada', decided_at = now(), decided_by = auth.uid()
    where data = new.data
      and id <> new.id
      and status = 'pendente';
  end if;
  return new;
end;
$$;

drop trigger if exists after_reservation_confirmed on public.reservations;
create trigger after_reservation_confirmed
  after update on public.reservations
  for each row execute function public.reject_pending_siblings();

-- ----------------------------------------------------------------------------
-- View pública de disponibilidade (agregada, sem dados pessoais)
-- View comum (security definer) agrega sobre todas as linhas; só expõe
-- data + flags, nunca quem reservou.
-- ----------------------------------------------------------------------------

create or replace view public.date_availability as
  select
    data,
    bool_or(status = 'confirmada')               as tem_confirmada,
    count(*) filter (where status = 'pendente')::int as qtd_pendentes
  from public.reservations
  where status in ('pendente', 'confirmada')
  group by data;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------

alter table public.profiles      enable row level security;
alter table public.reservations  enable row level security;
alter table public.invite_codes  enable row level security; -- sem políticas: só service_role

-- profiles --------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- reservations ----------------------------------------------------------------
drop policy if exists reservations_select on public.reservations;
create policy reservations_select on public.reservations
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists reservations_insert_own on public.reservations;
create policy reservations_insert_own on public.reservations
  for insert with check (user_id = auth.uid());

-- Membro só pode cancelar a própria reserva.
drop policy if exists reservations_cancel_own on public.reservations;
create policy reservations_cancel_own on public.reservations
  for update using (user_id = auth.uid() and not public.is_admin())
  with check (user_id = auth.uid() and status = 'cancelada');

-- Admin pode atualizar qualquer reserva.
drop policy if exists reservations_admin_update on public.reservations;
create policy reservations_admin_update on public.reservations
  for update using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- Grants
-- ----------------------------------------------------------------------------

grant select, update on public.profiles to authenticated;
grant select, insert, update on public.reservations to authenticated;
grant select on public.date_availability to authenticated;

-- invite_codes não é exposta a anon/authenticated; a Edge Function lê via
-- service_role, que precisa de privilégio explícito de leitura.
grant select on public.invite_codes to service_role;

-- notify-status (Edge Function) lê profiles via service_role para descobrir
-- destinatários (admins e o membro). service_role bypassa RLS mas ainda
-- precisa do GRANT de tabela.
grant select on public.profiles to service_role;

-- ----------------------------------------------------------------------------
-- Código de convite inicial
-- ----------------------------------------------------------------------------
-- NÃO versione o código real aqui (este repo é público). Após aplicar a
-- migration, insira o código real manualmente via SQL Editor do Supabase:
--
--   insert into public.invite_codes (code, ativo)
--   values ('SEU-CODIGO-SECRETO', true)
--   on conflict (code) do nothing;
--
-- O placeholder abaixo NÃO funciona para cadastro real — troque no banco.

insert into public.invite_codes (code, ativo)
values ('TROQUE-ESTE-CODIGO', false)
on conflict (code) do nothing;
