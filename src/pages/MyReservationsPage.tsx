import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/context'
import { cancelReservation, fetchMyReservations } from '../api/reservations'
import { formatShort, fromISODate } from '../lib/dates'
import { StatusBadge } from '../components/StatusBadge'
import { Button, Card, EmptyState, PageHeader, Spinner } from '../components/ui'
import type { Reservation } from '../types'

export function MyReservationsPage() {
  const { session } = useAuth()
  const userId = session!.user.id
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['my-reservations', userId],
    queryFn: () => fetchMyReservations(userId),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelReservation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-reservations'] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
  })

  const reservations = data ?? []

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Registro pessoal" title="Minhas reservas" />

      {isLoading ? (
        <div className="flex justify-center py-10 text-granada">
          <Spinner className="size-7" />
        </div>
      ) : reservations.length === 0 ? (
        <EmptyState hint="Escolha uma data no calendário">
          Você ainda não tem reservas.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {reservations.map((r) => (
            <ReservationItem
              key={r.id}
              reservation={r}
              onCancel={() => cancelMutation.mutate(r.id)}
              cancelling={
                cancelMutation.isPending && cancelMutation.variables === r.id
              }
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function ReservationItem({
  reservation,
  onCancel,
  cancelling,
}: {
  reservation: Reservation
  onCancel: () => void
  cancelling: boolean
}) {
  const canCancel =
    reservation.status === 'pendente' || reservation.status === 'confirmada'
  return (
    <Card className="flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-display text-xl capitalize text-granada">
            {formatShort(fromISODate(reservation.data))}
          </span>
          <StatusBadge status={reservation.status} />
        </div>
        {reservation.num_convidados != null && (
          <p className="font-body text-sm text-tinta-mid">
            {reservation.num_convidados} convidado(s)
          </p>
        )}
        {reservation.observacoes && (
          <p className="font-body text-sm text-tinta-mid">
            {reservation.observacoes}
          </p>
        )}
      </div>
      {canCancel && (
        <Button variant="outline" onClick={onCancel} loading={cancelling} className="shrink-0">
          Cancelar
        </Button>
      )}
    </Card>
  )
}
