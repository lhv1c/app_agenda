# Agenda do Salão — Irmão Cristiano Cano

Agenda de reservas do salão da Loja Maçônica **Ciência e Justiça** (Marialva).
Membros solicitam datas, administradores aprovam, todos são avisados por e-mail.

## Stack

- **Front:** React 19 + TypeScript + Vite, Tailwind CSS v4, React Router, TanStack Query
- **Back:** Supabase (Postgres + Auth + Edge Functions em Deno)
- **PWA:** vite-plugin-pwa

## Funcionalidades

- Cadastro restrito por **código de convite** da Loja (validado server-side)
- Login, recuperação de senha (fluxo nativo Supabase)
- Papéis **admin** / **member**
- Calendário, solicitação de reserva, aprovação/recusa pelo admin
- Notificações por e-mail (nova solicitação, confirmação/recusa, cancelamento)

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha com as chaves do seu projeto Supabase
npm run dev                  # http://localhost:5173
```

Variáveis (`.env.local`, não versionado):

| Variável | Onde achar |
|----------|------------|
| `VITE_SUPABASE_URL` | Supabase > Project Settings > API |
| `VITE_SUPABASE_ANON_KEY` | idem (chave pública anon) |

## Scripts

| Comando | Ação |
|---------|------|
| `npm run dev` | Servidor de desenvolvimento (HMR) |
| `npm run build` | Type-check + build de produção |
| `npm run preview` | Serve o build localmente |
| `npm run lint` | ESLint |

## Backend (Supabase)

- Migration inicial: `supabase/migrations/0001_init.sql`
- Edge Functions:
  - `signup-with-invite` — valida convite e cria usuário
  - `notify-status` — dispara e-mails (Gmail SMTP da Loja)
- Após qualquer DDL, recarregar o schema do PostgREST:
  `notify pgrst, 'reload schema';`

Segredos das Edge Functions (painel Supabase, **não** no `.env`):
`GMAIL_USER`, `GMAIL_APP_PASSWORD` (senha de app, exige 2FA na conta da Loja).

Para recuperação de senha, incluir a URL `/redefinir-senha` em
Authentication > URL Configuration > Redirect URLs.
