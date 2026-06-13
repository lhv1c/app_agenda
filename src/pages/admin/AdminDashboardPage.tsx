import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  confirmReservation,
  fetchConfirmedReservations,
  fetchPendingReservations,
  rejectReservation,
} from '../../api/reservations'
import { formatLong, formatShort, fromISODate } from '../../lib/dates'
import { Button, Card, PageHeader, Rule, Spinner } from '../../components/ui'
import type { ReservationWithProfile } from '../../types'

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
          <Card>
            <p className="text-center font-body text-sm text-tinta-mid">
              Nenhum pedido pendente no momento.
            </p>
          </Card>
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
                    <div className="flex-1">
                      <p className="font-display text-lg text-granada">
                        {r.profile?.nome ?? 'Irmão'}
                      </p>
                      <p className="eyebrow text-[9px]! tracking-[0.02em]! normal-case!">
                        {r.profile?.email}
                      </p>
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
                    <div className="flex flex-col gap-2">
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
          <Card>
            <p className="text-center font-body text-sm text-tinta-mid">
              Nenhuma reserva confirmada.
            </p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {confirmed.map((r) => (
              <Card key={r.id} className="flex items-center gap-4">
                <div className="flex-1">
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
    </div>
  )
}
