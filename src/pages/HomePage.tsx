import { PageHeader } from '../components/ui'
import { ModuleCard } from '../components/ModuleCard'
import { CalendarIcon } from '../components/icons'
import { useAuth } from '../auth/context'

export function HomePage() {
  const { profile } = useAuth()
  const primeiroNome = profile?.nome?.trim().split(/\s+/)[0]

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={primeiroNome ? `Bem-vindo, ${primeiroNome}` : 'Bem-vindo'}
        title="Portal da Loja"
      />
      <div className="grid grid-cols-3 gap-3">
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
