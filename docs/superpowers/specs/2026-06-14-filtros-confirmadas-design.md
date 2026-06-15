# Filtros nas reservas confirmadas (painel admin)

**Data:** 2026-06-14
**Item do backlog v2:** "Filtros + busca no painel (mês e membro)" (seção _A estudar_).

## Problema

A seção **Reservas confirmadas** do painel admin (`AdminDashboardPage`) lista
todas as confirmadas em ordem de data. Com o tempo, eventos passados acumulam e
a lista cresce — fica difícil achar a reserva de um mês específico ou de um
irmão específico. Hoje não há recorte: é rolar a lista inteira.

## Objetivo

Permitir que o admin filtre a lista de confirmadas por **mês** e por **irmão**,
isolando o que importa. Decidido no brainstorming:

- Filtra **só a lista de confirmadas**. Pendentes não mudam (são poucas e
  transitórias).
- Sem recusadas/canceladas — confirmadas só (mantém o fetch atual).
- **Sem contador** "X de Y".

## Abordagem: filtro no cliente

`fetchConfirmedReservations` já traz todas as confirmadas de uma vez. O volume
real é baixo (regra de 1 confirmada por data; uma Loja faz poucos eventos por
mês → centenas de linhas no pior caso, ao longo de anos). Então o filtro roda
no navegador, em cima da lista já carregada:

- Zero query nova, zero endpoint novo, sem paginação.
- Resposta instantânea ao mexer no filtro.
- Nada de banco, nada de API nova.

Se um dia o volume justificar, migra-se pra filtro no servidor — **não agora**
(YAGNI).

## Filtros

Três controles, combinados com **E** (lógica AND):

| Controle | Tipo | Opções |
|----------|------|--------|
| **Irmão** | dropdown | "Todos" + nomes distintos que têm confirmada (derivados da lista). |
| **Mês** | dropdown | "Todos os meses" + Janeiro…Dezembro. |
| **Ano** | dropdown | anos derivados das datas das confirmadas (mín..máx; inclui o ano atual mesmo sem dados). |

**Por que mês + ano como dois selects** em vez de `<input type="month">`: o
input nativo de mês renderiza diferente por navegador/SO, traz ícone de
calendário do sistema e não casa com a identidade Prancha. Dois selects
estilizados dão seleção livre de qualquer mês/ano e ficam nativos do design.

**Comportamento:**

- Estado inicial: todos os filtros em "Todos" → mostra tudo, igual hoje. Nada
  muda pra quem não usa o filtro.
- Mês e Ano funcionam juntos: escolher só o mês sem ano filtra aquele mês em
  qualquer ano; escolher ano sem mês filtra o ano todo. (Cada select é
  independente; o filtro de data casa o que estiver selecionado.)
- Filtro sem resultado → `EmptyState`: "Nenhuma reserva confirmada com esses
  filtros."
- **Limpar:** link/botão `ghost` que reseta os três pra "Todos". Só aparece
  quando há algum filtro ativo.

## Design visual (dentro do sistema "Prancha")

A barra de filtro é a parte **quieta** da tela — a ousadia do Prancha vive no
mosaico/placa que já existem. A barra se apresenta como uma **consulta ao
arquivo da Loja**, não como uma toolbar genérica.

- Posição: logo abaixo do `PageHeader` da seção "Reservas confirmadas", acima
  da lista.
- Cada controle tem rótulo `eyebrow` em cima (small-caps mono ouro), seguindo o
  padrão do componente `Field` já existente.
- Selects estilizados com o mesmo `fieldClass` dos inputs (borda filete, fundo
  pergaminho, foco com ring ouro), + chevron ouro próprio (esconde a seta nativa
  com `appearance-none`).
- A barra é separada da lista por um filete fino (hairline ouro), não por outro
  `plaque` — pra não competir com os cards de reserva.
- "Limpar" alinhado à direita (desktop) / abaixo (mobile), com o losango ◆ como
  marcador, em tom discreto.

**Layout responsivo:**

```
Desktop (>= sm):
┌───────────────────────────────────────────────────────────┐
│ IRMÃO            MÊS              ANO            [◆ Limpar] │
│ [ Todos    ▾ ]   [ Todos  ▾ ]    [ Todos ▾ ]               │
└───────────────────────────────────────────────────────────┘
─────────────────────── (filete ouro) ───────────────────────
(lista de confirmadas)

Mobile (< sm): controles empilhados, largura total, alvo 44px.
┌──────────────────────┐
│ IRMÃO                │
│ [ Todos          ▾ ] │
│ MÊS                  │
│ [ Todos          ▾ ] │
│ ANO                  │
│ [ Todos          ▾ ] │
│            ◆ Limpar  │
└──────────────────────┘
```

## Componentes

### Novo: `Select` em `src/components/ui.tsx`

Não existe select no design system ainda. Criar um, reutilizável, casando com
`Input`:

- `<select>` nativo (acessível, teclado/leitor de tela de graça) com
  `appearance-none` + `fieldClass`.
- Chevron ouro posicionado à direita (svg, igual padrão do olho no
  `PasswordInput`).
- `min-h-11` (alvo de toque 44px, padrão do app).
- Foco visível: `focus:border-ouro focus:ring-2 focus:ring-ouro/20`.
- Aceita `children` (`<option>`s) e props nativas de `<select>`.

Usar com o `Field` existente (`<Field label="Irmão"><Select>…</Select></Field>`).

### Alterado: `AdminDashboardPage.tsx`

- Estado dos filtros: `irmao` (nome ou ""), `mes` (1–12 ou ""), `ano` (número
  ou "").
- Derivar listas de opções da query `confirmed`:
  - nomes distintos (ordenados);
  - anos distintos das datas (mín..máx, garantindo o ano atual).
- `useMemo` que filtra `confirmed` pelos três critérios (AND). As datas das
  reservas são `yyyy-MM-dd`; o parse de mês/ano deve usar a data **local** já em
  uso (`fromISODate`), sem cair em UTC.
- Barra de filtro renderizada entre o `PageHeader` e a lista.
- `EmptyState` quando o filtro zera o resultado (distinto do "Nenhuma reserva
  confirmada" de lista realmente vazia).

Nada na seção de pendentes muda.

## Fora de escopo

- Filtro nas pendentes.
- Recusadas/canceladas / histórico completo.
- Contador de resultados.
- Filtro no servidor / paginação.
- Exportar resultado filtrado (item separado do backlog: "Exportar CSV").

## Testes / verificação

- Build/typecheck limpos.
- Manual (admin): sem filtro mostra tudo; filtrar por irmão; por mês; por ano;
  combinação irmão+mês+ano; filtro sem resultado mostra o EmptyState certo;
  "Limpar" some sem filtro e reseta tudo quando clicado.
- Conferência visual da barra (desktop + mobile) contra a identidade Prancha.
