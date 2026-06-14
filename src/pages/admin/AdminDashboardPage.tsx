import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  confirmReservation,
  fetchConfirmedReservations,
  fetchPendingReservations,
  rejectReservation,
} from '../../api/reservations'
import { blockDate, fetchBlockedDates, unblockDate } from '../../api/blockedDates'
import { formatLong, formatShort, fromISODate, toISODate } from '../../lib/dates'
import { maskPhone, whatsappUrl } from '../../lib/phone'
import { Alert, Button, Card, EmptyState, Field, Input, PageHeader, Rule, Spinner } from '../../components/ui'
import type { ReservationWithProfile } from '../../types'

/** Link de contato no WhatsApp; só renderiza quando há telefone. */
function WhatsAppLink({ telefone }: { telefone: string | null | undefined }) {
  if (!telefone) return null
  return (
    <a
      href={whatsappUrl(telefone)}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 inline-flex items-center gap-1 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-granada underline decoration-ouro underline-offset-2"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5" aria-hidden>
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.13c-.25.69-1.44 1.32-1.99 1.36-.53.05-1.02.24-3.45-.72-2.91-1.15-4.76-4.12-4.9-4.31-.14-.19-1.16-1.54-1.16-2.94s.73-2.08 1-2.37c.26-.29.57-.36.76-.36.19 0 .38 0 .55.01.18.01.41-.07.64.49.25.6.84 2.07.91 2.22.07.15.12.32.02.51-.09.19-.14.31-.28.48-.14.17-.29.38-.42.51-.14.14-.28.29-.12.57.16.28.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.22 1.37.28.14.44.12.6-.07.16-.19.69-.81.87-1.09.18-.28.36-.23.61-.14.25.09 1.6.76 1.87.9.28.14.46.21.53.32.07.12.07.66-.18 1.35Z" />
      </svg>
      {maskPhone(telefone)}
    </a>
  )
}

