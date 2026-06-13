import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { AuthShell } from '../components/AuthShell'
import { Alert, Button, Field, Input, PasswordInput } from '../components/ui'

export function SignupPage() {
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (senha.length < 6) {
      setError('A senha deve ter ao menos 6 caracteres.')
      return
    }
    setLoading(true)

    // The Edge Function validates the invite code server-side and creates the user.
    const { data, error: fnError } = await supabase.functions.invoke(
      'signup-with-invite',
      {
        body: {
          nome: nome.trim(),
          email: email.trim(),
          senha,
          codigo: codigo.trim(),
        },
      },
    )

    if (fnError || (data && data.error)) {
      setLoading(false)
      let code: string = (data && data.error) || ''
      if (fnError) {
        // supabase-js zera `data` em respostas não-2xx; o corpo da function
        // fica em error.context (a Response original).
        const ctx = (fnError as { context?: Response }).context
        try {
          const body = await ctx?.json()
          code = body?.error ?? code
        } catch {
          // resposta sem corpo JSON legível
        }
      }
      setError(
        code.includes('codigo') || code.includes('convite')
          ? 'Código de convite inválido.'
          : code.includes('registrado') || code.includes('exists')
            ? 'Já existe uma conta com este e-mail.'
            : 'Não foi possível concluir o cadastro. Tente novamente.',
      )
      return
    }

    // Auto sign-in after successful registration.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    })
    setLoading(false)
    if (signInError) {
      navigate('/login', { replace: true })
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <AuthShell
      title="Criar conta"
      footer={
        <>
          Já tem conta?{' '}
          <Link to="/login" className="font-semibold text-granada underline decoration-ouro underline-offset-2">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Nome completo">
          <Input
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </Field>
        <Field label="E-mail">
          <Input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Senha">
          <PasswordInput
            autoComplete="new-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </Field>
        <Field label="Código de convite da Loja">
          <Input
            required
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Fornecido pela Loja"
          />
        </Field>
        <Button type="submit" loading={loading} className="w-full">
          Cadastrar
        </Button>
      </form>
    </AuthShell>
  )
}
