import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

/** Tile quadrado de módulo, usado nos hubs (Home e Admin). */
export function ModuleCard({
  to,
  title,
  subtitle,
  icon,
}: {
  to: string
  title: string
  subtitle: string
  icon: ReactNode
}) {
  return (
    <Link
      to={to}
      className="plaque flex aspect-square flex-col items-center justify-center gap-3 p-5 text-center transition-colors hover:border-ouro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro"
    >
      <span className="text-granada [&>svg]:size-9">{icon}</span>
      <span className="min-w-0">
        <span className="block font-display text-xl font-semibold text-granada">
          {title}
        </span>
        <span className="block font-body text-sm text-tinta-mid">{subtitle}</span>
      </span>
    </Link>
  )
}
