# Admin Reserva Datas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o admin reservar uma data pra si mesmo pelo calendário (entra pendente, conta na cota), sem perder bloquear/desbloquear — resolvido com abas `Reservar | Bloquear` no painel do admin.

**Architecture:** Refator só de frontend em `src/pages/CalendarPage.tsx`. Extrai o form de reserva (`ReservationForm`) pra reuso entre membro e admin; `AdminDatePanel` vira painel com 2 abas; a `createMutation` (que já existe e o membro usa) passa a ser disparada também pelo admin. **ZERO mudança de banco/RLS/trigger/API/tipos** (a RLS `reservations_insert_own` já permite admin reservar pra si com `user_id = auth.uid()`).

**Tech Stack:** React + TypeScript + Vite, TanStack Query, react-day-picker, Tailwind (design system "Prancha").

**Convenções deste repo:**
- **Sem framework de teste.** Verificação por tarefa = `npx tsc -b` limpo + `npm run build` limpo + (no fim) e2e manual pelo usuário.
- Branch `feat/admin-reserva-datas` a partir de `main`. Commits sem co-author.
- Estilo TS: sem ponto-e-vírgula, 2 espaços, aspas simples. Imports relativos.

---

## File Structure

| Arquivo | Cria/Altera | Responsabilidade |
|---|---|---|
| `src/pages/CalendarPage.tsx` | Altera | extrai `ReservationForm`; `ReservationPanel` reusa o form; `AdminDatePanel` ganha abas `Reservar/Bloquear` + props de reserva; wiring da `createMutation`/props no `CalendarPage` |

Nenhum arquivo novo. Nenhuma migration.

---

## Task 0: Branch

- [ ] **Step 1: Criar branch a partir de main (working tree limpo)**

```bash
git status        # confirmar limpo
git checkout -b feat/admin-reserva-datas
```

---

## Task 1: Extrair `ReservationForm` e reusar no `ReservationPanel`

**Files:**
- Modify: `src/pages/CalendarPage.tsx` (nova função `ReservationForm`; `ReservationPanel` passa a usá-la no ramo final)

**Objetivo:** isolar o corpo do `<form>` de reserva (campos convidados + observações + botão + rodapé) num componente reusável, mantendo o comportamento do membro idêntico. Os ramos de aviso (bloqueada / confirmada / já tem reserva / fora do período) **continuam** no `ReservationPanel`.

- [ ] **Step 1: Adicionar a função `ReservationForm`**

Adicionar esta função nova ao `CalendarPage.tsx` (sugestão: logo acima de `ReservationPanel`). É exatamente o `<form>` que hoje vive no ramo final do `ReservationPanel`, movido pra cá com seu próprio estado:

```tsx
/** Form de reserva (convidados + observações), reusado por membro e admin. */
function ReservationForm({
  submitting,
  error,
  onSubmit,
}: {
  submitting: boolean
  error: boolean
  onSubmit: (v: {
    num_convidados: number | null
    observacoes: string | null
  }) => void
}) {
  const [convidados, setConvidados] = useState('')
  const [obs, setObs] = useState('')

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          num_convidados: convidados ? Number(convidados) : null,
          observacoes: obs.trim() || null,
        })
      }}
    >
      {error && (
        <Alert tone="error">
          Não foi possível enviar a pré-reserva. Tente novamente.
        </Alert>
      )}
      <Field label="Número de convidados (opcional)">
        <Input
          type="number"
          min={0}
          value={convidados}
          onChange={(e) => setConvidados(e.target.value)}
        />
      </Field>
      <Field label="Observações (opcional)">
        <Textarea
          rows={3}
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          placeholder="Detalhes do evento, contato, etc."
        />
      </Field>
      <Button type="submit" loading={submitting} className="w-full">
        Solicitar pré-reserva
      </Button>
      <p className="eyebrow text-center">
        A reserva fica pendente até a confirmação do administrador.
      </p>
    </form>
  )
}
```

