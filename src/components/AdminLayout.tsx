import { NavLink, Outlet } from 'react-router-dom'

const tabClass =
  'relative px-1 py-2 font-mono text-xs uppercase tracking-[0.12em] transition-colors'

function AdminTab({ to, label, end }: { to: string; label: string; end?: boolean }) {
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

/** Casca das páginas de admin: abas Secretaria / Receita / Membros + conteúdo. */
export function AdminLayout() {
  return (
    <div className="space-y-6">
      <nav className="flex gap-6 border-b border-linha">
        <AdminTab to="/admin" label="Secretaria" end />
        <AdminTab to="/admin/receita" label="Receita" />
        <AdminTab to="/admin/membros" label="Membros" />
      </nav>
      <Outlet />
    </div>
  )
}
