import { useMemo, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { ptBR } from 'react-day-picker/locale'
import 'react-day-picker/style.css'
import {
  endOfMonth,
  startOfMonth,
  isSameDay,
  startOfDay,
} from 'date-fns'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/context'
import { fetchAvailability } from '../api/availability'
import { fetchBlockedDates } from '../api/blockedDates'
import { createReservation, fetchMyReservations } from '../api/reservations'
import {
  formatLong,
  fromISODate,
  isBookable,
  toISODate,
  windowBounds,
} from '../lib/dates'
import {
  Alert,
  Button,
  Card,
  Eyebrow,
  Field,
  PageHeader,
  Spinner,
  Textarea,
  Input,
} from '../components/ui'
import type { BlockedDate, DateAvailability, Reservation } from '../types'

export function CalendarPage() {
  const { session } = useAuth()
  const userId = session!.user.id
  const queryClient = useQueryClient()
  const [month, setMonth] = useState<Date>(new Date())
  const [selected, setSelected] = useState<Date | undefined>()

  const rangeFrom = toISODate(startOfMonth(month))
  const rangeTo = toISODate(endOfMonth(month))

  const availabilityQuery = useQuery({
    queryKey: ['availability', rangeFrom, rangeTo],
    queryFn: () => fetchAvailability(rangeFrom, rangeTo),
  })

  const myReservationsQuery = useQuery({
    queryKey: ['my-reservations', userId],
    queryFn: () => fetchMyReservations(userId),
  })

  const blockedQuery = useQuery({
    queryKey: ['blocked', rangeFrom, rangeTo],
    queryFn: () => fetchBlockedDates(rangeFrom, rangeTo),
  })

  const availability = availabilityQuery.data ?? []
  const myReservations = myReservationsQuery.data ?? []
  const blocked = blockedQuery.data ?? []

  const confirmedDates = useMemo(
    () =>
      availability
        .filter((a) => a.tem_confirmada)
        .map((a) => fromISODate(a.data)),
    [availability],
  )
  const pendingDates = useMemo(
    () =>
      availability
        .filter((a) => a.qtd_pendentes > 0 && !a.tem_confirmada)
        .map((a) => fromISODate(a.data)),
    [availability],
  )
  const myActiveDates = useMemo(
    () =>
      myReservations
        .filter((r) => r.status === 'pendente' || r.status === 'confirmada')
        .map((r) => fromISODate(r.data)),
    [myReservations],
  )

  const blockedDates = useMemo(
    () => blocked.map((b) => fromISODate(b.data)),
    [blocked],
  )

  const { min, max } = windowBounds()

  function isConfirmed(date: Date) {
    return confirmedDates.some((d) => isSameDay(d, date))
  }
  function myReservationOn(date: Date): Reservation | undefined {
    return myReservations.find(
      (r) =>
        (r.status === 'pendente' || r.status === 'confirmada') &&
        isSameDay(fromISODate(r.data), date),
    )
  }
  function availabilityOn(date: Date): DateAvailability | undefined {
    return availability.find((a) => isSameDay(fromISODate(a.data), date))
  }
  function isBlocked(date: Date) {
    return blockedDates.some((d) => isSameDay(d, date))
  }
  function blockedOn(date: Date): BlockedDate | undefined {
    return blocked.find((b) => isSameDay(fromISODate(b.data), date))
  }

  const createMutation = useMutation({
    mutationFn: (input: {
      data: string
      num_convidados: number | null
      observacoes: string | null
    }) => createReservation(userId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability'] })
      queryClient.invalidateQueries({ queryKey: ['my-reservations'] })
      setSelected(undefined)
    },
  })

  const loading =
    availabilityQuery.isLoading ||
    myReservationsQuery.isLoading ||
    blockedQuery.isLoading

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Salão da Loja"
        title="Calendário"
        description="As reservas abrem 60 dias antes e fecham 3 dias antes do evento."
      />

      <Card className="flex flex-col items-center">
        {loading ? (
          <div className="flex h-72 items-center text-granada">
            <Spinner className="size-7" />
          </div>
        ) : (
          <DayPicker
            mode="single"
            locale={ptBR}
            month={month}
            onMonthChange={setMonth}
            selected={selected}
            onSelect={setSelected}
            startMonth={startOfDay(new Date())}
            endMonth={max}
            disabled={(date) =>
              !isBookable(date) || isConfirmed(date) || isBlocked(date)
            }
            modifiers={{
              confirmada: confirmedDates,
              pendente: pendingDates,
              minha: myActiveDates,
              bloqueada: blockedDates,
            }}
            modifiersClassNames={{
              confirmada:
                'bg-granada text-pergaminho-2 rounded-full line-through',
              pendente:
                'ring-1 ring-inset ring-ouro rounded-full text-ouro font-semibold',
              minha: 'bg-ouro text-pergaminho-2 rounded-full',
              selected:
                'outline outline-2 outline-offset-1 outline-granada rounded-full',
              bloqueada:
                'bg-linha text-tinta-mid/60 rounded-full line-through',
            }}
          />
        )}
        <Legend />
      </Card>

      {selected && (
        <ReservationPanel
          date={selected}
          isConfirmed={isConfirmed(selected)}
          existing={myReservationOn(selected)}
          availability={availabilityOn(selected)}
          bookable={isBookable(selected)}
          blocked={blockedOn(selected)}
          submitting={createMutation.isPending}
          error={createMutation.isError}
          onSubmit={(values) =>
            createMutation.mutate({
              data: toISODate(selected),
              num_convidados: values.num_convidados,
              observacoes: values.observacoes,
            })
          }
        />
      )}

      <p className="eyebrow text-center">
        Período aberto · {min.toLocaleDateString('pt-BR')} a{' '}
        {max.toLocaleDateString('pt-BR')}
      </p>
    </div>
  )
}

