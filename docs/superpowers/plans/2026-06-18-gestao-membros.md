# Gestão de Membros — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao admin uma tela **Membros** para listar todos os perfis, promover/rebaixar papel e desativar/reativar contas (flag, sem apagar nada), com travas anti-lockout no banco.

**Architecture:** Coluna `ativo` em `profiles` + RLS que deixa admin editar outros perfis + trigger `guard_profile_update` estendido com as travas (no self-demote, no self-deactivate, no zerar último admin). App: gate de conta inativa no `AuthProvider` (signOut + aviso na `LoginPage`), `api/members.ts`, página `/admin/membros`, 3º link na mini-nav admin.

**Tech Stack:** React + TypeScript + Vite, TanStack Query, Supabase (Postgres + RLS + triggers), Tailwind (design system "Prancha").

**Convenções deste repo (importante):**
- **Sem framework de teste.** Verificação por tarefa = `npx tsc -b` limpo + `npm run build` limpo + (no fim) e2e manual pelo usuário. NÃO inventar pytest/vitest.
- Migration `0005` **o usuário aplica no SQL Editor** (sem service key local). O agente NÃO roda a migration; só escreve o arquivo e marca como "aguardando usuário".
- Commits sem co-author. Trabalhar na branch `feat/gestao-membros` (criar a partir de `main`).
- Caminhos de import sempre relativos como no resto do `src/`.

---

## File Structure

| Arquivo | Cria/Altera | Responsabilidade |
|---|---|---|
| `supabase/migrations/0005_gestao_membros.sql` | Cria | coluna `ativo`; RLS `profiles_admin_update`; `guard_profile_update` estendido; hardening em `validate_reservation_insert`; `notify pgrst` |
| `src/types.ts` | Altera | `ativo: boolean` em `Profile`; novo `Member` |
| `src/api/members.ts` | Cria | `fetchMembers` / `setRole` / `setActive` |
| `src/auth/context.ts` | Altera | `inactiveNotice` + `clearInactiveNotice` em `AuthState` |
| `src/auth/AuthProvider.tsx` | Altera | carregar `ativo`; gate: se inativo → signOut + setar `inactiveNotice` |
| `src/pages/LoginPage.tsx` | Altera | mostrar aviso "conta desativada"; limpar ao tentar logar |
| `src/pages/admin/MembersPage.tsx` | Cria | tela de gestão (lista + ações) |
| `src/components/AdminLayout.tsx` | Altera | 3º link "Membros" na mini-nav |
| `src/App.tsx` | Altera | rota `/admin/membros` dentro do `AdminLayout` |

---

## Task 0: Branch

- [ ] **Step 1: Criar branch a partir de main**

```bash
git checkout -b feat/gestao-membros
```

Confirmar working tree limpo antes (`git status`).

---

## Task 1: Migration `0005_gestao_membros.sql` (banco)

**Files:**
- Create: `supabase/migrations/0005_gestao_membros.sql`

> ⚠️ O agente **só escreve o arquivo**. Aplicação no banco = **usuário** no SQL Editor. Não tente rodar CLI/psql.

- [ ] **Step 1: Escrever a migration**

Conteúdo exato do arquivo:

```sql
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0005_gestao_membros.sql
git commit -m "feat(db): coluna ativo, RLS admin-update, travas anti-lockout"
```

- [ ] **Step 3: PEDIR ao usuário** aplicar a migration no SQL Editor e confirmar:
  - rodou sem erro;
  - `select column_name from information_schema.columns where table_name='profiles' and column_name='ativo';` retorna 1 linha;
  - `notify pgrst, 'reload schema';` ao fim (já está na migration).

> Bloqueia o e2e final, mas NÃO bloqueia escrever o código das tarefas seguintes (tipos/UI). Seguir codando.

---

## Task 2: Tipos (`Profile.ativo` + `Member`)

**Files:**
- Modify: `src/types.ts:9-16` (interface `Profile`) e final do arquivo (novo `Member`)

