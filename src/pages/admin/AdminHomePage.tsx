import { PageHeader } from '../../components/ui'
import { ModuleCard } from '../../components/ModuleCard'
import { CalendarIcon, UsersIcon } from '../../components/icons'

export function AdminHomePage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Administração" title="Painel" />
      <div className="grid grid-cols-2 gap-4">
        <ModuleCard
          to="/admin/agenda"
          title="Agenda"
          subtitle="Secretaria e receita"
          icon={<CalendarIcon />}
        />
        <ModuleCard
          to="/admin/membros"
          title="Membros"
          subtitle="Gestão de irmãos"
          icon={<UsersIcon />}
        />
      </div>
    </div>
  )
}
