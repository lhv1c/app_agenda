# Shell do Portal/Hub (Módulo 0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o app numa casca de portal: tela Home (hub) com card Agenda, TabBar enxuta, e a Agenda reorganizada em abas internas — sem mexer em banco/API/lógica.

**Architecture:** Reaproveita os padrões existentes. Um `AgendaLayout` espelha o `AdminLayout` (abas via `NavLink`/`Outlet`). A `HomePage` renderiza um grid de cards a partir de um array declarativo (só Agenda por enquanto). `App.tsx` ganha rotas `/home` e `/agenda/*` aninhadas, com redirects dos deep links antigos. Ícones SVG saem do `TabBar` pra um módulo compartilhado.

**Tech Stack:** React 19, react-router-dom 7, Tailwind 4 (tokens Prancha), Vite. Sem suite de teste automatizado — verificação por `npm run build` (`tsc -b && vite build`) + `npm run lint` + e2e manual.

---

## Notas de contexto pro implementador

- **Tokens Prancha** (Tailwind): cores `granada`, `ouro`, `tinta-mid`, `pergaminho-2`, borda `linha`; classe utilitária `plaque` (card com borda/sombra Prancha); `eyebrow` (rótulo small-caps); fontes `font-display`, `font-body`, `font-mono`. Não inventar tokens novos — usar só esses.
- **Padrão de layout de área com abas:** ver `src/components/AdminLayout.tsx` (já no repo). O `AgendaLayout` copia esse padrão trocando os destinos.
- **Componentes UI prontos** em `src/components/ui.tsx`: `PageHeader({ eyebrow, title, description })`, `Card`.
- O conteúdo/lógica de `CalendarPage` e `MyReservationsPage` **não muda** — elas só passam a ser filhas do `AgendaLayout` em rotas novas.
- Banco, API (`src/api/*`), notify e receita: **não tocar**.

## Estrutura de arquivos

- **Criar** `src/components/icons.tsx` — ícones SVG compartilhados (`CalendarIcon`, `HomeIcon`, `ShieldIcon`, `UserIcon`). Hoje vivem inline no `TabBar`.
- **Criar** `src/components/AgendaLayout.tsx` — casca da área Agenda (abas Calendário · Minhas Reservas).
- **Criar** `src/pages/HomePage.tsx` — hub com grid de cards (só Agenda).
- **Modificar** `src/App.tsx` — rotas `/home`, `/agenda/*`, redirects de deep link antigo, catch-all → `/home`.
- **Modificar** `src/components/TabBar.tsx` — passa a `Início · (Admin) · Perfil`, importando ícones de `icons.tsx`.

Ordem das tasks garante build limpo a cada commit: ícones e layouts existem antes de `App.tsx` referenciá-los; `App.tsx` cria `/home` e os redirects antes do `TabBar` apontar pra eles.

---

### Task 1: Ícones compartilhados

**Files:**
- Create: `src/components/icons.tsx`

- [ ] **Step 1: Criar o arquivo de ícones**

Criar `src/components/icons.tsx` com o conteúdo completo abaixo. `CalendarIcon`, `ShieldIcon`, `UserIcon` são cópias exatas dos SVGs que hoje estão em `src/components/TabBar.tsx`; `HomeIcon` é novo.

```tsx
export function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden>
      <rect x="3" y="4.5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 9h18M8 3v3M16 3v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden>
      <path
        d="M4 11l8-6 8 6M6 10v9h12v-9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden>
      <path
        d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9.5 12l1.8 1.8L15 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: PASS (compila; arquivo novo, sem quebrar nada existente).

- [ ] **Step 3: Commit**

```bash
git add src/components/icons.tsx
git commit -m "feat(icons): modulo compartilhado de icones SVG (+HomeIcon)"
```

---

### Task 2: AgendaLayout (abas da área Agenda)

**Files:**
- Create: `src/components/AgendaLayout.tsx`

- [ ] **Step 1: Criar o AgendaLayout**

Criar `src/components/AgendaLayout.tsx`. Espelha `src/components/AdminLayout.tsx` (mesmas classes/estrutura), trocando os destinos pras abas da Agenda.

```tsx
import { NavLink, Outlet } from 'react-router-dom'

const tabClass =
  'relative px-1 py-2 font-mono text-xs uppercase tracking-[0.12em] transition-colors'

