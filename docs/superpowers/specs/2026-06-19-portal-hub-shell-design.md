# Portal da Loja — Shell do hub (Módulo 0)

**Data:** 2026-06-19
**Status:** Design aprovado, pronto pra virar plano

## Contexto e objetivo

O app hoje é uma agenda de reserva do salão. A visão de longo prazo é virar um
**portal completo da Loja** (Loja Maçônica Ciência e Justiça, Marialva), com vários
módulos além da agenda (comunicados, mensalidades, diretório etc.).

Este spec cobre **apenas o Módulo 0: o shell do portal** — a casca de navegação que
transforma o app de "uma agenda" em "um hub de módulos", tendo a **Agenda como único
módulo existente** (já construída). Nenhum módulo novo é desenhado aqui. Cada módulo
futuro terá seu próprio ciclo spec → plano → implementação quando for priorizado.

Decisão de produto que originou o recorte: não desenhar/prometer módulos que não existem.
Construir a casca, provar o padrão de portal com a Agenda, e crescer módulo a módulo.

## Fora de escopo

- Qualquer módulo novo: Comunicados, Mensalidades, Aniversários, Diretório, Grau,
  Documentos. Ficam como backlog; cada um vira seu próprio spec depois.
- Mudanças de banco, API, notify (e-mail), receita/cota. **Zero** alteração nessas camadas.
- Modelo de permissão: segue **admin/member** como está. Grau (Aprendiz/Companheiro/Mestre),
  quando entrar, será só rótulo no perfil — não há dimensão de permissão nova neste spec.
- Gate de conta inativa: inalterado.

## Decisões fechadas (brainstorming)

1. **Hub com cards.** Nova tela inicial (Home) com grid de cards por módulo. Vira portal
   de verdade, escala bem. (Alternativas descartadas: menu "Loja" com submenu; decidir
   navegação módulo a módulo.)
2. **TabBar enxuta:** passa de `Calendário · Reservas · (+Admin) · Perfil` para
   **`Home · (+Admin) · Perfil`** (mantém `Perfil` por último e `Admin` condicional,
   como hoje).
3. **Agenda = 1 card**, com abas internas `Calendário | Minhas Reservas` (não dois cards
   separados). Casa com "Agenda = módulo".
4. **Hub mostra só o card Agenda agora.** Sem placeholders "Em breve" — não promete o que
   não existe. Cards nascem quando o módulo nascer.
5. **`+Admin` continua como tab** (não vira card). A área admin é gestão transversal
   (Secretaria · Receita · Membros), não um módulo do hub. Permanece intacta.
6. Identidade visual **Prancha** mantida; cards reusam o padrão `plaque` existente.

## Arquitetura

### Navegação resultante

```
TabBar:  Home · Perfil · (+Admin se isAdmin)

/home              → HomePage (hub de cards)  ← landing pós-login
/agenda            → redirect /agenda/calendario
/agenda/calendario → AgendaLayout > CalendarPage
/agenda/minhas-reservas → AgendaLayout > MyReservationsPage
/perfil            → ProfilePage          (inalterado)
/admin/*           → AdminLayout > ...     (inalterado)
/                  → redirect /home
```

### Componentes novos

**`HomePage`** (`src/pages/HomePage.tsx`)
- Propósito: hub. Header (nome da Loja) + grid de cards de módulo.
- Por enquanto renderiza **um** card: Agenda → linka pra `/agenda`.
- Card de módulo = elemento clicável no padrão `plaque` (`Card` de `ui.tsx`), com ícone +
  nome. Reusa o `CalendarIcon` que já existe no `TabBar` (extrair pra lugar compartilhável,
  ver nota de refactor abaixo) ou um ícone próprio.
- Estrutura pronta pra crescer: lista de cards declarativa (array de `{ to, label, icon,
  adminOnly? }`) de modo que adicionar módulo futuro seja acrescentar um item. Mantém YAGNI
  — não cria abstração além de um array simples.

**`AgendaLayout`** (`src/components/AgendaLayout.tsx`)
- Propósito: casca da área Agenda com mini-nav de abas `Calendário · Minhas Reservas`.
- **Espelha o `AdminLayout` existente** (mesmo `tabClass`, mesmo padrão `NavLink` +
  `Outlet`, mesmo filete `border-b border-linha` e sublinhado ouro). Reaproveita o padrão
  visual já provado.

### Componentes modificados

**`App.tsx`**
- Trocar as rotas de topo. Hoje:
  - `/` → `CalendarPage`
  - `/minhas-reservas` → `MyReservationsPage`
- Passa a:
  - `/home` → `HomePage`
  - `/agenda` (com `AgendaLayout`) aninhando `calendario` (index) e `minhas-reservas`
  - `/perfil`, `/admin/*` inalterados
  - `/` → `<Navigate to="/home" replace />`
  - catch-all `*` → `/home` (era `/`)
- `CalendarPage` e `MyReservationsPage` **não mudam de conteúdo/lógica** — só passam a ser
  filhas do `AgendaLayout` em rotas novas.

