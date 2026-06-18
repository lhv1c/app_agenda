// Edge Function: notificações por e-mail do fluxo de reservas.
// Acionada por Database Webhooks em public.reservations (INSERT e UPDATE).
// Envia via SMTP do Gmail da Loja (sem domínio próprio, custo zero).
//
// Eventos cobertos:
//   • INSERT (pendente)            -> avisa os ADMINS: nova solicitação a aprovar.
//   • UPDATE -> confirmada/recusada -> avisa o MEMBRO: decisão do admin.
//   • UPDATE -> cancelada           -> avisa os ADMINS: membro cancelou.
//
// Variáveis de ambiente (Edge Function Secrets):
//   GMAIL_USER          e-mail da Loja (ex.: cienciaejustica@gmail.com)
//   GMAIL_APP_PASSWORD  "senha de app" de 16 dígitos gerada no Google
//   NOTIFY_FROM_NAME    (opcional) nome exibido no remetente
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

interface ReservationRow {
  id: string
  data: string
  user_id: string
  status: string
  num_convidados: number | null
  observacoes: string | null
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: ReservationRow | null
  old_record: { status: string } | null
}

const GMAIL_USER = Deno.env.get('GMAIL_USER')
const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD')
const FROM_NAME = Deno.env.get('NOTIFY_FROM_NAME') ?? 'Agenda do Salão'
const LOJA = 'Loja Ciência e Justiça — Marialva'

function formatBR(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** Envelope HTML sóbrio (granada/pergaminho), com fallback de texto. */
function wrap(title: string, lines: string[]) {
  const paragraphs = lines
    .map(
      (l) =>
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#241f1a">${l}</p>`,
    )
    .join('')
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f1e9d8;font-family:Georgia,'Times New Roman',serif">
  <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#fbf6ea;border:1px solid #d8cbae;border-radius:6px">
    <tr><td style="padding:24px 28px">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9a7b33">Agenda do Salão</p>
      <h1 style="margin:0 0 16px;font-size:22px;color:#6e1322">${title}</h1>
      ${paragraphs}
      <p style="margin:20px 0 0;font-size:13px;color:#6a6253">${LOJA}</p>
    </td></tr>
  </table></body></html>`
}

Deno.serve(async (req) => {
  const payload = (await req.json()) as WebhookPayload
  if (payload.table !== 'reservations' || !payload.record) {
    return new Response('ignored', { status: 200 })
  }

  const { type, record, old_record } = payload
  const statusChanged = old_record?.status !== record.status

  // Decide destinatário e conteúdo conforme o evento.
  type Mail = { to: string[]; subject: string; title: string; lines: string[] }
  let mail: Mail | null = null
  const dataBR = formatBR(record.data)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  async function adminEmails(): Promise<string[]> {
    const { data, error } = await admin
      .from('profiles')
      .select('email')
      .eq('role', 'admin')
      .eq('ativo', true)
    if (error) console.error('erro ao buscar admins:', error.message)
    return (data ?? []).map((p) => p.email).filter(Boolean)
  }

  async function memberProfile() {
    const { data } = await admin
      .from('profiles')
      .select('nome, email')
      .eq('id', record.user_id)
      .maybeSingle()
    return data
  }

  if (type === 'INSERT' && record.status === 'pendente') {
    const [to, member] = await Promise.all([adminEmails(), memberProfile()])
    const nome = member?.nome ?? 'Um irmão'
    const convidados =
      record.num_convidados != null
        ? `${record.num_convidados} convidado(s)`
        : 'sem nº de convidados informado'
    mail = {
      to,
      subject: `Nova solicitação de reserva — ${dataBR}`,
      title: 'Nova solicitação de reserva',
      lines: [
        `<strong>${nome}</strong> solicitou o salão para <strong>${dataBR}</strong> (${convidados}).`,
        record.observacoes ? `Observações: ${record.observacoes}` : '',
        'Acesse o painel para confirmar ou recusar.',
      ].filter(Boolean),
    }
  } else if (
    type === 'UPDATE' &&
    statusChanged &&
    (record.status === 'confirmada' || record.status === 'recusada')
  ) {
    const member = await memberProfile()
    if (member?.email) {
      const ok = record.status === 'confirmada'
      mail = {
        to: [member.email],
        subject: ok
          ? `Reserva confirmada — ${dataBR}`
          : `Reserva não confirmada — ${dataBR}`,
        title: ok ? 'Reserva confirmada' : 'Reserva não confirmada',
        lines: ok
          ? [
              `Olá, ${member.nome}.`,
              `Sua reserva do salão para <strong>${dataBR}</strong> foi <strong>CONFIRMADA</strong>.`,
            ]
          : [
              `Olá, ${member.nome}.`,
              `Sua solicitação de reserva para <strong>${dataBR}</strong> não foi confirmada desta vez.`,
            ],
      }
    }
  } else if (type === 'UPDATE' && statusChanged && record.status === 'cancelada') {
    const [to, member] = await Promise.all([adminEmails(), memberProfile()])
    const nome = member?.nome ?? 'Um irmão'
    mail = {
      to,
      subject: `Reserva cancelada — ${dataBR}`,
      title: 'Reserva cancelada',
      lines: [`<strong>${nome}</strong> cancelou a reserva do salão para <strong>${dataBR}</strong>.`],
    }
  }

  if (!mail || mail.to.length === 0) {
    return new Response('no-op', { status: 200 })
  }

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.warn('GMAIL_USER/GMAIL_APP_PASSWORD ausentes; e-mail não enviado.')
    return new Response('no-email-provider', { status: 200 })
  }

  const text = mail.lines.map((l) => l.replace(/<[^>]+>/g, '')).join('\n\n')
  const html = wrap(mail.title, mail.lines)

  const client = new SMTPClient({
    connection: {
      hostname: 'smtp.gmail.com',
      port: 465,
      tls: true,
      auth: { username: GMAIL_USER, password: GMAIL_APP_PASSWORD },
    },
  })

  try {
    await client.send({
      from: `${FROM_NAME} <${GMAIL_USER}>`,
      to: mail.to,
      subject: mail.subject,
      content: text,
      html,
    })
    await client.close()
  } catch (e) {
    console.error('Falha no envio SMTP:', e)
    return new Response('email-failed', { status: 200 })
  }

  return new Response('sent', { status: 200 })
})
