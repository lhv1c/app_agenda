import { NavLink, Outlet } from 'react-router-dom'

const tabClass =
  'relative px-1 py-2 font-mono text-xs uppercase tracking-[0.12em] transition-colors'

function AdminAgendaTab({ to, label, end }: { to: string; label: string; end?: boolean }) {
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

/** Casca do admin da Agenda: abas Secretaria / Receita + conteúdo. */
export function AdminAgendaLayout() {
  return (
    <div className="space-y-6">
      <nav className="flex gap-6 border-b border-linha">
        <AdminAgendaTab to="/admin/agenda/secretaria" label="Secretaria" end />
        <AdminAgendaTab to="/admin/agenda/receita" label="Receita" />
      </nav>
      <Outlet />
    </div>
  )
}