**`TabBar`** (`src/components/TabBar.tsx`)
- Remover os tabs `Calendário` (`/`) e `Reservas` (`/minhas-reservas`).
- Adicionar tab `Home` (`/home`). Ícone novo (casa/colmeia/diamante no estilo Prancha) ou
  reaproveitar um existente.
- Ordem final: `Home · (Admin se isAdmin) · Perfil`. Mantém `Perfil` por último como hoje.
- `CalendarIcon`/`BookmarkIcon` deixam de ser usados aqui; podem ser extraídos pra um módulo
  de ícones compartilhado se a Home precisar do `CalendarIcon` no card Agenda (ver nota).

### Nota de refactor (alvo, mínimo)

O `CalendarIcon` vive hoje dentro de `TabBar.tsx`. Se a Home quiser o mesmo ícone no card
Agenda, extrair os ícones SVG pra um arquivo compartilhado (ex.: `src/components/icons.tsx`)
e importar nos dois. Refactor pequeno e a serviço do objetivo — não mexer em mais nada.

## Fluxo do usuário

- **Pós-login** → cai na **Home**. Vê o card Agenda.
- Toca **Agenda** → área Agenda abre na aba **Calendário**. Alterna pra **Minhas Reservas**
  pela mini-nav. Mesmo comportamento de hoje, só reorganizado.
- **Perfil** e **Admin** seguem acessíveis pela TabBar como hoje.
- Membro inativo: gate inalterado (signOut + aviso no login).

## Tratamento de erros / bordas

- **Deep links antigos** (`/`, `/minhas-reservas`) precisam continuar funcionando pra não
  quebrar PWA instalado / favoritos. `/` já redireciona pra `/home`. Adicionar redirect de
  `/minhas-reservas` → `/agenda/minhas-reservas` (e o catch-all cobre o resto). Decisão:
  manter os redirects pelo menos nesta versão.
- **SPA rewrite** (`vercel.json`) já cobre deep links em prod; rotas novas não dão 404.
- Rota `/agenda` sem sub-rota → redirect pra `/agenda/calendario` (index route).

## Testes / verificação

Sem mudança de banco/API, a verificação é de navegação e visual:
- `tsc -b` + build limpos.
- Login leva à Home; card Agenda visível.
- Agenda abre em Calendário; aba Minhas Reservas funciona; reservar/aprovar fluxo intacto.
- TabBar mostra `Home · Perfil` (membro) e `Home · Admin · Perfil` (admin).
- Deep links `/` e `/minhas-reservas` redirecionam certo.
- Identidade Prancha intacta (cards, abas, header) — conferir via screenshot.
- Teste e2e manual pelo usuário no dev antes do merge (padrão do projeto).

## Crescimento futuro (referência, não escopo)

Quando um módulo novo entrar: acrescenta um card no array da `HomePage`, cria a área do
módulo (layout próprio se tiver sub-abas, espelhando `AgendaLayout`/`AdminLayout`), e seu
spec/plano próprios. Backlog de módulos levantados: Comunicados, Mensalidades (nível "livro
manual" recomendado — sem boleto/gateway), Aniversários, Diretório, Grau (rótulo),
Documentos.

---

## Addendum 2026-06-19 — refinamento pós-implementação (aprovado e implementado)

Após a 1ª versão funcionar, três ajustes pedidos pelo usuário (na mesma branch):

1. **Card quadrado e reusável.** Extraído `src/components/ModuleCard.tsx` (tile `aspect-square`:
   ícone + título + subtítulo, centralizado), usado tanto na Home quanto no hub de admin.
   Home: card **Agenda** / "Salão Cristiano Cano". Grid `grid-cols-2`.

2. **Área admin vira hub de cards** (mesma lógica do portal: cada módulo tem sua função de
   admin; o que é do app inteiro fica separado).
   - `/admin` → `AdminHomePage` (cards): **Agenda** / "Secretaria e receita" · **Membros** /
     "Gestão de irmãos" (`UsersIcon` novo).
   - `/admin/agenda` → `AdminAgendaLayout` (abas **Secretaria · Receita**) aninhando
     `secretaria` (`AdminDashboardPage`) e `receita` (`RevenueReportPage`); index → secretaria.
   - `/admin/membros` → `MembersPage` standalone (sem abas; é app-wide).
   - Redirect deep link antigo `/admin/receita` → `/admin/agenda/receita`.
   - `AdminLayout.tsx` (mini-nav antiga Secretaria·Receita·Membros) **removido**.
   - Volta pro hub admin pela tab Admin.

3. **Header forma B** — `Header` global = identidade da **Loja**: "Ciência e Justiça" (granada)
   / "Loja Maçônica" (ouro) / "Oriente de Marialva" (eyebrow). O título da agenda
   ("Agenda do Salão / Irmão Cristiano Cano") desceu pro topo da área Agenda, via `PageHeader`
   dentro do `AgendaLayout` (acima das abas).
   - Consequência: a Home não repete mais a identidade da Loja — `PageHeader` da Home virou
     eyebrow "Portal da Loja" / título **"Módulos"** (evita duplicar o nome que agora vive no Header).
