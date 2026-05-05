# FundarMF

Plataforma de **workflow para abertura de empresa** com operação assistida: o cliente preenche dados via link seguro (OTP), anexa documentos e acompanha o andamento; o time interno (Operador/Master) conduz validações, checklist e avanço por Kanban — com auditoria e notificações automatizadas.

![FundarMF - Tela](1.png)

## Por que existe
Abrir empresa é um processo cheio de micro-etapas, dependências e documentos. O FundarMF organiza isso como um pipeline claro, com rastreabilidade e comunicação ativa:
- reduz retrabalho (etapas travadas após envio, correção por campos e idempotência em ações sensíveis)
- dá previsibilidade (SLA por etapa e por lado: cliente vs operador)
- melhora operação (Kanban e painéis por papel)
- garante histórico (auditoria e eventos)

## Stack e arquitetura
- **Frontend:** Next.js 14 (App Router) + Tailwind + Vitest
- **Backend:** NestJS + Prisma + PostgreSQL + Vitest
- **Assíncrono/Jobs:** `pg-boss` (fila no Postgres; neste snapshot, parte do comportamento roda dentro do runtime da API)
- **Notificações:** e-mail (SMTP/Resend) + WhatsApp (Twilio) com modo `mock/terminal/real`
- **Integrações:** webhook opcional para n8n

Estrutura do repositório:
- `backend/api`: API NestJS (auth, processos, documentos, notificações, SLA, auditoria)
- `backend/packages/shared`: tipos/enums compartilhados (`@fundarmf/shared`)
- `frontend`: Web Next.js (Master / Operador / Cliente)
- `n8n`: `.env` local para quem usar automações (opcional)
- `scripts`: verificação do lead agent + script E2E local do formulário

## Fluxo do produto (visão rápida)
### Papéis
- **MASTER:** administração e supervisão (painel e ações internas)
- **OPERADOR:** operação (criar processo, link/OTP, revisão e Kanban)
- **CLIENTE:** onboarding via link seguro + OTP, envio de dados e documentos

### Etapas do processo (StepKey)
- `ETAPA_1` → início
- `ETAPA_2` → dados e informações (cliente)
- `ETAPA_3` → estrutura jurídica (operador)
- `ETAPA_4` → checklist (cliente)
- `ETAPA_5` → endereço (cliente)
- `ETAPA_6` → documentos (cliente)

### Kanban do operador (KanbanStage)
Colunas fixas (exibidas em `/operator/kanban` e no dashboard do operador):
- `VIABILIDADE`
- `DOC_INICIAL_APROVADA`
- `DBE_RECEITA_FEDERAL`
- `PREPARACAO_DOCUMENTOS`
- `AGUARDANDO_DOCUMENTOS`
- `ANALISE_JUCEB`
- `FINALIZADO`

Ao mover um card, a API atualiza `Process.kanbanStage`, registra auditoria e pode notificar automaticamente o cliente.

## Quickstart (dev local)
Pré-requisitos:
- Node.js **20.x**
- pnpm **9.x**
- Docker + Docker Compose (no Windows, Docker Desktop “Running”)

### 1) Banco (Postgres + serviços auxiliares)
```bash
cd backend
pnpm db:up
```

### 2) Dependências
```bash
cd backend
pnpm install

cd ../frontend
pnpm install
```

### 3) Prisma (generate + migrations + seed)
```bash
cd backend
pnpm --filter fundarmf-api prisma:generate
pnpm --filter fundarmf-api prisma:deploy
pnpm --filter fundarmf-api prisma:seed
```

### 4) Subir API
```bash
cd backend
pnpm dev
```
API em `http://localhost:4000` (Swagger em `http://localhost:4000/docs` quando `SWAGGER_ENABLED=true`).

### 5) Subir Frontend
```bash
cd frontend
pnpm dev
```
Web em `http://localhost:3000`.

## Scripts úteis
### Verificação padrão do repositório (Lead Agent)
Executa lint/build/test no backend e frontend:
```powershell
.\scripts\lead-agent-verify.ps1
```
Flags opcionais:
```powershell
.\scripts\lead-agent-verify.ps1 -SkipBackend
.\scripts\lead-agent-verify.ps1 -SkipFrontend
```

### E2E local (formulário do cliente + upload)
Sobe DB, aplica migrations/seed, inicia API e executa um fluxo completo via script:
```powershell
.\scripts\run-local-form-e2e.ps1
```
Relatório gerado em `docs/local-form-test-report.md`.

## Variáveis de ambiente
Arquivos de referência:
- `backend/.env.example` (API + jobs)
- `frontend/.env.example`

### Backend (`backend/.env`)
Pontos principais:
- `DATABASE_URL` (Postgres)
- `SESSION_SECRET` + política de sessão (`SESSION_TTL_HOURS`, `SESSION_ROTATE_MINUTES`, `COOKIE_SECURE`)
- link/OTP (`LINK_TTL_HOURS`, `OTP_TTL_MINUTES`, `OTP_RESEND_COOLDOWN_MINUTES`)
- rate limit (`RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `TRUST_PROXY`)
- uploads (`UPLOAD_MAX_*`)
- notificações (`NOTIFY_MODE`, `EMAIL_PROVIDER`, `SMTP_*`/`RESEND_API_KEY`, `TWILIO_*`)
- n8n (`N8N_WEBHOOK_*`)

### Frontend (`frontend/.env`)
- `NEXT_PUBLIC_API_URL` (usado pelo browser)
- `API_INTERNAL_URL` (útil para rotas server-side quando aplicável)

## Notificações e integrações
### Modos de notificação (`NOTIFY_MODE`)
- `mock`: não envia, apenas registra
- `terminal`: não envia, imprime preview (HTML/texto)
- `real`: envia via provedor configurado

### Webhook n8n (opcional)
Quando `N8N_WEBHOOK_ENABLED=true` e `N8N_WEBHOOK_URL` está configurado, a API dispara eventos (ex.: início de processo, correções, conclusão). Útil para automações e integrações com CRM/WhatsApp/Slack.

## Deploy (Render)
No backend existe o script:
```bash
cd backend
pnpm deploy:render
```
Ele executa `prisma:generate`, build, `prisma:deploy` e `prisma:seed`.

## Segurança (resumo)
- Autenticação por **cookie de sessão** (rotas internas e cliente após OTP)
- Rate limiting na API (com suporte a `TRUST_PROXY` para produção atrás de proxy)
- Ações sensíveis com **idempotência** via header `idempotency-key` em alguns endpoints

## Remotes (GitHub)
Este workspace tem mais de um alvo:
- Full repo: `origin` → `https://github.com/GodHercules/FundarMF.git`
- Backend-only: `back` → `https://github.com/GodHercules/FundarMF_Back.git`

## Contribuição
- Mantenha mudanças pequenas e testáveis
- Rode `.\scripts\lead-agent-verify.ps1` antes de abrir PR
- Evite alterar `.env` com segredos (use `.env.example` como base)