- [ ] **Step 1: Adicionar `ativo` ao `Profile`**

Em `src/types.ts`, a interface `Profile` passa a ser:

```ts
export interface Profile {
  id: string
  nome: string
  email: string
  telefone: string | null
  role: Role
  ativo: boolean
  created_at: string
}
```

- [ ] **Step 2: Adicionar a interface `Member` ao fim do arquivo**

```ts
/** Perfil enxuto para a tela de gestão de membros (admin). */
export interface Member {
  id: string
  nome: string
  email: string
  telefone: string | null
  role: Role
  ativo: boolean
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: limpo (pode haver erro temporário em arquivos que ainda não tratam `ativo` — se aparecer, é do `select('*')` do AuthProvider que já popula o campo; resolvido na Task 4). Se `tsc` reclamar de `ativo` faltando em algum literal de `Profile`, anotar e resolver na task correspondente.

> Não commitar ainda; tipo sozinho não fecha unidade. Commit junto com a API na Task 3.

---

## Task 3: API (`src/api/members.ts`)

**Files:**
- Create: `src/api/members.ts`

- [ ] **Step 1: Escrever o módulo**

```ts
import { supabase } from '../lib/supabase'
import type { Member, Role } from '../types'

/** Todos os perfis, ordenados por nome (admin gerencia). */
export async function fetchMembers(): Promise<Member[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nome, email, telefone, role, ativo')
    .order('nome', { ascending: true })
  if (error) throw error
  return (data ?? []) as Member[]
}

/** Promove/rebaixa papel. As travas anti-lockout vivem no trigger; o update
 *  falha com a mensagem do raise, que a UI mostra. */
export async function setRole(id: string, role: Role): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', id)
  if (error) throw error
}

/** Desativa/reativa conta (flag; preserva histórico). */
export async function setActive(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ ativo })
    .eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: `src/api/members.ts` sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts src/api/members.ts
git commit -m "feat(api): members (fetch/setRole/setActive) + tipo Member e Profile.ativo"
```

---

## Task 4: Gate de conta inativa (`AuthProvider` + `context`)

**Files:**
- Modify: `src/auth/context.ts` (interface `AuthState`)
- Modify: `src/auth/AuthProvider.tsx` (estado + gate em `loadProfile`)

**Comportamento:** ao resolver a sessão/perfil, se o perfil vier `ativo === false`, o app faz `signOut()` e expõe `inactiveNotice = true` para a `LoginPage` mostrar o aviso. `clearInactiveNotice()` zera a flag quando o usuário tenta logar de novo.

- [ ] **Step 1: Estender `AuthState` em `src/auth/context.ts`**

Adicionar dois campos à interface `AuthState` (depois de `refreshProfile`):

```ts
export interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  inactiveNotice: boolean
  clearInactiveNotice: () => void
}
```

- [ ] **Step 2: Implementar no `AuthProvider`**

Em `src/auth/AuthProvider.tsx`:

(a) novo estado, após `const [loading, setLoading] = useState(true)`:

```tsx
  const [inactiveNotice, setInactiveNotice] = useState(false)
```

(b) `loadProfile` passa a barrar conta inativa. Substituir o corpo atual por:

```tsx
  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      // eslint-disable-next-line no-console
      console.error('Falha ao carregar perfil:', error.message)
      setProfile(null)
      return
    }
    const prof = data as Profile | null
    if (prof && prof.ativo === false) {
      // Conta desativada: derruba a sessão e sinaliza o aviso pra LoginPage.
      setInactiveNotice(true)
      setProfile(null)
      currentUserId.current = null
      await supabase.auth.signOut()
      return
    }
    setProfile(prof)
  }, [])
```

(c) `clearInactiveNotice`, junto dos outros callbacks:

```tsx
  const clearInactiveNotice = useCallback(() => setInactiveNotice(false), [])
