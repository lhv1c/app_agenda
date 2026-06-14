import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/context'

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden>
      <rect x="3" y="4.5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 9h18M8 3v3M16 3v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function BookmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden>
      <path
        d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden>
      <path
        d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9.5 12l1.8 1.8L15 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

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
      end={to === '/'}
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
        <Tab to="/" icon={<CalendarIcon />} label="Calendário" />
        <Tab to="/minhas-reservas" icon={<BookmarkIcon />} label="Reservas" />
        {isAdmin && <Tab to="/admin" icon={<ShieldIcon />} label="Admin" />}
        <Tab to="/perfil" icon={<UserIcon />} label="Perfil" />
      </nav>
    </div>
  )
}
