import { useMemo, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { ptBR } from 'react-day-picker/locale'
import 'react-day-picker/style.css'
import {
  addDays,
  endOfMonth,
  startOfMonth,
  isSameDay,
  startOfDay,
} from 'date-fns'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/context'
import { fetchAvailability } from '../api/availability'
import { blockDate, fetchBlockedDates, unblockDate } from '../api/blockedDates'
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
  const { session, isAdmin } = useAuth()
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

  // Admin gere bloqueios direto no calendário (tocar a data).
  const [blockError, setBlockError] = useState<string | null>(null)

  function invalidateBlocked() {
    queryClient.invalidateQueries({ queryKey: ['blocked'] })
    queryClient.invalidateQueries({ queryKey: ['availability'] })
    setSelected(undefined)
  }

  const blockMutation = useMutation({
    mutationFn: (input: { data: string; motivo: string }) =>
      blockDate(input.data, input.motivo),
    onSuccess: () => {
      setBlockError(null)
      invalidateBlocked()
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
    onSuccess: invalidateBlocked,
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
        description={
          isAdmin
            ? 'Toque uma data para reservar, bloquear ou liberar o salão.'
            : 'As reservas abrem 60 dias antes e fecham 3 dias antes do evento.'
        }
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
            endMonth={isAdmin ? addDays(startOfDay(new Date()), 365) : max}
            disabled={(date) =>
              isAdmin
                ? startOfDay(date) < startOfDay(new Date())
                : !isBookable(date) || isConfirmed(date)
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
                'rounded-full text-tinta-mid/70 line-through [background-image:repeating-linear-gradient(45deg,rgb(36_31_26/0.10)_0,rgb(36_31_26/0.10)_1px,transparent_1px,transparent_5px)]',
            }}
          />
        )}
        <Legend />
      </Card>

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

      {selected && !isAdmin && (
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

      {!isAdmin && (
        <p className="eyebrow text-center">
          Período aberto · {min.toLocaleDateString('pt-BR')} a{' '}
          {max.toLocaleDateString('pt-BR')}
        </p>
      )}
    </div>
  )
}

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

function Legend() {
  const items = [
    { className: 'bg-granada', label: 'Confirmada' },
    { className: 'ring-1 ring-inset ring-ouro bg-transparent', label: 'Com pedidos' },
    { className: 'bg-ouro', label: 'Minha reserva' },
    {
      className:
        'bg-pergaminho ring-1 ring-inset ring-linha [background-image:repeating-linear-gradient(45deg,rgb(36_31_26/0.35)_0,rgb(36_31_26/0.35)_1px,transparent_1px,transparent_3px)]',
      label: 'Bloqueada',
    },
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
        <ReservationForm
          submitting={submitting}
          error={error}
          onSubmit={onSubmit}
        />
      )}
    </Card>
  )
}
