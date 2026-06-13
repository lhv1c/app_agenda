import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { AuthShell } from '../components/AuthShell'
import { Alert, Button, Field, Input } from '../components/ui'

export function RecoverPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    setLoading(false)
    if (error) {
      setError('Não foi possível enviar o e-mail. Tente novamente.')
      return
    }
    setSent(true)
  }

  return (
    <AuthShell
      title="Recuperar senha"
      footer={
        <Link
          to="/login"
          className="font-semibold text-granada underline decoration-ouro underline-offset-2"
        >
          Voltar para o login
        </Link>
      }
    >
      {sent ? (
        <Alert tone="success">
          Se houver uma conta com este e-mail, enviamos um link para redefinir a
          senha. Verifique sua caixa de entrada (e o spam).
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <p className="font-body text-sm leading-snug text-tinta-mid">
            Informe o e-mail da sua conta. Enviaremos um link para você criar uma
            nova senha.
          </p>
          <Field label="E-mail">
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Button type="submit" loading={loading} className="w-full">
            Enviar link
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
