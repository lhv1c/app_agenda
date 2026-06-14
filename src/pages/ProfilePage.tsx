import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { supabase } from '../lib/supabase'
import { isValidPhone, maskPhone, phoneDigits } from '../lib/phone'
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
} from '../components/ui'

export function ProfilePage() {
  const { profile, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()

  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Pré-preenche com o perfil atual assim que ele carrega.
  useEffect(() => {
    if (!profile) return
    setNome(profile.nome)
    setTelefone(profile.telefone ? maskPhone(profile.telefone) : '')
  }, [profile])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    setError(null)
    setSaved(false)
    if (!nome.trim()) {
      setError('Informe seu nome.')
      return
    }
    if (!isValidPhone(telefone)) {
      setError('Informe um WhatsApp válido com DDD.')
      return
    }
    setSaving(true)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ nome: nome.trim(), telefone: phoneDigits(telefone) })
      .eq('id', profile.id)
    setSaving(false)
    if (updateError) {
      setError('Não foi possível salvar. Tente novamente.')
      return
    }
    await refreshProfile()
    setSaved(true)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Conta" title="Meu perfil" />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          {saved && <Alert tone="success">Perfil atualizado.</Alert>}
          <Field label="Nome completo">
            <Input
              required
              value={nome}
              onChange={(e) => {
                setNome(e.target.value)
                setSaved(false)
              }}
            />
          </Field>
          <Field label="WhatsApp">
            <Input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              required
              value={telefone}
              onChange={(e) => {
                setTelefone(maskPhone(e.target.value))
                setSaved(false)
              }}
              placeholder="(44) 99999-9999"
            />
          </Field>
          <Field label="E-mail">
            <Input value={profile?.email ?? ''} disabled />
          </Field>
          <Button type="submit" loading={saving} className="w-full">
            Salvar
          </Button>
        </form>
      </Card>

      <Button variant="outline" onClick={handleSignOut} className="w-full">
        Sair
      </Button>
    </div>
  )
}
