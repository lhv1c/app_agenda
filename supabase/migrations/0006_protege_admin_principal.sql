-- ============================================================================
-- Agenda do Salão — protege o administrador principal (fundador)
-- O e-mail cienciaejustica@gmail.com é a conta-mãe da Loja: sempre admin e
-- sempre ativo. NENHUM admin (nem ele mesmo) pode rebaixá-lo ou desativá-lo.
-- Só recria a função guard_profile_update somando a trava do fundador; o
-- trigger before_profile_update (0002) já está ligado.
-- ============================================================================

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

  -- 0) admin principal (fundador) é intocável: sempre admin e sempre ativo.
  --    Nenhum admin pode rebaixá-lo nem desativá-lo (a conta-mãe da Loja).
  if old.email = 'cienciaejustica@gmail.com'
     and (new.role <> 'admin' or not new.ativo) then
    raise exception 'O administrador principal não pode ser rebaixado nem desativado.';
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

notify pgrst, 'reload schema';
