# Filtros nas reservas confirmadas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o admin filtre a lista de reservas confirmadas por irmão, mês e ano, no cliente, dentro da identidade visual Prancha.

**Architecture:** Novo componente `Select` no design system (`ui.tsx`), reutilizável, casando com `Input`. `AdminDashboardPage` ganha estado de 3 filtros (irmão/mês/ano), deriva opções da lista já carregada e filtra com `useMemo` (lógica AND). Sem query nova, sem banco, sem paginação — filtro 100% no navegador.

**Tech Stack:** React, TypeScript, TanStack Query (já em uso), Tailwind (tokens Prancha), date-fns (`fromISODate`).

Spec: `docs/superpowers/specs/2026-06-14-filtros-confirmadas-design.md`

---

## Notas de contexto (ler antes de começar)

- O projeto **não tem suíte de testes automatizados** (sem vitest/jest configurado). A verificação de cada tarefa é **typecheck + build + conferência manual no app**. Onde o template do plano pede "teste falhando", substituímos por verificação de typecheck/build e checagem visual — é a disciplina equivalente neste repo.
- Commits via **Bash tool** (não usar here-string `@'...'@` do PowerShell — ver memória `bash-heredoc-gotcha`). Sem co-author Claude (pedido do usuário). Autor já configurado no git local.
- Comandos rodam de `C:/Users/luizh/Documents/01_Projetos/01_AGENDA_APP`.
- Typecheck/build do projeto: `npm run build` (roda `tsc -b` + `vite build`). Não há script `typecheck` isolado — usar `npx tsc -b` para checagem de tipos rápida.
- `r.data` e `r.decided_at`/`r.created_at` são strings `yyyy-MM-dd`. `fromISODate(iso)` devolve `Date` local. Em cima dela, `getMonth()` (0–11) e `getFullYear()` são locais e corretos.
- `r.profile?.nome` pode ser `undefined`/`null`; o fallback de exibição é `'Irmão'`.

---

## File Structure

- **Modify** `src/components/ui.tsx` — adicionar `Select` (segue padrão de `Input`/`PasswordInput`, mesmo `fieldClass`, chevron ouro com `appearance-none`).
- **Modify** `src/pages/admin/AdminDashboardPage.tsx` — estado de filtros, derivação de opções, `useMemo` de filtragem, barra de filtro renderizada entre o `PageHeader` "Reservas confirmadas" e a lista, `EmptyState` de "sem resultado para o filtro".
- **Create** `src/lib/months.ts` — constante `MESES` (nomes pt-BR) reutilizável pelo select de mês. Pequeno módulo próprio pra não poluir `dates.ts` nem inline no componente.

Nenhum arquivo de banco/API muda. Nada na seção de pendentes muda.

---

## Task 1: Componente `Select` no design system

**Files:**
- Modify: `src/components/ui.tsx`

- [ ] **Step 1: Adicionar o tipo de import `SelectHTMLAttributes`**

No bloco de `import type { … } from 'react'` (linhas 2–7), acrescentar `SelectHTMLAttributes`:

```tsx
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from 'react'
```

- [ ] **Step 2: Adicionar o componente `Select` logo depois de `PasswordInput`**

Inserir após o fechamento de `PasswordInput` (depois da linha 87, antes de `Textarea`). Reutiliza o `fieldClass` já definido no arquivo:

```tsx
/** Select nativo estilizado no padrão Prancha, com chevron ouro próprio. */
export function Select({
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={`${fieldClass} min-h-11 cursor-pointer appearance-none pr-10 ${className}`}
        {...props}
      >
        {children}
      </select>
      <span
        className="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ouro"
        aria-hidden
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: sem erros (exit 0). Se reclamar de `Select` não usado, ignore — será usado na Task 3; `tsc` não acusa export não usado.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui.tsx
git commit -m "feat(ui): componente Select no design system Prancha"
```

---

## Task 2: Módulo de meses pt-BR

**Files:**
- Create: `src/lib/months.ts`

- [ ] **Step 1: Criar o arquivo**

