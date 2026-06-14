-- ============================================================================
-- Agenda do Salão — v2 item 1: telefone/WhatsApp no perfil
-- Adiciona coluna telefone, propaga do cadastro e protege contra escalação de
-- privilégio na edição do próprio perfil.
-- ============================================================================

-- Membros antigos ficam com telefone nulo; preenchem depois na página de perfil.
alter table public.profiles add column if not exists telefone text;

-- ----------------------------------------------------------------------------
-- Bootstrap de perfil: agora também lê o telefone vindo do user_metadata
-- (preenchido pela Edge Function signup-with-invite).
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email, role, telefone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    new.email,
    case when new.email = 'cienciaejustica@gmail.com' then 'admin' else 'member' end,
    nullif(new.raw_user_meta_data ->> 'telefone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Hardening: a política profiles_update_own permite o membro atualizar o
-- próprio perfil. A página "Meu perfil" abre esse caminho via API, então
-- impedimos que um não-admin altere role ou email por essa via.
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
  end if;
  return new;
end;
$$;

drop trigger if exists before_profile_update on public.profiles;
create trigger before_profile_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- PostgREST recarrega o schema (nova coluna visível na API).
notify pgrst, 'reload schema';
