import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/context'
import { HomeIcon, ShieldIcon, UserIcon } from './icons'

const itemClass =
  'relative flex flex-1 flex-col items-center justify-center gap-1 py-3'
const labelClass = 'font-mono text-[0.625rem] uppercase tracking-[0.08em]'

function Tab({
  to,
  icon,
  label,
}: {
  to: string
  icon: ReactNode
  label: string
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `${itemClass} transition-colors ${isActive ? 'text-granada' : 'text-tinta-mid'}`
      }
    >
      {({ isActive }) => (
        <>
          {icon}
          <span className={labelClass}>{label}</span>
          {isActive && (
            <span className="absolute bottom-1.5 h-0.5 w-5 rounded-full bg-ouro" />
          )}
        </>
      )}
    </NavLink>
  )
}

export function TabBar() {
  const { isAdmin } = useAuth()

  return (
    <div className="fixed inset-x-0 bottom-4 z-20 flex justify-center px-4 pb-[env(safe-area-inset-bottom)]">
      <nav className="flex w-full max-w-sm items-stretch rounded-full border border-linha bg-pergaminho-2/95 px-2 shadow-[0_4px_16px_rgb(36_31_26_/0.12)] backdrop-blur">
        <Tab to="/home" icon={<HomeIcon />} label="Início" />
        {isAdmin && <Tab to="/admin" icon={<ShieldIcon />} label="Admin" />}
        <Tab to="/perfil" icon={<UserIcon />} label="Perfil" />
      </nav>
    </div>
  )
}