```

(d) incluir no `value` do `useMemo` (e nas deps):

```tsx
  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      loading,
      isAdmin: profile?.role === 'admin',
      signOut,
      refreshProfile,
      inactiveNotice,
      clearInactiveNotice,
    }),
    [session, profile, loading, signOut, refreshProfile, inactiveNotice, clearInactiveNotice],
  )
```

> Nota: `signOut()` dispara `onAuthStateChange` (SIGNED_OUT) → `setSession(null)`, `uid` null, `setProfile(null)`. Não chama `loadProfile` de novo (uid null) → sem loop. A flag `inactiveNotice` sobrevive porque é estado do provider.

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: limpo (o `select('*')` agora casa com `Profile` que tem `ativo`).

- [ ] **Step 4: Commit**

```bash
git add src/auth/context.ts src/auth/AuthProvider.tsx
git commit -m "feat(auth): gate de conta inativa (signOut + aviso)"
```

---

## Task 5: Aviso na `LoginPage`

**Files:**
- Modify: `src/pages/LoginPage.tsx`

- [ ] **Step 1: Consumir `inactiveNotice` e mostrar o aviso**

(a) importar o hook:

```tsx
import { useAuth } from '../auth/context'
```

(b) dentro do componente, após `const navigate = useNavigate()`:

```tsx
  const { inactiveNotice, clearInactiveNotice } = useAuth()
```

(c) no `handleSubmit`, logo após `setError(null)`, limpar o aviso antigo:

```tsx
    setError(null)
    clearInactiveNotice()
    setLoading(true)
```

(d) renderizar o aviso acima do `{error && ...}` dentro do `<form>`:

```tsx
      <form onSubmit={handleSubmit} className="space-y-4">
        {inactiveNotice && (
          <Alert tone="info">
            Sua conta foi desativada. Procure a secretaria.
          </Alert>
        )}
        {error && <Alert tone="error">{error}</Alert>}
```

> `Alert` já está importado na `LoginPage`. `tone="info"` existe no componente.

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc -b && npm run build`
Expected: ambos limpos.

- [ ] **Step 3: Commit**

```bash
git add src/pages/LoginPage.tsx
git commit -m "feat(login): aviso de conta desativada"
```

---

## Task 6: Página de gestão (`MembersPage`)

**Files:**
- Create: `src/pages/admin/MembersPage.tsx`

**Padrões a seguir (deste repo):**
- Componentes de `../../components/ui`: `Alert`, `Button`, `Card`, `EmptyState`, `PageHeader`, `Spinner`. `Button` tem `variant` (`primary|gold|outline|ghost`) e `loading`.
- TanStack Query: `useQuery` + `useMutation` + `useQueryClient` (ver `RevenueReportPage.tsx`).
- `whatsappUrl` de `../../lib/phone` para o link wa.me; `maskPhone` para exibir.
- `useAuth()` de `../../auth/context` para saber o id do admin logado (esconder ações no próprio card).
- Confirmação leve via `window.confirm` antes de rebaixar/desativar.

- [ ] **Step 1: Escrever a página**