```ts
/** Nomes dos meses em pt-BR, índice 0 = Janeiro (casa com Date.getMonth()). */
export const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: sem erros (exit 0).

- [ ] **Step 3: Commit**

```bash
git add src/lib/months.ts
git commit -m "feat(lib): constante MESES pt-BR"
```

---

## Task 3: Filtros na lista de confirmadas (`AdminDashboardPage`)

**Files:**
- Modify: `src/pages/admin/AdminDashboardPage.tsx`

- [ ] **Step 1: Ampliar imports**

Linha 1 — acrescentar `useState`:

```tsx
import { useMemo, useState } from 'react'
```

Linha 11 — acrescentar `Select` e `Field` ao import de `ui`:

```tsx
import { Button, Card, EmptyState, Field, PageHeader, Rule, Select, Spinner } from '../../components/ui'
```

Após o import de `phone` (linha 10), acrescentar o import de meses:

```tsx
import { MESES } from '../../lib/months'
```

- [ ] **Step 2: Estado dos filtros**

Dentro de `AdminDashboardPage`, logo após `const confirmed = confirmedQuery.data ?? []` (linha 60), adicionar:

```tsx
  // Filtros da lista de confirmadas (no cliente). "" = "Todos".
  const [filtroIrmao, setFiltroIrmao] = useState('')
  const [filtroMes, setFiltroMes] = useState('') // "1".."12"
  const [filtroAno, setFiltroAno] = useState('') // "2026" etc.

  const filtroAtivo = filtroIrmao !== '' || filtroMes !== '' || filtroAno !== ''

  function limparFiltros() {
    setFiltroIrmao('')
    setFiltroMes('')
    setFiltroAno('')
  }
