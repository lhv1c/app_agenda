// Edge Function: cria usuário somente com código de convite válido da Loja.
// Roda com a service role key (injetada pelo Supabase), nunca exposta no app.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let payload: {
    nome?: string
    email?: string
    senha?: string
    codigo?: string
  }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const nome = (payload.nome ?? '').trim()
  const email = (payload.email ?? '').trim().toLowerCase()
  const senha = payload.senha ?? ''
  const codigo = (payload.codigo ?? '').trim()

  if (!nome || !email || senha.length < 6 || !codigo) {
    return json({ error: 'dados_invalidos' }, 400)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // 1) Valida o código de convite.
  const { data: invite, error: inviteError } = await admin
    .from('invite_codes')
    .select('code, ativo')
    .eq('code', codigo)
    .eq('ativo', true)
    .maybeSingle()

  if (inviteError) return json({ error: 'erro_interno' }, 500)
  if (!invite) return json({ error: 'codigo_invalido' }, 403)

  // 2) Cria o usuário já confirmado (grupo fechado).
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  })

  if (createError) {
    const msg = createError.message.toLowerCase()
    if (msg.includes('already') || msg.includes('registered')) {
      return json({ error: 'email_ja_registrado' }, 409)
    }
    return json({ error: 'erro_ao_criar_usuario' }, 400)
  }

  return json({ ok: true })
})
