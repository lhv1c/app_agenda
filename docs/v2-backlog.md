# Backlog v2 — Agenda do Salão (Ciência e Justiça)

Lista de funcionalidades planejadas para a v2. Cada item tem escopo, dependências, esforço estimado e perguntas em aberto a resolver no brainstorming dele. Cada item vira seu próprio ciclo spec → plano → implementação.

**Contexto atual (v1, no ar):** reserva de dia inteiro (1 confirmada por data), janela de +4 a +60 dias, 1 reserva ativa por membro, campos `num_convidados` e `observacoes`. Papéis admin/membro. Notificações por e-mail (Gmail SMTP da Loja via Edge Function `notify-status`). Recuperação de senha. PWA instalável.

---

## Ordem sugerida

1. ~~Editar perfil + telefone~~ ✅ FEITO (2026-06-14) — WhatsApp no cadastro/perfil + link wa.me admin.
2. Gestão de convites no painel _(remove dor operacional de mexer no banco)_
3. ~~Bloquear datas~~ ✅ FEITO (2026-06-14) — admin bloqueia/desbloqueia direto no calendário; membro vê motivo.
4. Lembrete automático _(depende de habilitar agendamento; e-mail já pronto)_
5. Web Push _(complementa o lembrete)_
6. Code-split do bundle _(otimização)_
7. Capacitor / lojas _(só se decidir publicar nas stores)_

---

## Escolhidos para v2

### 1. Editar perfil + telefone
**O quê:** tela "Meu perfil" para o membro editar nome e telefone. Coletar telefone no cadastro. Telefone fica visível pro admin (contato) e serve de base pro futuro link WhatsApp.

**Mudanças:** coluna `telefone` em `profiles`; campo no `SignupPage`; nova página de perfil; mostrar telefone na lista do admin. RLS `profiles_update_own` já existe.

**Esforço:** baixo. **Dependências:** nenhuma.

**Perguntas em aberto:**
- Telefone obrigatório no cadastro ou opcional?
- Máscara/validação BR (`(44) 9xxxx-xxxx`)?
- Membros antigos (sem telefone): pedir no próximo login?

---

### 2. Gestão de convites no painel
**O quê:** tela admin para listar, criar, ativar/desativar e acompanhar uso dos códigos de convite. Hoje isso é manual via SQL na tabela `invite_codes`.

**Mudanças:** UI admin sobre `invite_codes`; possíveis colunas novas (`created_at`, `created_by`, `rotulo`, `max_usos`, `usos`); RLS admin para select/insert/update (service_role já tem select via `signup-with-invite`). Rodar `notify pgrst, 'reload schema'` após DDL.

**Esforço:** médio. **Dependências:** nenhuma.

**Perguntas em aberto:**
- Código único compartilhado (modelo atual) ou um por convidado?
- Limite de usos por código? Expiração por data?
- Gerar código aleatório automático ou admin digita?

---

### 3. Bloquear datas
**O quê:** admin marca datas como indisponíveis (feriado, manutenção, evento da Loja) sem ser uma reserva. Calendário mostra bloqueado; reserva nessas datas é rejeitada.

**Mudanças:** nova tabela `blocked_dates` (`data`, `motivo`, `created_by`, `created_at`); trigger `validate_reservation_insert` passa a rejeitar data bloqueada; view `date_availability` considera bloqueios; UI admin para criar/remover; calendário do membro reflete. RLS: admin insert/delete, todos select.

**Esforço:** médio. **Dependências:** nenhuma.

**Perguntas em aberto:**
- Bloquear data única ou intervalo (range)?
- Motivo do bloqueio visível pro membro ou só interno?
- Bloqueio sobre data que já tem reserva confirmada: permitir? Avisar?

---

### 4. Lembrete automático
**O quê:** lembrete enviado automaticamente X dias antes do evento confirmado (e-mail; push quando existir). Reduz esquecimento/no-show.

**Mudanças:** job agendado (pg_cron no Supabase ou Edge Function agendada) roda diário, busca reservas `confirmada` com `data = hoje + N`, dispara e-mail reusando a lógica do `notify-status` (Gmail SMTP). Habilitar extensão de agendamento no projeto.

**Esforço:** médio. **Dependências:** e-mail já funciona; push é opcional (ver item Web Push). Precisa habilitar pg_cron/agendamento.

**Perguntas em aberto:**
- Quantos dias antes? (ex.: 7 e 1)
- Avisa só o membro, ou admins também (lembrete de evento na agenda da Loja)?
- Canal inicial só e-mail, push depois?

---

## Carregados da v1 (já decididos, ainda não feitos)

### 5. Web Push
Notificação no celular sem custo. Precisa: tabela `push_subscriptions`, chaves VAPID, registro no service worker (PWA já tem manifest + SW). A mesma `notify-status` dispara e-mail e push juntos. iPhone só recebe com o PWA instalado na tela inicial. Complementa o lembrete automático.

### 6. Code-split do bundle
Bundle de produção passa de 500KB (warning no build, não bloqueia). Aplicar `import()` dinâmico nas rotas para reduzir o carregamento inicial. Pura otimização.

### 7. Capacitor / lojas
Empacotar o mesmo código PWA em shell nativo iOS/Android e publicar nas lojas. Custo: Apple US$99/ano + Google Play US$25. Só fazer se houver decisão de publicar nas stores — o PWA instalável já cobre o uso "app de celular".