```

- [ ] **Step 3: Derivar opções (nomes e anos) da lista carregada**

Logo após o bloco de estado do Step 2, adicionar:

```tsx
  // Nomes distintos que têm confirmada, ordenados (pt-BR).
  const nomesIrmaos = useMemo(() => {
    const set = new Set<string>()
    for (const r of confirmed) {
      const nome = r.profile?.nome
      if (nome) set.add(nome)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [confirmed])

  // Anos distintos das datas (mín..máx), garantindo o ano atual mesmo sem dados.
  const anosDisponiveis = useMemo(() => {
    const anos = confirmed.map((r) => fromISODate(r.data).getFullYear())
    anos.push(new Date().getFullYear())
    const min = Math.min(...anos)
    const max = Math.max(...anos)
    const range: number[] = []
    for (let y = min; y <= max; y++) range.push(y)
    return range
  }, [confirmed])
```

- [ ] **Step 4: `useMemo` de filtragem (AND)**

Logo após `anosDisponiveis`, adicionar:

```tsx
  const confirmadasFiltradas = useMemo(() => {
    return confirmed.filter((r) => {
      if (filtroIrmao && r.profile?.nome !== filtroIrmao) return false
      const d = fromISODate(r.data)
      if (filtroMes && d.getMonth() + 1 !== Number(filtroMes)) return false
      if (filtroAno && d.getFullYear() !== Number(filtroAno)) return false
      return true
    })
  }, [confirmed, filtroIrmao, filtroMes, filtroAno])
```

- [ ] **Step 5: Barra de filtro + render condicional da lista**

Na seção "Reservas confirmadas", substituir o bloco do `PageHeader` + render condicional (linhas 168–214 atuais) por:

```tsx
      <section className="space-y-5">
        <PageHeader
          as="h2"
          eyebrow="Controle da agenda"
          title="Reservas confirmadas"
        />

        {/* Barra de filtro — consulta ao arquivo da Loja. Só aparece com dados. */}
        {confirmed.length > 0 && (
          <div className="space-y-3 border-b border-ouro/30 pb-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Irmão">
                <Select
                  value={filtroIrmao}
                  onChange={(e) => setFiltroIrmao(e.target.value)}
                >
                  <option value="">Todos</option>
                  {nomesIrmaos.map((nome) => (
                    <option key={nome} value={nome}>
                      {nome}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Mês">
                <Select
                  value={filtroMes}
                  onChange={(e) => setFiltroMes(e.target.value)}
                >
                  <option value="">Todos os meses</option>
                  {MESES.map((nome, i) => (
                    <option key={nome} value={String(i + 1)}>
                      {nome}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Ano">
                <Select
                  value={filtroAno}
                  onChange={(e) => setFiltroAno(e.target.value)}
                >
                  <option value="">Todos</option>
                  {anosDisponiveis.map((ano) => (
                    <option key={ano} value={String(ano)}>
                      {ano}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {filtroAtivo && (
              <div className="flex justify-end">
                <Button variant="ghost" onClick={limparFiltros}>
                  <span aria-hidden>&#9670;</span> Limpar
                </Button>
              </div>
            )}
          </div>
        )}

        {confirmedQuery.isLoading ? (
          <div className="flex justify-center py-10 text-granada">
            <Spinner className="size-7" />
          </div>
        ) : confirmed.length === 0 ? (
          <EmptyState>Nenhuma reserva confirmada.</EmptyState>
        ) : confirmadasFiltradas.length === 0 ? (
          <EmptyState hint="Ajuste ou limpe os filtros.">
            Nenhuma reserva confirmada com esses filtros.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {confirmadasFiltradas.map((r) => (
              <Card key={r.id} className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <span className="font-display text-xl capitalize text-granada">
                    {formatLong(fromISODate(r.data))}
                  </span>
                  <p className="mt-0.5 font-body text-sm text-tinta">
                    {r.profile?.nome ?? 'Irmão'}
                    {r.num_convidados != null && (
                      <span className="text-tinta-mid">
                        {' '}
                        · {r.num_convidados} convidado(s)
                      </span>
                    )}
                  </p>
                  <WhatsAppLink telefone={r.profile?.telefone} />
                  {r.observacoes && (
                    <p className="font-body text-sm text-tinta-mid">
                      {r.observacoes}
                    </p>
                  )}
                  {r.decided_at && (
                    <p className="eyebrow mt-1.5 text-[9px]!">
                      Confirmada em {formatShort(fromISODate(r.decided_at))}
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </ul>
        )}
      </section>
```

Observação: a lista agora itera `confirmadasFiltradas` (não `confirmed`). O EmptyState de lista realmente vazia (`confirmed.length === 0`) continua distinto do EmptyState de filtro sem resultado.

- [ ] **Step 6: Typecheck + build**

Run: `npx tsc -b`
Expected: sem erros (exit 0).

Run: `npm run build`
Expected: build conclui (warning de chunk >500KB é esperado e não bloqueia).

- [ ] **Step 7: Conferência manual no app**

Subir o dev server (`npm run dev`) e, logado como admin com confirmadas no banco, verificar:
- Sem filtro: lista mostra tudo, igual antes. "Limpar" **não** aparece.
- Filtrar por irmão; por mês; por ano; combinação irmão+mês+ano → lista recorta certo.
- Combinação sem resultado → EmptyState "Nenhuma reserva confirmada com esses filtros." (não o de lista vazia).
- "Limpar" aparece só com filtro ativo; clicar reseta os três pra "Todos".
- Visual: barra quieta, rótulos eyebrow, selects com chevron ouro, filete ouro separando da lista. Conferir desktop e mobile (DevTools responsivo, controles empilham < sm, alvo 44px).

- [ ] **Step 8: Commit**

```bash
git add src/pages/admin/AdminDashboardPage.tsx
git commit -m "feat(admin): filtros (irmão/mês/ano) na lista de confirmadas"
```

---

## Self-Review (já aplicado)

**Spec coverage:**
- Filtra só confirmadas, pendentes intactas → Task 3 (seção isolada; pendentes não tocadas). ✅
- 3 dropdowns AND (irmão/mês/ano) → Step 4 (`useMemo` AND) + Step 5 (3 selects). ✅
- Irmão = nomes distintos + "Todos" → Step 3 `nomesIrmaos` + Step 5. ✅
- Mês = 12 meses + "Todos os meses" → `MESES` (Task 2) + Step 5. ✅
- Ano = derivado mín..máx incluindo ano atual → Step 3 `anosDisponiveis`. ✅
- Sem contador → não há contador em lugar nenhum. ✅
- "Limpar" só com filtro ativo, reseta tudo → `filtroAtivo` + `limparFiltros` (Steps 2/5). ✅
- EmptyState próprio pra filtro sem resultado, distinto de lista vazia → Step 5. ✅
- Componente `Select` novo no `ui.tsx`, `appearance-none` + `fieldClass` + chevron ouro + `min-h-11` → Task 1. ✅
- Parse local com `fromISODate` (não UTC) → Steps 3/4. ✅
- Visual quieto, filete ouro (não outro plaque), rótulos eyebrow via `Field` → Step 5. ✅

**Placeholder scan:** sem TBD/TODO/"handle edge cases"; todo passo tem código real. ✅

**Type consistency:** `Select` (Task 1) usado em Task 3; `MESES` (Task 2) usado em Task 3; nomes de estado (`filtroIrmao`/`filtroMes`/`filtroAno`) consistentes entre Steps 2–5; `confirmadasFiltradas` definido no Step 4 e iterado no Step 5. ✅

**Fora de escopo (confirmado não implementado):** filtro em pendentes, recusadas/canceladas, contador, filtro no servidor/paginação, exportar CSV.
