# FundarMF

Sistema de workflow para abertura de empresa. Stack moderna com NestJS (API), Next.js (web), PostgreSQL e worker (pg-boss).

## Novidade: Kanban do operador
- Novo quadro Kanban em `/operator/kanban` com drag-and-drop (desktop e mobile).
- Colunas fixas:
  - `VIABILIDADE`
  - `DBE/Receita Federal`
  - `Preparação Documentos`
  - `Aguardando Documentos`
  - `Analise JUCEB`
  - `Finalizado`
- Ao mover um card, a API atualiza `Process.kanbanStage`, registra auditoria e dispara e-mail ao cliente.
- Entrega de e-mail continua assíncrona via fila (`pg-boss`) com retries/backoff e logs em `Notification`.

## Viso geral da arquitetura
- `backend/api`: API NestJS + Prisma (PostgreSQL)
- `backend/worker`: jobs (pg-boss) para tarefas assncronas
- `backend/packages/shared`: tipos/enums compartilhados
- `frontend`: Next.js (UI)

## Pr-requisitos
- Node.js 20+
- pnpm 9.x
- Docker Desktop (Windows) ou Docker Engine + Compose

> Dica: no Windows, garanta que o Docker Desktop esteja aberto e com status "Running" antes de rodar `docker compose`.

## Como rodar local (passo a passo detalhado)

### 1) Subir o banco via Docker
**Onde rodar:** dentro de `backend` (cada pasta roda de forma independente).

```bash
cd backend
docker compose up -d
```

**Por que rodar:** sobe o Postgres usado pela API e pelo Worker.

**Como validar:**
```bash
docker ps
```
Deve aparecer um container de Postgres.

---

### 2) Instalar dependncias
**Onde rodar:** dentro de `backend` e `frontend` (separadamente).

```bash
cd backend
pnpm install

cd ../frontend
pnpm install
```

**Por que rodar:** instala todas as dependncias do monorepo.

---

### 3) Rodar migrao do Prisma
**Onde rodar:** dentro de `backend`.

```bash
cd backend
pnpm --filter fundarmf-api exec prisma migrate dev -n add_otp_tracking
```

**Por que rodar:** aplica o schema atualizado (inclui campos `otpSentCount` e `lastOtpSentAt`).

---

### 4) Subir a API (backend)
**Onde rodar:** dentro de `backend`.

```bash
cd backend
pnpm --filter fundarmf-api dev
```

**O que acontece:**
- API sobe em `http://localhost:4000`.
- Rotas so expostas com cookie de sesso.

---

### 5) Subir o Frontend
**Onde rodar:** dentro de `frontend`, em outro terminal.

```bash
cd frontend
pnpm dev
```

**O que acontece:**
- Web sobe em `http://localhost:3000`.

---

### 6) (Opcional, mas recomendado) Subir o Worker
**Onde rodar:** dentro de `backend`, em outro terminal.

```bash
cd backend
pnpm --filter fundarmf-worker dev
```

**Por que rodar:** executa jobs peridicos (SLA, relatrios, cancelamento por inatividade) e o envio assncrono de notificaes (e-mail/WhatsApp).

---

## Notificaes (e-mail + WhatsApp)
- Os disparos continuam na API (servios de Auth/Process/Chat/Document).
- A entrega real ocorre no `backend/worker` via pg-boss.
- Modos:
  - `NOTIFY_MODE=mock`: no envia; loga destino + contedo.
  - `NOTIFY_MODE=terminal`: no envia; imprime preview (HTML do e-mail + texto do WhatsApp).
  - `NOTIFY_MODE=real`: envia de verdade via provedor.

### Webhook do n8n (opcional)
Se `N8N_WEBHOOK_ENABLED=true` e `N8N_WEBHOOK_URL` estiver configurado, a API dispara eventos para o n8n.

O payload inclui, quando aplicvel:
- `reason`: tipo do evento (ex: `process_started`, `correction_requested`, `process_completed`)
- `process`: metadados do processo (id, status, etapa atual, progresso, etc.)
- `emails`: rascunhos prontos de e-mail em HTML e texto:
  - `emails.client`, `emails.operator`, `emails.both`
  - cada item: `{ target: "client"|"operator"|"both", to?, subject, text, html }`

### Endpoints de teste (apenas MASTER)
- `POST /notifications/test-email`
  - body: `{ "to": "email@exemplo.com", "subject": "Teste", "body": "Mensagem" }`
- `POST /notifications/test-whatsapp`
  - body: `{ "to": "+5511999999999", "body": "Mensagem" }`

