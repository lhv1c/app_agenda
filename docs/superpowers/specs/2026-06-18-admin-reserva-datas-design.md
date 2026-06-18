# Admin reserva datas (pra si mesmo)

**Data:** 2026-06-18
**Origem:** surgiu no brainstorming de "Gestão de membros" — o admin hoje não
consegue reservar pelo app, só bloquear. Tratada como feature independente
(spec separado).

## Problema

No `CalendarPage`, quando o usuário é admin, só renderiza o `AdminDatePanel`
(bloquear/desbloquear). O `ReservationPanel` nunca aparece pro admin →
**o admin não consegue reservar o salão pra si pelo app**, mesmo sendo irmão da
Loja como qualquer outro.

No banco **não há trava**: a RLS `reservations_insert_own`
(`with check user_id = auth.uid()`) já permitiria o admin reservar pra si. Falta
só a UI.

## Objetivo

Deixar o admin **reservar uma data pra si mesmo** pelo calendário, sem perder o
acesso a bloquear/desbloquear. Mesma data, dois usos possíveis (reservar OU
bloquear) → resolver com **abas** no painel do admin.

## Decisões do brainstorming (aprovadas)

- Reserva do admin é **só pra si mesmo** (não reserva em nome de terceiros).
- Entra como **pendente**, mesmo fluxo do membro: aparece na aba "Reservas"
  dele, ele confirma depois na Secretaria, conta na receita/cota normalmente.
- UI = **`AdminDatePanel` ganha abas `Reservar | Bloquear`**.
- **Banco: ZERO mudança** (RLS + trigger `validate_reservation_insert` já
  cobrem; a reserva é `user_id = auth.uid()`).
- Aba **default**: "Reservar" se a data for reservável (dentro da janela 4–60) e
  livre; senão "Bloquear".
- **Refatorar:** extrair o form de reserva pra um componente reusado entre
  membro e admin.

## Arquitetura

> **Sem migration.** Tudo no frontend, no `src/pages/CalendarPage.tsx`.

### Refator: extrair o form de reserva

O corpo do `<form>` interno do `ReservationPanel` (campos nº convidados +
observações, botão "Solicitar pré-reserva", rodapé eyebrow) vira um componente
reusável — `ReservationForm` — que recebe `submitting`, `error`, `onSubmit`.

- `ReservationPanel` (membro) passa a usar `ReservationForm` no seu ramo final
  (o que hoje renderiza o `<form>`). Os ramos de aviso (bloqueada / confirmada /
  já tem reserva / fora do período) **permanecem** no `ReservationPanel`.
- O painel do admin usa o **mesmo** `ReservationForm` na aba "Reservar".

> Pode-se manter o `ReservationForm` no próprio `CalendarPage.tsx` (mesmo
> arquivo) — não precisa novo arquivo, só desacoplar a função.

### Painel do admin com abas

`AdminDatePanel` passa a renderizar um cabeçalho de **2 abas** (no padrão
Prancha — pílulas/sublinhado ouro no ativo, mesma linguagem da mini-nav admin):

- **Reservar** — reusa `ReservationForm` quando a data é reservável e livre;
  senão mostra o aviso do estado (ver bordas). Submit → `createReservation`
  (mesma `createMutation` que o membro já usa; passa a ser disparada pro admin
  também).
- **Bloquear** — o conteúdo atual do `AdminDatePanel` (form de motivo /
  desbloquear / aviso de confirmada).

**Aba default ao selecionar a data:**
`bookable && !isConfirmed && !blocked` → "Reservar"; caso contrário →
"Bloquear".

### Bordas (por aba)

Reusar os mesmos helpers já existentes (`isBookable`, `isConfirmed`,
`blockedOn`, `myReservationOn`).

| Estado da data | Aba Reservar | Aba Bloquear |
|---|---|---|
| Livre, dentro da janela 4–60 | form de reserva | form de motivo |
| Bloqueada | aviso "Indisponível (bloqueada): {motivo}" | desbloquear |
| Confirmada | aviso "Já confirmada para um evento" | aviso "não pode bloquear (confirmada)" |
| Fora da janela 4–60 | aviso "Fora do período de reservas" | form de motivo (bloqueio não depende da janela) |
| Admin já tem reserva nessa data | aviso "Você já tem uma reserva ({status}) nesta data" | normal |

### Wiring no `CalendarPage`

- Hoje `selected && isAdmin` → só `AdminDatePanel`; `selected && !isAdmin` → só
  `ReservationPanel`. Passa a: admin → `AdminDatePanel` (com abas, que inclui
  reservar); membro → `ReservationPanel` (inalterado).
- A `createMutation` já existe e invalida `availability` + `my-reservations`;
  passa a ser usada também pela aba Reservar do admin. `userId` já é
  `session.user.id` (o admin).
- A query `myReservationsQuery` já roda pro admin (mesma `userId`), então
  `myReservationOn(selected)` funciona pro admin sem mudança.

## Componentes (resumo de responsabilidade)

| Arquivo | Responsabilidade |
|---|---|
| `src/pages/CalendarPage.tsx` (alterado) | extrair `ReservationForm`; `AdminDatePanel` com abas `Reservar/Bloquear`; wiring da `createMutation` pro admin |

> Nenhum arquivo novo obrigatório; nenhuma mudança de banco, API ou tipos.

## Fora de escopo

- Admin reservar **em nome de outro** irmão (só pra si).
- Admin reserva entrar já confirmada / pular a fila (entra pendente).
- Mudar a janela de reserva (4–60) pro admin (mesma regra do membro).
- Qualquer mudança no banco/RLS/trigger.

## Testes / verificação

- `tsc -b` + `npm run build` limpos.
- Manual (admin):
  - selecionar data livre dentro da janela → abre na aba "Reservar"; enviar →
    vira pendente; aparece em "Minhas reservas" do admin e na fila pendente da
    Secretaria; admin confirma → conta na receita/cota;
  - alternar pra aba "Bloquear" e bloquear/desbloquear como antes;
  - data confirmada → Reservar avisa "já confirmada", Bloquear avisa "não pode";
  - data bloqueada → Reservar avisa indisponível, Bloquear oferece desbloquear;
  - data fora da janela → Reservar avisa "fora do período", Bloquear funciona;
  - data onde o admin já tem reserva → Reservar avisa, não duplica.
- Manual (membro): `ReservationPanel` segue idêntico (refator não muda
  comportamento).
- Conferência visual (Prancha) das abas no painel, desktop + mobile.
