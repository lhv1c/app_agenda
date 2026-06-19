import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { PageHeader } from '../components/ui'
import { CalendarIcon } from '../components/icons'

type ModuleCard = {
  to: string
  label: string
  description: string
  icon: ReactNode
}

const modules: ModuleCard[] = [
  {
    to: '/agenda',
    label: 'Agenda',
    description: 'Reserva do salão e suas reservas',
    icon: <CalendarIcon />,
  },
]

export function HomePage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Portal da Loja" title="Ciência e Justiça" />
      <div className="grid gap-4 sm:grid-cols-2">
        {modules.map((m) => (
          <Link
            key={m.to}
            to={m.to}
            className="plaque flex items-center gap-4 p-5 transition-colors hover:border-ouro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro"
          >
            <span className="shrink-0 text-granada">{m.icon}</span>
            <span className="min-w-0">
              <span className="block font-display text-xl font-semibold text-granada">
                {m.label}
              </span>
              <span className="block font-body text-sm text-tinta-mid">
                {m.description}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
