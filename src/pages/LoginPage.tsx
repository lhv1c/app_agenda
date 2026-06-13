import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { AuthShell } from '../components/AuthShell'
import { Alert, Button, Field, Input, PasswordInput } from '../components/ui'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    })
    setLoading(false)
    if (error) {
      setError('E-mail ou senha inválidos.')
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <AuthShell
      title="Entrar"
      footer={
        <>
          Ainda não tem conta?{' '}
          <Link to="/cadastro" className="font-semibold text-granada underline decoration-ouro underline-offset-2">
            Cadastre-se
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="E-mail">
          <Input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="eyebrow">Senha</span>
            <Link
              to="/recuperar-senha"
              className="font-body text-xs text-tinta-mid underline decoration-ouro/60 underline-offset-2 hover:text-granada"
            >
              Esqueceu a senha?
            </Link>
          </div>
          <PasswordInput
            aria-label="Senha"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </div>
        <Button type="submit" loading={loading} className="w-full">
          Entrar
        </Button>
      </form>
    </AuthShell>
  )
}