export function AdminDashboardPage() {
  const queryClient = useQueryClient()

  const pendingQuery = useQuery({
    queryKey: ['pending-reservations'],
    queryFn: fetchPendingReservations,
  })
  const confirmedQuery = useQuery({
    queryKey: ['confirmed-reservations'],
    queryFn: fetchConfirmedReservations,
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['pending-reservations'] })
    queryClient.invalidateQueries({ queryKey: ['confirmed-reservations'] })
    queryClient.invalidateQueries({ queryKey: ['availability'] })
  }

  const confirmMutation = useMutation({
    mutationFn: (id: string) => confirmReservation(id),
    onSuccess: invalidate,
  })
  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectReservation(id),
    onSuccess: invalidate,
  })

  const pending = pendingQuery.data ?? []
  const confirmed = confirmedQuery.data ?? []

  // Group pending requests by date so the admin sees the waitlist per day.
  const groups = useMemo(() => {
    const map = new Map<string, ReservationWithProfile[]>()
    for (const r of pending) {
      const list = map.get(r.data) ?? []
      list.push(r)
      map.set(r.data, list)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [pending])

  const busy = confirmMutation.isPending || rejectMutation.isPending

  const [novaData, setNovaData] = useState('')
  const [motivo, setMotivo] = useState('')
  const [blockError, setBlockError] = useState<string | null>(null)

  const hojeISO = toISODate(new Date())

  const blockedQuery = useQuery({
    queryKey: ['blocked-admin'],
    queryFn: () => fetchBlockedDates(hojeISO, '2100-01-01'),
  })
  const blocked = blockedQuery.data ?? []

  const blockMutation = useMutation({
    mutationFn: () => blockDate(novaData, motivo.trim()),
    onSuccess: () => {
      setNovaData('')
      setMotivo('')
      setBlockError(null)
      queryClient.invalidateQueries({ queryKey: ['blocked-admin'] })
      queryClient.invalidateQueries({ queryKey: ['blocked'] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : ''
      setBlockError(
        msg.includes('confirmada')
          ? 'Essa data já tem uma reserva confirmada.'
          : 'Não foi possível bloquear a data.',
      )
    },
  })

  const unblockMutation = useMutation({
    mutationFn: (data: string) => unblockDate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-admin'] })
      queryClient.invalidateQueries({ queryKey: ['blocked'] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
  })

  return (
    <div className="space-y-8">
      {/* ---------------------------------------------------------------- */}
      {/* Pedidos pendentes                                                */}
      {/* ---------------------------------------------------------------- */}
      <section className="space-y-5">
        <PageHeader
          eyebrow="Secretaria"
          title="Pedidos pendentes"
          description="Ao confirmar um pedido, os demais da mesma data são recusados automaticamente."
        />

        {pendingQuery.isLoading ? (
          <div className="flex justify-center py-10 text-granada">
            <Spinner className="size-7" />
          </div>
        ) : groups.length === 0 ? (
          <EmptyState>Nenhum pedido pendente no momento.</EmptyState>
        ) : (
          <div className="space-y-7">
            {groups.map(([date, items]) => (
              <div key={date} className="space-y-2.5">
                <div className="flex items-baseline gap-3">
                  <h2 className="font-display text-xl capitalize text-tinta">
                    {formatLong(fromISODate(date))}
                  </h2>
                  {items.length > 1 && (
                    <span className="rounded-[4px] border border-ouro/60 bg-ouro/8 px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.1em] text-ouro">
                      {items.length} na fila
                    </span>
                  )}
                </div>
                {items.map((r) => (
                  <Card key={r.id} className="flex items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-lg text-granada">
                        {r.profile?.nome ?? 'Irmão'}
                      </p>
                      <p className="eyebrow text-[9px]! tracking-[0.02em]! normal-case! break-all">
                        {r.profile?.email}
                      </p>
                      <WhatsAppLink telefone={r.profile?.telefone} />
                      {r.num_convidados != null && (
                        <p className="mt-1 font-body text-sm text-tinta-mid">
                          {r.num_convidados} convidado(s)
                        </p>
                      )}
                      {r.observacoes && (
                        <p className="font-body text-sm text-tinta-mid">
                          {r.observacoes}
                        </p>
                      )}
                      <p className="eyebrow mt-1.5 text-[9px]!">
                        Solicitado em {formatShort(fromISODate(r.created_at))}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <Button
                        variant="primary"
                        disabled={busy}
                        loading={
                          confirmMutation.isPending &&
                          confirmMutation.variables === r.id
                        }
                        onClick={() => confirmMutation.mutate(r.id)}
                      >
                        Confirmar
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy}
                        loading={
                          rejectMutation.isPending &&
                          rejectMutation.variables === r.id
                        }
                        onClick={() => rejectMutation.mutate(r.id)}
                      >
                        Recusar
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      <Rule />

      {/* ---------------------------------------------------------------- */}
      {/* Reservas confirmadas (controle)                                  */}
      {/* ---------------------------------------------------------------- */}
      <section className="space-y-5">
        <PageHeader
          as="h2"
          eyebrow="Controle da agenda"
          title="Reservas confirmadas"
        />

        {confirmedQuery.isLoading ? (
          <div className="flex justify-center py-10 text-granada">
            <Spinner className="size-7" />
          </div>
        ) : confirmed.length === 0 ? (
          <EmptyState>Nenhuma reserva confirmada.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {confirmed.map((r) => (
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

      <Rule />

      <section className="space-y-5">
        <PageHeader
          as="h2"
          eyebrow="Calendário"
          title="Datas bloqueadas"
        />

        <Card className="space-y-4">
          {blockError && <Alert tone="error">{blockError}</Alert>}
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (!novaData || !motivo.trim()) return
              blockMutation.mutate()
            }}
          >
            <Field label="Data">
              <Input
                type="date"
                min={hojeISO}
                value={novaData}
                onChange={(e) => setNovaData(e.target.value)}
                required
              />
            </Field>
            <Field label="Motivo">
              <Input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Feriado, manutenção, evento da Loja…"
                required
              />
            </Field>
            <Button
              type="submit"
              loading={blockMutation.isPending}
              className="w-full"
            >
              Bloquear data
            </Button>
          </form>
        </Card>

        {blockedQuery.isLoading ? (
          <div className="flex justify-center py-6 text-granada">
            <Spinner className="size-6" />
          </div>
        ) : blocked.length === 0 ? (
          <EmptyState>Nenhuma data bloqueada.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {blocked.map((b) => (
              <Card key={b.data} className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <span className="font-display text-lg capitalize text-granada">
                    {formatLong(fromISODate(b.data))}
                  </span>
                  <p className="font-body text-sm text-tinta-mid">{b.motivo}</p>
                </div>
                <Button
                  variant="outline"
                  className="shrink-0"
                  loading={
                    unblockMutation.isPending &&
                    unblockMutation.variables === b.data
                  }
                  onClick={() => unblockMutation.mutate(b.data)}
                >
                  Desbloquear
                </Button>
              </Card>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