```tsx
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../auth/context'
import { fetchMembers, setActive, setRole } from '../../api/members'
import { maskPhone, whatsappUrl } from '../../lib/phone'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
} from '../../components/ui'
import type { Member } from '../../types'

export function MembersPage() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const meId = profile?.id ?? null
  const [erro, setErro] = useState<string | null>(null)

  const membersQuery = useQuery({
    queryKey: ['members'],
    queryFn: fetchMembers,
  })

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'admin' | 'member' }) =>
      setRole(id, role),
    onSuccess: () => {
      setErro(null)
      queryClient.invalidateQueries({ queryKey: ['members'] })
    },
    onError: (e: unknown) =>
      setErro(e instanceof Error ? e.message : 'Falha ao alterar o papel.'),
  })

  const activeMutation = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      setActive(id, ativo),
    onSuccess: () => {
      setErro(null)
      queryClient.invalidateQueries({ queryKey: ['members'] })
    },
    onError: (e: unknown) =>
      setErro(e instanceof Error ? e.message : 'Falha ao alterar o status.'),
  })

  const busy = roleMutation.isPending || activeMutation.isPending
  const members = membersQuery.data ?? []

  function promover(m: Member) {
    setErro(null)
    roleMutation.mutate({ id: m.id, role: 'admin' })
  }
  function rebaixar(m: Member) {
    if (!window.confirm(`Rebaixar ${m.nome} a membro?`)) return
    setErro(null)
    roleMutation.mutate({ id: m.id, role: 'member' })
  }
  function desativar(m: Member) {
    if (!window.confirm(`Desativar a conta de ${m.nome}? Ele não poderá entrar nem reservar até ser reativado.`)) return
    setErro(null)
    activeMutation.mutate({ id: m.id, ativo: false })
  }
  function reativar(m: Member) {
    setErro(null)
    activeMutation.mutate({ id: m.id, ativo: true })
  }

  return (
    <section className="space-y-6">
      <PageHeader as="h2" eyebrow="Secretaria" title="Membros" />

      {erro && <Alert tone="error">{erro}</Alert>}

      {membersQuery.isLoading ? (
        <div className="flex justify-center py-10 text-granada">
          <Spinner className="size-7" />
        </div>
      ) : members.length === 0 ? (
        <EmptyState>Nenhum membro cadastrado.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {members.map((m) => {
            const isSelf = m.id === meId
            const isAdmin = m.role === 'admin'
            return (
              <Card
                key={m.id}
                className={`space-y-3 ${m.ativo ? '' : 'opacity-60'}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display text-lg text-granada">{m.nome}</p>
                    <p className="font-body text-sm text-tinta-mid break-all">
                      {m.email}
                    </p>
                    {m.telefone && (
                      <a
                        href={whatsappUrl(m.telefone)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-body text-sm text-granada underline decoration-ouro underline-offset-2"
                      >
                        {maskPhone(m.telefone)}
                      </a>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-block rounded-[4px] border px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.1em] ${
                        isAdmin
                          ? 'border-ouro/60 bg-ouro/10 text-ouro'
                          : 'border-linha bg-pergaminho text-tinta-mid'
                      }`}
                    >
                      {isAdmin ? 'Admin' : 'Membro'}
                    </span>
                    {!m.ativo && (
                      <span className="inline-block rounded-[4px] border border-linha bg-pergaminho px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.1em] text-tinta-mid">
                        Inativo
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {isAdmin ? (
                    <Button
                      variant="outline"
                      onClick={() => rebaixar(m)}
                      disabled={busy || isSelf}
                    >
                      Rebaixar a membro
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => promover(m)}
                      disabled={busy}
                    >
                      Tornar admin
                    </Button>
                  )}
                  {m.ativo ? (
                    <Button
                      variant="ghost"
                      onClick={() => desativar(m)}
                      disabled={busy || isSelf}
                    >
                      Desativar
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      onClick={() => reativar(m)}
                      disabled={busy}
                    >
                      Reativar
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </ul>
      )}
    </section>
  )
}
```

> `isSelf` desabilita "Rebaixar" e "Desativar" no próprio card (espelha as travas do banco — UX, não segurança). "Tornar admin" do próprio card nunca aparece (o admin logado já é admin).

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: `MembersPage.tsx` sem erros (a rota só é ligada na Task 7).

> Sem commit isolado: a página só vira acessível com a rota da Task 7. Commit junto.

---

## Task 7: Mini-nav + rota

**Files:**
- Modify: `src/components/AdminLayout.tsx` (3º link)
- Modify: `src/App.tsx` (import + rota)

- [ ] **Step 1: 3º link na mini-nav**

Em `src/components/AdminLayout.tsx`, dentro do `<nav>`, após o link de Receita:

```tsx
      <nav className="flex gap-6 border-b border-linha">
        <AdminTab to="/admin" label="Secretaria" end />
        <AdminTab to="/admin/receita" label="Receita" />
        <AdminTab to="/admin/membros" label="Membros" />
      </nav>
```

Atualizar o comentário do componente para refletir 3 abas:

```tsx
/** Casca das páginas de admin: abas Secretaria / Receita / Membros + conteúdo. */
```

- [ ] **Step 2: Rota em `App.tsx`**

(a) import, junto dos outros de admin:

```tsx
import { MembersPage } from './pages/admin/MembersPage'
```

(b) rota dentro do bloco `<Route element={<AdminLayout />}>`, após a de receita:

```tsx
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/receita" element={<RevenueReportPage />} />
              <Route path="/admin/membros" element={<MembersPage />} />
            </Route>
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc -b && npm run build`
Expected: ambos limpos.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/MembersPage.tsx src/components/AdminLayout.tsx src/App.tsx
git commit -m "feat(admin): tela de gestao de membros + aba na mini-nav"
```

---

## Task 8: Verificação e2e (manual, com o usuário)

> Depende da migration aplicada (Task 1 Step 3). Conferir antes.

- [ ] **Step 1: Build limpo final**

Run: `npx tsc -b && npm run build`
Expected: ambos limpos.

- [ ] **Step 2: Rodar dev e o usuário testa**

Run: `npm run dev`

Roteiro (usuário, como admin):
- [ ] aba **Membros** lista todos com papel/status corretos; wa.me clicável quando há telefone;
- [ ] **promover** um membro → vira Admin (badge muda; e ele vê área admin no próximo login dele);
- [ ] **rebaixar** esse admin → volta a Membro;
- [ ] **desativar** um membro → card esmaece + badge "Inativo"; no próximo login dele: signOut + aviso "Sua conta foi desativada. Procure a secretaria.";
- [ ] reservas do membro desativado continuam aparecendo pro admin e na Receita (nada apagado);
- [ ] **reativar** → ele loga normal de novo;
- [ ] no **próprio card** do admin logado: "Rebaixar" e "Desativar" desabilitados;
- [ ] (banco) com 1 só admin ativo, tentar rebaixá-lo/desativá-lo por outro caminho → erro "última conta de administrador ativa" exibido no `Alert`.
- [ ] (banco) membro inativo tentando reservar via API → rejeitado ("Conta inativa não pode reservar.").
- [ ] Conferência visual Prancha (desktop + mobile): mini-nav de 3 itens, cards, badges.

- [ ] **Step 3: Atualizar memória de status** após aprovação do usuário (arquivo `status-2026-06-12.md`): marcar Feature A como FEITA, anotar commit de merge.

---

## Finalização

Após e2e aprovado: usar skill `superpowers:finishing-a-development-branch` → merge `--no-ff` em `main` → push → Vercel auto-deploy → apagar branch `feat/gestao-membros`.

---

## Self-Review (checado contra o spec)

- **Coverage:** coluna `ativo` (T1) · RLS `profiles_admin_update` (T1) · trigger estendido c/ 3 travas (T1) · hardening reserva inativo (T1) · `Profile.ativo`+`Member` (T2) · `fetchMembers/setRole/setActive` (T3) · gate de conta inativa signOut+aviso (T4+T5) · `MembersPage` listar/promover/rebaixar/desativar/reativar + self-lock UI + erro no Alert + EmptyState (T6) · 3º link mini-nav + rota (T7) · verificação manual completa (T8). Todos os requisitos do spec têm tarefa.
- **Fora de escopo respeitado:** sem ban no auth, sem cancelar reservas, sem criar membro, sem editar nome/telefone de outro, sem auditoria.
- **Type consistency:** `Member`/`Role` usados igual entre `types.ts`, `api/members.ts` e `MembersPage`. `AuthState.inactiveNotice`/`clearInactiveNotice` definidos no `context.ts` e consumidos na `LoginPage`. `setRole`/`setActive` mesma assinatura em API e página.
- **Sem placeholders:** todo passo de código tem o código real.