## Fluxo principal (como testar)
1. Abra `http://localhost:3000` (login nico).
2. Entre com usurio **MASTER** ou **OPERADOR**.
3. Se for **OPERADOR**, clique em "Iniciar processo" e envie o link seguro para o cliente.
4. Abra o link como cliente + OTP.
5. Preencha o formulrio e envie.
6. O cliente ver a tela de confirmao e aguardar contato por e-mail/WhatsApp.

---

## Login nico
- A pgina `/`  o login nico para Master e Operador.
- O usurio  redirecionado automaticamente:
  - `MASTER` -> `/master/dashboard`
  - `OPERADOR` -> `/operator/start`

---

## Link seguro do cliente
- Link expira em **5 dias** (`LINK_TTL_HOURS=120`).
- OTP expira em **24 horas** (`OTP_TTL_MINUTES=1440`).
- Reenvio de OTP limitado:
  - mximo **5 OTPs** por link
  - somente **1 a cada 24h**

Se o cliente no preencher os dados em 5 dias, o processo  cancelado automaticamente por inatividade.

---

## Variveis de ambiente importantes

### backend/.env (nico arquivo para API e Worker)
```
  DATABASE_URL=postgresql://fundarmf:fundarmf@localhost:5499/fundarmf?schema=public
  API_PORT=4000
SESSION_SECRET=change-me
SESSION_TTL_HOURS=48
SESSION_ROTATE_MINUTES=60
COOKIE_SECURE=false
OTP_TTL_MINUTES=1440
LINK_TTL_HOURS=120
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=1000
UPLOAD_MAX_FILE_MB=8
UPLOAD_MAX_FILES_PER_ITEM=12
UPLOAD_MAX_TOTAL_MB=60
  FRONTEND_URL=http://localhost:3000
  EMAIL_FROM=contato@fundarmf.com.br
  EMAIL_REPLY_TO=
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=SEU_USER
  SMTP_PASS=SEU_PASS
  EMAIL_PROVIDER=smtp
  RESEND_API_KEY=
  NOTIFY_MODE=mock
  NOTIFY_EMAIL_ENABLED=true
  NOTIFY_WHATSAPP_ENABLED=true
  NOTIFY_RETRY_LIMIT=5
  NOTIFY_RETRY_DELAY_MS=60000
  NOTIFY_RETRY_BACKOFF=true
  NOTIFY_SEND_TIMEOUT_MS=15000
  NOTIFY_TEMPLATE_DIR=
  WHATSAPP_BRAND=MF Contabilidade
  COMPANY_NAME=MF Contabilidade
  COMPANY_LOCATION=Bahia, Brazil
  WORKER_AUTO_ASSIGN_EVERY_MS=3600000
  WORKER_SLA_CHECK_EVERY_MS=3600000
  WORKER_REPORTS_EVERY_MS=3600000
  WORKER_CANCEL_INACTIVE_EVERY_MS=3600000
  WORKER_CONCURRENCY=3
  ```
  
  ### backend/api/.env
  No usado. A API l as mesmas variveis do `backend/.env`.

### frontend/.env
```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

---

## Seeds (usurio inicial)
- **MASTER**: `master@fundarmf.local` / `Master@123`

Operadores so criados pelo Master no painel.

---

## Comandos rpidos (resumo)
```bash
# Subir banco (backend)
cd backend
docker compose up -d

# Instalar dependncias
# backend
cd backend
pnpm install
# frontend
cd ../frontend
pnpm install

# Migrao (backend)
cd ../backend
pnpm --filter fundarmf-api exec prisma migrate dev -n add_otp_tracking

# Rodar API (backend)
pnpm --filter fundarmf-api dev

# Rodar Web (frontend)
cd ../frontend
pnpm dev

# Rodar Worker (backend)
cd ../backend
pnpm --filter fundarmf-worker dev
```

---

## Endpoints principais
- `POST /auth/login`
- `POST /auth/customer/request-link`
- `POST /auth/customer/verify`
- `POST /auth/customer/resend-otp`
- `POST /auth/logout`
- `GET /auth/me`

- `POST /processes`
- `GET /processes`
- `GET /processes/:id`
- `POST /processes/:id/send-link`
- `PUT /processes/:id/steps`
- `PATCH /processes/:id/kanban-stage`
- `POST /processes/:id/submit-step`
- `POST /processes/:id/request-correction`
- `POST /processes/:id/cancel`

OpenAPI: `http://localhost:4000/docs`

---