- [ ] **Step 2: Trocar o corpo do `ReservationPanel` pra usar `ReservationForm`**

No `ReservationPanel`, REMOVER o estado local agora morto (`const [convidados, setConvidados] = useState('')` e `const [obs, setObs] = useState('')`) e substituir o ramo final `) : (` `<form>...</form>` `)}` pelo componente. O bloco condicional final fica:

```tsx
      ) : !bookable ? (
        <Alert tone="info">Esta data está fora do período de reservas.</Alert>
      ) : (
        <ReservationForm
          submitting={submitting}
          error={error}
          onSubmit={onSubmit}
        />
      )}
```

> Os ramos `blocked` / `isConfirmed` / `existing` acima permanecem inalterados. A assinatura de props do `ReservationPanel` não muda (ele continua recebendo `submitting`, `error`, `onSubmit` e repassa pro form).

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc -b && npm run build`
Expected: limpos. Não deve sobrar import nem estado sem uso no `ReservationPanel` (conferir que `Textarea`, `Input`, `Field`, `Alert`, `Button` seguem usados — agora dentro do `ReservationForm`).

- [ ] **Step 4: Commit**

```bash
git add src/pages/CalendarPage.tsx
git commit -m "refactor(calendario): extrai ReservationForm reusavel"
```

---

## Task 2: `AdminDatePanel` com abas + wiring no `CalendarPage`

**Files:**
- Modify: `src/pages/CalendarPage.tsx` (reescrever `AdminDatePanel`; ajustar o bloco de wiring `selected && isAdmin`; opcional: descrição do PageHeader pro admin)

**Objetivo:** o painel do admin passa a ter abas `Reservar | Bloquear`. Reservar reusa `ReservationForm` (ou mostra aviso do estado); Bloquear é o conteúdo atual. A `createMutation` (já existente) passa a ser disparada pelo admin.

- [ ] **Step 1: Reescrever a função `AdminDatePanel`**

Substituir a função `AdminDatePanel` inteira (atualmente só bloqueio) por esta versão com abas. Note: a prop `error` foi renomeada pra `blockError` (evita confusão com o erro de reserva); novas props de reserva adicionadas.

```tsx
function AdminDatePanel({
  date,
  blocked,
  isConfirmed,
  bookable,
  existing,
  blocking,
  unblocking,
  blockError,
  reserving,
  reserveError,
  onBlock,
  onUnblock,
  onReserve,
}: {
  date: Date
  blocked?: BlockedDate
  isConfirmed: boolean
  bookable: boolean
  existing?: Reservation
  blocking: boolean
  unblocking: boolean
  blockError: string | null
  reserving: boolean
  reserveError: boolean
  onBlock: (motivo: string) => void
  onUnblock: () => void
  onReserve: (v: {
    num_convidados: number | null
    observacoes: string | null
  }) => void
}) {
  const [motivo, setMotivo] = useState('')
  // Aba default: Reservar quando a data é reservável e está livre; senão Bloquear.
  const [tab, setTab] = useState<'reservar' | 'bloquear'>(
    bookable && !isConfirmed && !blocked ? 'reservar' : 'bloquear',
  )

  return (
    <Card className="space-y-4">
      <div>
        <Eyebrow>Data escolhida</Eyebrow>
        <h2 className="font-display text-2xl capitalize text-granada">
          {formatLong(date)}
        </h2>
      </div>

      <div className="flex gap-6 border-b border-linha">
        <AdminPanelTab active={tab === 'reservar'} onClick={() => setTab('reservar')}>
          Reservar
        </AdminPanelTab>
        <AdminPanelTab active={tab === 'bloquear'} onClick={() => setTab('bloquear')}>
          Bloquear
        </AdminPanelTab>
      </div>

      {tab === 'reservar' ? (
        blocked ? (
          <Alert tone="info">Indisponível (bloqueada): {blocked.motivo}</Alert>
        ) : isConfirmed ? (
          <Alert tone="info">Esta data já está confirmada para um evento.</Alert>
        ) : existing ? (
          <Alert tone="success">
            Você já tem uma reserva ({existing.status}) nesta data. Acompanhe em
            “Minhas reservas”.
          </Alert>
        ) : !bookable ? (
          <Alert tone="info">Esta data está fora do período de reservas.</Alert>
        ) : (
          <ReservationForm
            submitting={reserving}
            error={reserveError}
            onSubmit={onReserve}
          />
        )
      ) : blocked ? (
        <>
          <Alert tone="info">Bloqueada: {blocked.motivo}</Alert>
          <Button
            variant="outline"
            onClick={onUnblock}
            loading={unblocking}
            className="w-full"
          >
            Desbloquear data
          </Button>
        </>
      ) : isConfirmed ? (
        <Alert tone="info">
          Esta data tem uma reserva confirmada e não pode ser bloqueada.
        </Alert>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!motivo.trim()) return
            onBlock(motivo.trim())
          }}
        >
          {blockError && <Alert tone="error">{blockError}</Alert>}
          <Field label="Motivo do bloqueio">
            <Input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Feriado, manutenção, evento da Loja…"
              required
            />
          </Field>
          <Button type="submit" loading={blocking} className="w-full">
            Bloquear data
          </Button>
          <p className="eyebrow text-center">
            O membro verá a data indisponível, com este motivo.
          </p>
        </form>
      )}
    </Card>
  )
}

