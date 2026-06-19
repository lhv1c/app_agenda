import { PageHeader } from '../components/ui'
import { ModuleCard } from '../components/ModuleCard'
import { CalendarIcon } from '../components/icons'

export function HomePage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Portal da Loja" title="Módulos" />
      <div className="grid grid-cols-2 gap-4">
        <ModuleCard
          to="/agenda"
          title="Agenda"
          subtitle="Salão Cristiano Cano"
          icon={<CalendarIcon />}
        />
      </div>
    </div>
  )
}
