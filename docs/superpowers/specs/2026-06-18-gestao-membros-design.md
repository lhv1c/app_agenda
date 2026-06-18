# Gestão de membros (listar, promover, rebaixar, desativar)

**Data:** 2026-06-18
**Item do backlog v2:** seção "A estudar" → "Gestão de membros
(listar/promover/rebaixar/desativar)". Feature independente da "Admin reserva
datas" (spec separado).

## Problema

Hoje só dá pra virar admin via trigger no cadastro (e-mail fixo da Loja) ou
mexendo no banco na mão. O admin não tem como, pelo app: ver quem são os
membros, promover um irmão a admin, rebaixar de volta, nem tirar acesso de quem
saiu da Loja. Tudo isso é feito hoje fora do app (SQL Editor) ou não é feito.

## Objetivo

Dar ao admin uma tela **Membros** que:

1. **Lista** todos os perfis (nome, e-mail, telefone/WhatsApp, papel, status).
2. **Promove** membro → admin e **rebaixa** admin → membro.
3. **Desativa / reativa** conta (sem apagar nada).

## Decisões do brainstorming

- **Escopo = as 4 ações:** listar, promover, rebaixar, desativar (+reativar).
- **Desativar = flag `ativo` (bool) em `profiles`**, NÃO ban no auth (sem Edge
  Function, custo zero). Reativar = religar a flag.
- **Desativar preserva tudo.** Reservas pendentes/confirmadas do membro ficam
  intactas (histórico e receita preservados). Desativar só barra **logar** e
  **criar novas reservas**. Reativar volta ao normal.
- **Gate de conta inativa no app:** ao logar/abrir sessão, se `profile.ativo`
  for false → `signOut()` + aviso "Sua conta foi desativada. Procure a
  secretaria." Não há tela protegida pra conta inativa.
- **Travas anti-lockout (completas):**
  - admin **não** pode rebaixar a si mesmo;
  - admin **não** pode desativar a si mesmo;
  - sistema bloqueia rebaixar **ou** desativar o **último admin ativo** restante.
- **Hardening:** `validate_reservation_insert` passa a rejeitar reserva de
  `user_id` inativo (defesa em profundidade; o gate de login já cobre o caminho
  normal).

## Arquitetura

### Banco (migration `0005_gestao_membros.sql`)

**Coluna `ativo`:**

```sql
alter table public.profiles
  add column if not exists ativo boolean not null default true;
```

- `default true` cobre membros antigos e o `handle_new_user` (não precisa mexer
  na função: a coluna assume o default no insert).

**Nova RLS — admin edita OUTROS perfis** (a `profiles_update_own` só deixa o
próprio):

```sql
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());
```

**Estender o trigger `guard_profile_update`** (já existe no `0002`, BEFORE
UPDATE) com as travas. Hoje ele só trava `role`/`email` pra não-admin; passa a
também travar `ativo` pra não-admin e adicionar as travas anti-lockout pra
admin:

```sql
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    -- não-admin nunca muda papel, e-mail nem status da conta
    new.role  := old.role;
    new.email := old.email;
    new.ativo := old.ativo;
    return new;
  end if;

  -- admin: travas anti-lockout
  -- 1) não rebaixar a si mesmo
  if new.id = auth.uid() and old.role = 'admin' and new.role <> 'admin' then
    raise exception 'Você não pode rebaixar a si mesmo.';
  end if;
  -- 2) não desativar a si mesmo
  if new.id = auth.uid() and old.ativo and not new.ativo then
    raise exception 'Você não pode desativar a própria conta.';
  end if;
  -- 3) não deixar a Loja sem nenhum admin ativo
  if (old.role = 'admin' and old.ativo)             -- linha era admin ativo
     and (new.role <> 'admin' or not new.ativo)     -- e deixou de ser
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
```

> O trigger já está ligado (`before_profile_update`); só recriamos a função.

**Hardening em `validate_reservation_insert`** — rejeitar `user_id` inativo.
Recriar a função somando o check (ela já existe desde o `0003`, recriada pra
incluir data bloqueada). Acrescentar no topo:

```sql
  if not exists (select 1 from public.profiles where id = new.user_id and ativo) then
    raise exception 'Conta inativa não pode reservar.';
  end if;
```

> A migration recria a função inteira (copiar a versão vigente do `0003` e somar
> o check), pra manter idempotência.

**Grants:** `update` em `public.profiles` já é concedido a `authenticated` no
`0001`. A RLS nova governa o acesso. `notify pgrst, 'reload schema';` ao fim.

### App

**AuthContext / tipo `Profile`** (`src/types.ts`): adicionar `ativo: boolean`.
O `select` que carrega o perfil passa a trazer `ativo` (conferir o `select('*')`
ou lista de colunas).