/** Aba do painel do admin (mesma linguagem da mini-nav admin). */
function AdminPanelTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-1 py-2 font-mono text-xs uppercase tracking-[0.12em] transition-colors ${
        active ? 'text-granada' : 'text-tinta-mid hover:text-granada'
      }`}
    >
      {children}
      {active && (
        <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-ouro" />
      )}
    </button>
  )
}
```

- [ ] **Step 2: Atualizar o wiring do admin no `CalendarPage`**

Substituir o bloco atual:

```tsx
      {selected && isAdmin && (
        <AdminDatePanel
          date={selected}
          blocked={blockedOn(selected)}
          isConfirmed={isConfirmed(selected)}
          blocking={blockMutation.isPending}
          unblocking={unblockMutation.isPending}
          error={blockError}
          onBlock={(motivo) =>
            blockMutation.mutate({ data: toISODate(selected), motivo })
          }
          onUnblock={() => unblockMutation.mutate(toISODate(selected))}
        />
      )}
```

por (note o `key` pra remontar/reset por data, e as novas props de reserva):

```tsx
      {selected && isAdmin && (
        <AdminDatePanel
          key={toISODate(selected)}
          date={selected}
          blocked={blockedOn(selected)}
          isConfirmed={isConfirmed(selected)}
          bookable={isBookable(selected)}
          existing={myReservationOn(selected)}
          blocking={blockMutation.isPending}
          unblocking={unblockMutation.isPending}
          blockError={blockError}
          reserving={createMutation.isPending}
          reserveError={createMutation.isError}
          onBlock={(motivo) =>
            blockMutation.mutate({ data: toISODate(selected), motivo })
          }
          onUnblock={() => unblockMutation.mutate(toISODate(selected))}
          onReserve={(values) =>
            createMutation.mutate({
              data: toISODate(selected),
              num_convidados: values.num_convidados,
              observacoes: values.observacoes,
            })
          }
        />
      )}
```

> `isBookable`, `myReservationOn`, `createMutation`, `isConfirmed`, `blockedOn`, `toISODate` já existem no escopo do `CalendarPage`. A `createMutation.onSuccess` já invalida `availability` + `my-reservations` e faz `setSelected(undefined)` — serve igual pro admin.

- [ ] **Step 3 (opcional, recomendado): descrição do PageHeader pro admin**

No `PageHeader`, trocar a descrição do ramo admin pra refletir a nova ação:

