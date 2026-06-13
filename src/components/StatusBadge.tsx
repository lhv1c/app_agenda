import type { ReservationStatus } from '../types'

const labels: Record<ReservationStatus, { text: string; className: string }> = {
  pendente: {
    text: 'Pendente',
    className: 'border-ouro/60 text-ouro bg-ouro/8',
  },
  confirmada: {
    text: 'Confirmada',
    className: 'border-granada bg-granada text-pergaminho-2',
  },
  recusada: {
    text: 'Recusada',
    className: 'border-linha text-tinta-mid bg-pergaminho',
  },
  cancelada: {
    text: 'Cancelada',
    className: 'border-linha text-tinta-mid bg-pergaminho line-through',
  },
}

export function StatusBadge({ status }: { status: ReservationStatus }) {
  const s = labels[status]
  return (
    <span
      className={`inline-block rounded-[4px] border px-2 py-0.5 font-mono text-[0.625rem] font-medium uppercase tracking-[0.12em] ${s.className}`}
    >
      {s.text}
    </span>
  )
}