function AgendaTab({ to, label, end }: { to: string; label: string; end?: boolean }) {
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

/** Casca da área Agenda: abas Calendário / Minhas Reservas + conteúdo. */
export function AgendaLayout() {
  return (
    <div className="space-y-6">
      <nav className="flex gap-6 border-b border-linha">
        <AgendaTab to="/agenda/calendario" label="Calendário" end />
        <AgendaTab to="/agenda/minhas-reservas" label="Minhas Reservas" />
      </nav>
      <Outlet />
    </div>
  )
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/AgendaLayout.tsx
git commit -m "feat(agenda): AgendaLayout com abas Calendario/Minhas Reservas"
```

---

### Task 3: HomePage (hub de cards)

**Files:**
- Create: `src/pages/HomePage.tsx`

- [ ] **Step 1: Criar a HomePage**

Criar `src/pages/HomePage.tsx`. Grid de cards a partir de um array declarativo — só Agenda por enquanto; adicionar módulo futuro = acrescentar item no array. Cada card é um `Link` no estilo `plaque`.

```tsx
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { PageHeader } from '../components/ui'
import { CalendarIcon } from '../components/icons'

type ModuleCard = {
  to: string
  label: string
  description: string
  icon: ReactNode
}

const modules: ModuleCard[] = [
  {
    to: '/agenda',
    label: 'Agenda',
    description: 'Reserva do salão e suas reservas',
    icon: <CalendarIcon />,
  },
]

export function HomePage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Portal da Loja" title="Ciência e Justiça" />
      <div className="grid gap-4 sm:grid-cols-2">
        {modules.map((m) => (
          <Link
            key={m.to}
            to={m.to}
            className="plaque flex items-center gap-4 p-5 transition-colors hover:border-ouro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro"
          >
            <span className="shrink-0 text-granada">{m.icon}</span>
            <span className="min-w-0">
              <span className="block font-display text-xl font-semibold text-granada">
                {m.label}
              </span>
              <span className="block font-body text-sm text-tinta-mid">
                {m.description}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/pages/HomePage.tsx
git commit -m "feat(home): hub do portal com card Agenda"
```

---

### Task 4: Rotas do App (hub + área Agenda + redirects)

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Reescrever App.tsx**

Substituir o conteúdo de `src/App.tsx` pelo abaixo. Mudanças vs. atual: adiciona imports `HomePage` e `AgendaLayout`; remove import direto de `CalendarPage`/`MyReservationsPage` no topo? Não — elas continuam importadas (são filhas do AgendaLayout). Rotas novas: `/home`, `/agenda` (index → `/agenda/calendario`, mais `calendario` e `minhas-reservas`); redirects de `/` e `/minhas-reservas`; catch-all → `/home`.

```tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { RecoverPasswordPage } from './pages/RecoverPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { HomePage } from './pages/HomePage'
import { AgendaLayout } from './components/AgendaLayout'
import { CalendarPage } from './pages/CalendarPage'
import { MyReservationsPage } from './pages/MyReservationsPage'
import { ProfilePage } from './pages/ProfilePage'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { AdminLayout } from './components/AdminLayout'
import { RevenueReportPage } from './pages/admin/RevenueReportPage'
import { MembersPage } from './pages/admin/MembersPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cadastro" element={<SignupPage />} />
      <Route path="/recuperar-senha" element={<RecoverPasswordPage />} />
      <Route path="/redefinir-senha" element={<ResetPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/home" element={<HomePage />} />

          <Route path="/agenda" element={<AgendaLayout />}>
            <Route index element={<Navigate to="/agenda/calendario" replace />} />
            <Route path="calendario" element={<CalendarPage />} />
            <Route path="minhas-reservas" element={<MyReservationsPage />} />
          </Route>

          <Route path="/perfil" element={<ProfilePage />} />

          <Route element={<AdminRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/receita" element={<RevenueReportPage />} />
              <Route path="/admin/membros" element={<MembersPage />} />
            </Route>
          </Route>

          {/* Deep links antigos: nao quebrar PWA instalado / favoritos */}
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/minhas-reservas" element={<Navigate to="/agenda/minhas-reservas" replace />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  )
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Smoke test manual no dev**

Run: `npm run dev`
Conferir no browser (logado):
- `/home` mostra o card Agenda.
- Clicar Agenda → cai em `/agenda/calendario`; aba Minhas Reservas alterna pra `/agenda/minhas-reservas`.
- `/` redireciona pra `/home`; `/minhas-reservas` redireciona pra `/agenda/minhas-reservas`.
Expected: tudo OK. (A TabBar ainda mostra os tabs antigos — corrigido na Task 5; os links antigos funcionam via redirect.)

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(routes): rota /home e area /agenda com abas + redirects dos deep links antigos"
```

---

### Task 5: TabBar enxuta

**Files:**
- Modify: `src/components/TabBar.tsx`

- [ ] **Step 1: Reescrever TabBar.tsx**

Substituir o conteúdo de `src/components/TabBar.tsx` pelo abaixo. Remove as definições inline de ícones (agora vêm de `icons.tsx`) e o `BookmarkIcon` (não usado mais). Tabs finais: `Início` (`/home`) · `Admin` (só admin) · `Perfil`. `Perfil` segue por último.

```tsx
import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/context'
import { HomeIcon, ShieldIcon, UserIcon } from './icons'

const itemClass =
  'relative flex flex-1 flex-col items-center justify-center gap-1 py-3'
const labelClass = 'font-mono text-[0.625rem] uppercase tracking-[0.08em]'

function Tab({
  to,
  icon,
  label,
}: {
  to: string
  icon: ReactNode
  label: string
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `${itemClass} transition-colors ${isActive ? 'text-granada' : 'text-tinta-mid'}`
      }
    >
      {({ isActive }) => (
        <>
          {icon}
          <span className={labelClass}>{label}</span>
          {isActive && (
            <span className="absolute bottom-1.5 h-0.5 w-5 rounded-full bg-ouro" />
          )}
        </>
      )}
    </NavLink>
  )
}

export function TabBar() {
  const { isAdmin } = useAuth()

  return (
    <div className="fixed inset-x-0 bottom-4 z-20 flex justify-center px-4 pb-[env(safe-area-inset-bottom)]">
      <nav className="flex w-full max-w-sm items-stretch rounded-full border border-linha bg-pergaminho-2/95 px-2 shadow-[0_4px_16px_rgb(36_31_26_/0.12)] backdrop-blur">
        <Tab to="/home" icon={<HomeIcon />} label="Início" />
        {isAdmin && <Tab to="/admin" icon={<ShieldIcon />} label="Admin" />}
        <Tab to="/perfil" icon={<UserIcon />} label="Perfil" />
      </nav>
    </div>
  )
}
```

- [ ] **Step 2: Verificar build e lint**

Run: `npm run build`
Expected: PASS.

Run: `npm run lint`
Expected: PASS (sem ícones órfãos / imports não usados).

- [ ] **Step 3: Commit**

```bash
git add src/components/TabBar.tsx
git commit -m "feat(nav): TabBar enxuta Inicio/Admin/Perfil; icones de icons.tsx"
```

---

### Task 6: Verificação final e2e

**Files:** (nenhum — só verificação)

- [ ] **Step 1: Build e lint limpos**

Run: `npm run build`
Expected: PASS.

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 2: Checklist e2e manual no dev (usuário valida)**

Run: `npm run dev`

Conferir:
- Login (membro) → cai na **Home**; vê card Agenda; TabBar = `Início · Perfil`.
- Login (admin) → TabBar = `Início · Admin · Perfil`.
- Card Agenda → abre `/agenda/calendario`; aba **Minhas Reservas** funciona; reservar/cancelar fluxo intacto; admin: bloquear/reservar no calendário intacto.
- `Admin` (tab) → Secretaria/Receita/Membros intactos.
- `Perfil` intacto.
- Deep links: `/` → `/home`; `/minhas-reservas` → `/agenda/minhas-reservas`; rota inexistente → `/home`.
- Membro inativo: gate (signOut + aviso no login) inalterado.
- Visual Prancha intacto (cards, abas, header) — conferir em tela estreita (mobile) também.

Expected: tudo OK. Se algo falhar, corrigir antes do merge.

- [ ] **Step 3: Nada a commitar**

Task de verificação. Commits já feitos por task. Branch pronta pra merge (finishing-a-development-branch).

---

## Self-Review (preenchido na escrita do plano)

**Cobertura do spec:**
- Home/hub com cards → Task 3. ✅
- TabBar enxuta `Home · (+Admin) · Perfil` → Task 5. ✅
- Card Agenda → abas internas via `AgendaLayout` espelhando `AdminLayout` → Task 2. ✅
- Rotas `/home`, `/agenda/*`, `/` → `/home`, redirect `/minhas-reservas`, catch-all → Task 4. ✅
- `+Admin` segue tab, área admin intacta → Task 4 (rotas admin inalteradas) + Task 5 (tab Admin). ✅
- Refactor de ícones pra arquivo compartilhado → Task 1. ✅
- Zero banco/API/notify/receita → nenhuma task toca essas camadas. ✅
- Verificação (build/lint/e2e) → Task 6. ✅

**Placeholders:** nenhum — todo código está completo nos steps.

**Consistência de tipos/nomes:** `HomeIcon`/`CalendarIcon`/`ShieldIcon`/`UserIcon` definidos na Task 1 e importados nas Tasks 3 e 5 com os mesmos nomes. Rotas `/agenda/calendario` e `/agenda/minhas-reservas` usadas igual no `AgendaLayout` (Task 2) e no `App.tsx` (Task 4). ✅