**Gate de conta inativa** (no AuthProvider, onde resolve a sessão e busca o
perfil): se o perfil vier `ativo === false`, chamar `signOut()` e expor um aviso
pra `LoginPage` mostrar ("Sua conta foi desativada. Procure a secretaria."). Não
renderizar área logada pra conta inativa.

**`src/api/members.ts`:**

- `fetchMembers(): Promise<Member[]>` — `from('profiles').select('id, nome,
  email, telefone, role, ativo').order('nome')`.
- `setRole(id: string, role: 'admin' | 'member'): Promise<void>` —
  `update({ role }).eq('id', id)`.
- `setActive(id: string, ativo: boolean): Promise<void>` —
  `update({ ativo }).eq('id', id)`.

> As travas vivem no trigger; o `update` falha com a mensagem do `raise`. A API
> propaga o erro pra UI mostrar.

**Tipo (`src/types.ts`):**

```ts
export interface Member {
  id: string
  nome: string
  email: string
  telefone: string | null
  role: 'admin' | 'member'
  ativo: boolean
}
```

**`src/pages/admin/MembersPage.tsx`** (Prancha):

- `PageHeader` "Membros".
- Lista de cards (um por perfil): nome · e-mail · telefone como link `wa.me`
  (reusar `whatsappUrl` de `src/lib/phone.ts`) quando houver · badge do papel
  (Admin/Membro) · marca discreta de "inativo" quando `!ativo` (card esmaecido).
- Ações por card (botões no padrão Prancha):
  - papel: "Tornar admin" (se member) / "Rebaixar a membro" (se admin);
  - status: "Desativar" (se ativo) / "Reativar" (se inativo).
- O **próprio** card do admin logado: esconder/desabilitar "Rebaixar" e
  "Desativar" (espelha as travas do banco; UX, não segurança).
- Confirmação leve antes de rebaixar/desativar (`window.confirm` ou Alert de
  confirmação no padrão atual do app).
- Erro do trigger (último admin etc.) → mostrar a mensagem num `Alert`.
- Sucesso → recarregar a lista.
- `EmptyState` improvável (sempre há ao menos o admin), mas manter por padrão.

**Mini-nav admin** (`src/components/AdminLayout.tsx`): adicionar 3º link →
**Secretaria · Receita · Membros**. Rota nova em `App.tsx` dentro do
`AdminLayout`:

```tsx
<Route path="/admin/membros" element={<MembersPage />} />
```

## Componentes (resumo de responsabilidade)

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/0005_gestao_membros.sql` | coluna `ativo`, RLS `profiles_admin_update`, trigger `guard_profile_update` estendido, hardening em `validate_reservation_insert` |
| `src/types.ts` (alterado) | `ativo` em `Profile`; novo `Member` |
| `src/contexts/AuthContext` (alterado) | carregar `ativo`; gate de conta inativa (signOut + aviso) |
| `src/api/members.ts` | `fetchMembers` / `setRole` / `setActive` |
| `src/pages/admin/MembersPage.tsx` | tela de gestão |
| `src/components/AdminLayout.tsx` (alterado) | 3º link na mini-nav |
| `App.tsx` (alterado) | rota `/admin/membros` |
| `LoginPage` (alterado) | exibir aviso "conta desativada" |

## Fora de escopo

- Ban no auth / apagar conta de verdade (usamos flag `ativo`).
- Cancelar reservas ao desativar (preservamos tudo).
- Convidar/criar membro pela tela (convite segue como está).
- Editar nome/telefone de outro membro pelo admin (membro edita o próprio em
  `/perfil`).
- Logs/auditoria de quem promoveu/desativou quem.

## Testes / verificação

- `tsc -b` + `npm run build` limpos.
- Migration aplicada no SQL Editor; `notify pgrst, 'reload schema';`.
- Manual (admin):
  - lista mostra todos com papel/status corretos;
  - promover membro → vira admin (vê área admin no próximo login dele);
  - rebaixar admin → vira membro;
  - desativar membro → some o acesso: no próximo login dele, signOut + aviso;
    reservas dele continuam aparecendo pro admin e na receita;
  - reativar → loga normal de novo;
  - tentar rebaixar **a si mesmo** → bloqueado (UI + banco);
  - tentar desativar **a si mesmo** → bloqueado;
  - com 1 só admin ativo, tentar rebaixá-lo/desativá-lo por outro caminho →
    erro "última conta de administrador ativa".
- Manual (membro inativo): tentar reservar via API → rejeitado pelo trigger.
- Conferência visual (Prancha) da tela e da mini-nav de 3 itens, desktop +
  mobile.
