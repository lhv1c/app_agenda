import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchRevenueEntries,
  fetchRevenueYears,
  fetchSalarioMinimo,
  upsertSalarioMinimo,
} from '../../api/revenue'
import { formatShort, fromISODate } from '../../lib/dates'
import { formatBRL } from '../../lib/money'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
} from '../../components/ui'
import type { RevenueEntry } from '../../types'

/** Valor da taxa de uma linha: null quando o SM do ano não está cadastrado. */
function valorTaxa(e: RevenueEntry): number | null {
  if (e.sm == null) return null
  return Math.round(e.rate * e.sm * 100) / 100
}

/** Rótulo da ordem: 1ª, 2ª, ou "Nª (extra)" da 3ª em diante. */
function ordemLabel(ordinal: number): string {
  return ordinal <= 2 ? `${ordinal}ª` : `${ordinal}ª (extra)`
}

export function RevenueReportPage() {
  const queryClient = useQueryClient()
  const anoAtual = new Date().getFullYear()
  const [ano, setAno] = useState(anoAtual)

  const yearsQuery = useQuery({
    queryKey: ['revenue-years'],
    queryFn: fetchRevenueYears,
  })
  const entriesQuery = useQuery({
    queryKey: ['revenue-entries', ano],
    queryFn: () => fetchRevenueEntries(ano),
  })
  const smQuery = useQuery({
    queryKey: ['salario-minimo', ano],
    queryFn: () => fetchSalarioMinimo(ano),
  })

  const anos = yearsQuery.data ?? [anoAtual]
  const entries = entriesQuery.data ?? []

  // Total do ano (só as linhas com SM cadastrado) + quantas ficaram sem valor.
  const { total, semValor } = useMemo(() => {
    let total = 0
    let semValor = 0
    for (const e of entries) {
      const v = valorTaxa(e)
      if (v == null) semValor += 1
      else total += v
    }
    return { total, semValor }
  }, [entries])

  return (
    <section className="space-y-6">
      <PageHeader
        as="h2"
        eyebrow="Tesouraria"
        title="Relatório de receita"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Ano">
          <Select value={String(ano)} onChange={(e) => setAno(Number(e.target.value))}>
            {anos.map((a) => (
              <option key={a} value={String(a)}>
                {a}
              </option>
            ))}
          </Select>
        </Field>
        <SalarioMinimoEditor
          ano={ano}
          valor={smQuery.data ?? null}
          loading={smQuery.isLoading}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['salario-minimo', ano] })
            queryClient.invalidateQueries({ queryKey: ['revenue-entries', ano] })
          }}
        />
      </div>

      {entriesQuery.isLoading ? (
        <div className="flex justify-center py-10 text-granada">
          <Spinner className="size-7" />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState>Nenhuma reserva confirmada em {ano}.</EmptyState>
      ) : (
        <>
          <ul className="space-y-3">
            {entries.map((e) => {
              const v = valorTaxa(e)
              const extra = e.ordinal > 2
              return (
                <Card key={e.id} className="flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-lg text-granada">{e.nome}</p>
                    <p className="eyebrow text-[9px]!">
                      {formatShort(fromISODate(e.data))}
                    </p>
                    <span
                      className={`mt-1 inline-block rounded-[4px] border px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.1em] ${
                        extra
                          ? 'border-ouro/60 bg-ouro/10 text-ouro'
                          : 'border-linha bg-pergaminho text-tinta-mid'
                      }`}
                    >
                      {ordemLabel(e.ordinal)} · {Math.round(e.rate * 100)}%
                    </span>
                  </div>
                  <div className="shrink-0 text-right font-display text-lg text-tinta">
                    {v == null ? (
                      <span className="text-tinta-mid">—</span>
                    ) : (
                      formatBRL(v)
                    )}
                  </div>
                </Card>
              )
            })}
          </ul>

          <div className="flex items-baseline justify-between border-t border-ouro/30 pt-4">
            <span className="eyebrow">Total {ano}</span>
            <span className="font-display text-2xl text-granada">
              {formatBRL(total)}
            </span>
          </div>
          {semValor > 0 && (
            <Alert tone="info">
              {semValor} reserva(s) sem valor — defina o salário mínimo de {ano}.
            </Alert>
          )}
        </>
      )}
    </section>
  )
}

/** Mostra/edita o salário mínimo do ano selecionado. */
function SalarioMinimoEditor({
  ano,
  valor,
  loading,
  onSaved,
}: {
  ano: number
  valor: number | null
  loading: boolean
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState('')

  const mutation = useMutation({
    mutationFn: (v: number) => upsertSalarioMinimo(ano, v),
    onSuccess: () => {
      setEditing(false)
      onSaved()
    },
  })

  function start() {
    setRaw(valor != null ? String(valor) : '')
    setEditing(true)
  }

  function save() {
    const v = Number(raw.replace(',', '.'))
    if (!Number.isFinite(v) || v <= 0) return
    mutation.mutate(v)
  }

  if (loading) {
    return (
      <Field label={`Salário mínimo ${ano}`}>
        <div className="flex h-11 items-center text-tinta-mid">
          <Spinner className="size-4" />
        </div>
      </Field>
    )
  }

  if (editing) {
    return (
      <Field label={`Salário mínimo ${ano}`}>
        <div className="flex gap-2">
          <Input
            type="text"
            inputMode="decimal"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="1518,00"
            autoFocus
          />
          <Button onClick={save} loading={mutation.isPending} className="shrink-0">
            Salvar
          </Button>
        </div>
      </Field>
    )
  }

  return (
    <Field label={`Salário mínimo ${ano}`}>
      <div className="flex items-center gap-3">
        <span className="font-display text-lg text-tinta">
          {valor != null ? formatBRL(valor) : 'Não definido'}
        </span>
        <Button variant="ghost" onClick={start} className="shrink-0">
          {valor != null ? 'Editar' : 'Definir'}
        </Button>
      </div>
    </Field>
  )
}
