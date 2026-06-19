import { NavLink, Outlet } from 'react-router-dom'
import { PageHeader } from './ui'

const tabClass =
  'relative px-1 py-2 font-mono text-xs uppercase tracking-[0.12em] transition-colors'

function AgendaTab({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `${tabClass} ${isActive ? 'text-granada' : 'text-tinta-mid hover:text-granada'}`
      }
    >
      {({ isActive }) => (
        <>
          {label}
          {isActive && (
            <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-ouro" />
          )}
        </>
      )}
    </NavLink>
  )
}

/** Casca da área Agenda: abas Calendário / Minhas Reservas + conteúdo. */
export function AgendaLayout() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Agenda do Salão" title="Irmão Cristiano Cano" />
      <nav className="flex gap-6 border-b border-linha">
        <AgendaTab to="/agenda/calendario" label="Calendário" end />
        <AgendaTab to="/agenda/minhas-reservas" label="Minhas Reservas" />
      </nav>
      <Outlet />
    </div>
  )
}
