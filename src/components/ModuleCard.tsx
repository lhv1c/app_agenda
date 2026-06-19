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
      className="plaque flex aspect-square flex-col items-center justify-center gap-2 p-3 text-center transition-colors hover:border-ouro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro"
    >
      <span className="text-granada [&>svg]:size-7">{icon}</span>
      <span className="min-w-0">
        <span className="block font-display text-base font-semibold leading-tight text-granada">
          {title}
        </span>
        <span className="mt-0.5 block font-body text-xs leading-tight text-tinta-mid">
          {subtitle}
        </span>
      </span>
    </Link>
  )
}