function Legend() {
  const items = [
    { className: 'bg-granada', label: 'Confirmada' },
    { className: 'ring-1 ring-inset ring-ouro bg-transparent', label: 'Com pedidos' },
    { className: 'bg-ouro', label: 'Minha reserva' },
    { className: 'bg-linha', label: 'Bloqueada' },
  ]
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-4">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className={`inline-block size-3 rounded-full ${i.className}`} />
          <span className="eyebrow">{i.label}</span>
        </span>
      ))}
    </div>
  )
}

function ReservationPanel({
  date,
  isConfirmed,
  existing,
  availability,
  bookable,
  blocked,
  submitting,
  error,
  onSubmit,
}: {
  date: Date
  isConfirmed: boolean
  existing?: Reservation
  availability?: DateAvailability
  bookable: boolean
  blocked?: BlockedDate
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
    <Card className="space-y-4">
      <div>
        <Eyebrow>Data escolhida</Eyebrow>
        <h2 className="font-display text-2xl capitalize text-granada">
          {formatLong(date)}
        </h2>
        {availability && availability.qtd_pendentes > 0 && !isConfirmed && (
          <p className="mt-1 font-body text-sm text-ouro">
            {availability.qtd_pendentes} pedido(s) na fila para esta data.
          </p>
        )}
      </div>

      {blocked ? (
        <Alert tone="info">Data indisponível: {blocked.motivo}</Alert>
      ) : isConfirmed ? (
        <Alert tone="info">
          Esta data já está confirmada para outro evento.
        </Alert>
      ) : existing ? (
        <Alert tone="success">
          Você já tem uma reserva ({existing.status}) nesta data. Acompanhe em
          “Minhas reservas”.
        </Alert>
      ) : !bookable ? (
        <Alert tone="info">Esta data está fora do período de reservas.</Alert>
      ) : (
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
      )}
    </Card>
  )
}