```tsx
        description={
          isAdmin
            ? 'Toque uma data para reservar, bloquear ou liberar o salão.'
            : 'As reservas abrem 60 dias antes e fecham 3 dias antes do evento.'
        }
```

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc -b && npm run build`
Expected: limpos. Conferir que não restou referência à antiga prop `error=` do `AdminDatePanel` (agora `blockError`).

- [ ] **Step 5: Commit**

```bash
git add src/pages/CalendarPage.tsx
git commit -m "feat(calendario): admin reserva pra si via abas Reservar/Bloquear"
```

---

## Task 3: Verificação e2e (manual, com o usuário)

> Zero banco; nada pra aplicar no SQL Editor. Só rodar e testar.

- [ ] **Step 1: Build limpo final**

Run: `npx tsc -b && npm run build`
Expected: ambos limpos.

- [ ] **Step 2: `npm run dev` e o usuário testa**

Roteiro (como **admin**):
- [ ] data livre dentro da janela (4–60 dias) → painel abre na aba **Reservar**; enviar → vira **pendente**; aparece em "Minhas reservas" do admin e na fila pendente da Secretaria; confirmar lá → entra na Receita/cota;
- [ ] aba **Bloquear** funciona como antes (bloquear/desbloquear);
- [ ] data **confirmada** → Reservar avisa "já confirmada para um evento"; Bloquear avisa "não pode bloquear";
- [ ] data **bloqueada** → Reservar avisa "Indisponível (bloqueada): …"; Bloquear oferece **Desbloquear**;
- [ ] data **fora da janela** (ex.: amanhã, ou 90 dias) → Reservar avisa "fora do período"; Bloquear funciona (bloqueio não depende da janela);
- [ ] data onde o admin **já tem reserva** → Reservar mostra "Você já tem uma reserva (status)…", não duplica;
- [ ] trocar de data sem enviar → aba/campos resetam (efeito do `key`).

Roteiro (como **membro**): `ReservationPanel` idêntico ao de antes (o refator não muda comportamento) — reservar data livre, ver avisos de bloqueada/confirmada/fora da janela.

- [ ] **Step 3:** Conferência visual Prancha das abas no painel (desktop + mobile).

- [ ] **Step 4:** Após aprovação do usuário, atualizar memória de status (Feature B feita + commit de merge).

---

## Finalização

Após e2e aprovado: skill `superpowers:finishing-a-development-branch` → merge `--no-ff` em `main` → push → Vercel auto-deploy → apagar branch `feat/admin-reserva-datas`.

---

## Self-Review (checado contra o spec)

- **Coverage:** reserva do admin só pra si via `user_id = auth.uid()` (createMutation usa `userId = session.user.id`) ✓; entra pendente (trigger `validate_reservation_insert` força status) ✓; abas `Reservar | Bloquear` ✓; aba default = `bookable && !isConfirmed && !blocked` ✓; `ReservationForm` extraído e reusado (membro + admin) ✓; ramos de aviso por estado conforme a tabela de bordas do spec ✓; zero banco/API/tipos ✓; membro inalterado ✓.
- **Bordas (tabela do spec):** livre/janela → form; bloqueada → Reservar avisa indisponível / Bloquear desbloqueia; confirmada → Reservar avisa / Bloquear avisa; fora da janela → Reservar avisa / Bloquear form; já tem reserva → Reservar avisa. Todas cobertas no ramo condicional do `AdminDatePanel`.
- **Type consistency:** `ReservationForm` props (`submitting`/`error`/`onSubmit`) iguais entre uso no `ReservationPanel` e no `AdminDatePanel`. `onReserve` no `AdminDatePanel` casa com a forma `{ num_convidados, observacoes }` da `createMutation`. Prop renomeada `error`→`blockError` atualizada no wiring.
- **Sem placeholders:** todo passo tem o código real.
- **Extra além do spec (justificado):** `key={toISODate(selected)}` no `AdminDatePanel` — necessário pra aba default e estado do form resetarem ao trocar de data; corrige bug latente de estado preso. Baixo risco.
