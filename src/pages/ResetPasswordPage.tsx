import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { AuthShell } from '../components/AuthShell'
import { Alert, Button, Field, PasswordInput } from '../components/ui'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // O link de recuperação cria uma sessão em modo recovery. Liberamos o
  // formulário quando há sessão; senão o link expirou ou é inválido.
  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) setReady(true)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (senha.length < 6) {
      setError('A senha deve ter ao menos 6 caracteres.')
      return
    }
    if (senha !== confirma) {
      setError('As senhas não conferem.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    if (error) {
      setLoading(false)
      setError('Não foi possível redefinir a senha. O link pode ter expirado.')
      return
    }
    // Encerra a sessão de recovery e manda logar com a nova senha.
    await supabase.auth.signOut()
    setLoading(false)
    navigate('/login', { replace: true })
  }

  return (
    <AuthShell
      title="Redefinir senha"
      footer={
        <Link
          to="/login"
          className="font-semibold text-granada underline decoration-ouro underline-offset-2"
        >
          Voltar para o login
        </Link>
      }
    >
      {!ready ? (
        <Alert tone="info">
          Abra esta página pelo link que enviamos por e-mail. Se o link expirou,
          solicite um novo em <strong>Esqueceu a senha?</strong>.
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="Nova senha">
            <PasswordInput
              autoComplete="new-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </Field>
          <Field label="Confirmar nova senha">
            <PasswordInput
              autoComplete="new-password"
              required
              value={confirma}
              onChange={(e) => setConfirma(e.target.value)}
            />
          </Field>
          <Button type="submit" loading={loading} className="w-full">
            Salvar nova senha
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