## Exemplos de uso da API (curl)

### Login nico
```bash
curl -i -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"master@fundarmf.local","password":"Master@123"}'
```

### Criar processo (operador/master)
```bash
curl -i -X POST http://localhost:4000/processes \
  -H "Content-Type: application/json" \
  -d '{"nome":"Cliente Teste","email":"cliente@teste.com","telefone":"+5511999999999","sendEmail":true,"sendWhatsapp":true}'
```

### Solicitar link seguro do cliente
```bash
curl -i -X POST http://localhost:4000/auth/customer/request-link \
  -H "Content-Type: application/json" \
  -d '{"email":"cliente@teste.com","whatsapp":"+5511999999999"}'
```

### Verificar link do cliente + OTP
```bash
curl -i -X POST http://localhost:4000/auth/customer/verify \
  -H "Content-Type: application/json" \
  -d '{"token":"TOKEN_DO_LINK","otp":"123456"}'
```

### Reenviar OTP
```bash
curl -i -X POST http://localhost:4000/auth/customer/resend-otp \
  -H "Content-Type: application/json" \
  -d '{"token":"TOKEN_DO_LINK"}'
```

---

## Deploy (Vercel + Render)

### Frontend na Vercel
1. Importe o repositrio na Vercel.
2. Defina a raiz do app como `frontend`.
3. Variveis de ambiente recomendadas:
   - `NEXT_PUBLIC_API_URL` com a URL do backend do Render.
4. Build command:
```
pnpm install && pnpm build
```
5. Output padro do Next.js (sem alteraes).

### Backend no Render
1. Crie um novo servio Web (Node).
2. Defina a raiz como `backend`.
  3. Variveis de ambiente necessrias:
     - `DATABASE_URL`
     - `SESSION_SECRET`
     - `FRONTEND_URL`
     - `COOKIE_SECURE=true`
     - `OTP_TTL_MINUTES=1440`
     - `LINK_TTL_HOURS=120`
     - **Notificaes (fila + worker):**
       - `NOTIFY_MODE=real`
       - `NOTIFY_EMAIL_ENABLED=true`
       - `NOTIFY_WHATSAPP_ENABLED=true`
     - **Para e-mail (Resend - sem domnio prprio):**
       - `EMAIL_PROVIDER=resend`
       - `RESEND_API_KEY=...`
       - `EMAIL_FROM=seu-remetente-compartilhado@...`
     - **Para e-mail (SMTP - alternativa):**
       - `EMAIL_PROVIDER=smtp`
       - `SMTP_HOST=...`
       - `SMTP_PORT=587`
       - `SMTP_USER=...`
       - `SMTP_PASS=...`
       - `EMAIL_FROM=...`
     - **Para WhatsApp (Twilio Sandbox):**
       - `WHATSAPP_PROVIDER=twilio`
       - `TWILIO_ACCOUNT_SID=...`
       - `TWILIO_AUTH_TOKEN=...`
       - `TWILIO_WHATSAPP_FROM=whatsapp:+14155238886`
4. Build command:
```
pnpm install && pnpm deploy:render
```
5. Start command:
```
pnpm --filter fundarmf-api start
```

### Worker no Render
1. Crie um Worker Service.
2. Defina a raiz como `backend`.
  3. Variveis:
     - `DATABASE_URL`
     - `WORKER_CONCURRENCY`
     - `WORKER_CANCEL_INACTIVE_EVERY_MS=3600000`
     - `NOTIFY_MODE=real` (ou `terminal` / `mock`)
     - `NOTIFY_EMAIL_ENABLED=true`
     - `NOTIFY_WHATSAPP_ENABLED=true`
     - `EMAIL_PROVIDER` + credenciais (Resend ou SMTP)
     - `WHATSAPP_PROVIDER` + credenciais (Twilio Sandbox)
4. Build command:
```
pnpm install && pnpm --filter fundarmf-worker build
```
5. Start command:
```
pnpm --filter fundarmf-worker start
```

---

## Troubleshooting
**Erro no Docker:**
```
open //./pipe/dockerDesktopLinuxEngine: O sistema nao pode encontrar o arquivo especificado.
```
Soluo: abra o **Docker Desktop** e aguarde ele ficar "Running".

**Erro Prisma script:**
```
None of the selected packages has a "prisma" script
```
Use:
```
pnpm --filter fundarmf-api exec prisma migrate dev -n add_otp_tracking
```

---

Se quiser, posso adicionar mais detalhes de deploy, alertas de segurana ou um guia rpido de troubleshooting em produo.
