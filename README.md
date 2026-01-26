# FundarMF

Sistema de Workflow para Abertura de Empresa (base para futuras alterações). Stack moderna, com backend NestJS, front Next.js + React, PostgreSQL, Redis + BullMQ, OpenAPI e jobs.

## Stack escolhida
- Frontend: Next.js + React + TypeScript + Tailwind
- Backend: NestJS + TypeScript + Prisma
- Banco: PostgreSQL
- Fila/Jobs: Redis + BullMQ
- PDF: pdfkit

## Estrutura
```
apps/
  api/        # NestJS API
  web/        # Next.js front (Cliente, Funcionário, Master)
  worker/     # Jobs (auto-atribuição, SLA, relatório PDF)
packages/
  shared/     # tipos e enums compartilhados
```

## Setup rápido
1) Subir banco, Redis e servidor SMTP local:
```
docker compose up -d postgres redis mailpit
```
Mailpit (caixa de entrada dev): `http://localhost:8025`

2) Instalar dependências:
```
pnpm install
```

3) Envs já criados no repositório (ajuste se necessário):
- `apps/api/.env`
- `apps/worker/.env`
- `apps/web/.env`

4) Rodar migrations + seed:
```
cd apps/api
pnpm prisma:migrate
pnpm prisma:seed
```

5) Rodar serviços em dev (apenas 2 comandos):
```
pnpm dev:back
pnpm dev:front
```

## Variáveis de ambiente principais
**apps/api/.env**
- `DATABASE_URL`
- `REDIS_URL`
- `API_PORT`
- `SESSION_TTL_HOURS` (48h)
- `SESSION_ROTATE_MINUTES`
- `COOKIE_SECURE` (false em dev http)
- `OTP_TTL_MINUTES`
- `LINK_TTL_HOURS`
- `UPLOAD_MAX_FILE_MB` / `UPLOAD_MAX_FILES_PER_ITEM` / `UPLOAD_MAX_TOTAL_MB`
- `EMAIL_FROM`
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` (Mailpit em dev ou SMTP real)
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_WHATSAPP_FROM` / `TWILIO_MESSAGING_SERVICE_SID` (WhatsApp via Twilio)
- `WHATSAPP_BRAND` / `COMPANY_NAME` / `COMPANY_LOCATION` (identidade das mensagens)

**apps/worker/.env**
- `DATABASE_URL`
- `REDIS_URL`
- `WORKER_CONCURRENCY`

**apps/web/.env**
- `NEXT_PUBLIC_API_URL`

## Seeds (credenciais de teste)
- **MASTER**: `master@fundarmf.local` / `Master@123`
- **Funcionário**: `funcionario@fundarmf.local` / `Func@123`
- **Cliente exemplo**: `cliente@fundarmf.local` (OTP será retornado na resposta da API em dev)

## Endpoints principais (API)
- `POST /auth/customer/request-link`
- `POST /auth/customer/verify`
- `POST /auth/employee/login`
- `POST /auth/master/login`
- `POST /auth/logout`
- `GET /auth/me`

- `POST /processes` (cliente)
- `GET /processes` (lista por papel)
- `GET /processes/:id`
- `PUT /processes/:id/steps`
- `POST /processes/:id/submit-step`
- `POST /processes/:id/approve-step`
- `POST /processes/:id/request-correction`
- `POST /processes/:id/cancel`

- `POST /documents/:processId/items/:itemKey/upload`
- `POST /documents/:processId/items/:itemKey/validate`
- `GET /documents/:processId/items/:itemKey/preview/:fileId`
- `GET /documents/:processId/items/:itemKey/download/:fileId`

- `GET /checklists/:processId/step/:stepKey`
- `PUT /checklists/:processId/step/:stepKey`

- `GET /chats/:processId`
- `POST /chats/:processId/messages`

- `GET /sla/config` (master)
- `PUT /sla/config` (master)

- `GET /admin/users` (master)
- `POST /admin/users` (master)
- `GET /admin/processes/unassigned` (master)
- `POST /admin/processes/:id/assign` (master)
- `GET /admin/audit` (master)
- `GET /admin/reports/:processId` (master)

OpenAPI: `http://localhost:4000/docs`

## Fluxos críticos (resumo)
1) **Cliente** solicita link → recebe OTP se não houver sessão ativa → valida link → cria processo → preenche etapas → envia para validação.
2) **Funcionário** recebe caso (auto-atribuição) → valida checklist + documentos → aprova ou solicita correções → quando etapa 6 aprovada, processo é concluído.
3) **Master** acompanha tudo, configura SLA, transfere dono, audita e pode cancelar processos.

## Regras implementadas
- **Unicidade**: constraint DB garante 1 processo ativo por e-mail.
- **Cancelamento**: motivo obrigatório; bloqueia edição, para SLAs e notifica envolvidos.
- **Dono exclusivo**: update do owner com lock transacional + histórico.
- **Auto-atribuição**: least-load com fallback round-robin (baseado no último assignment).
- **Etapas travadas**: cliente envia para validação; funcionário aprova ou solicita correção.
- **Checklist obrigatório**: aprovação só quando checklist completo.
- **Documentos**: validação por item, reprovação por lote, versionamento simples.
- **SLA**: eventos por etapa/lado com alertas por percentual.
- **Relatório final**: PDF assíncrono via worker.
- **Storage**: interface pronta para migração futura a S3 (hoje em Postgres).
- **WhatsApp**: provider mock via interface.

## Observações de segurança
- Cookies HttpOnly + Secure (configurável em dev)
- Sessões rotativas
- Rate limit nas rotas (global, ajustar no env)
- Logs/auditoria persistidos

## Árvore de pastas
```
.
├── apps
│   ├── api
│   │   ├── prisma
│   │   ├── src
│   │   └── tests
│   ├── web
│   │   ├── src
│   │   └── index.html
│   └── worker
│       └── src
├── packages
│   └── shared
├── docker-compose.yml
└── README.md
```

## Comandos úteis
- `pnpm dev:back` (api + worker)
- `pnpm dev:front` (web)
- `pnpm dev` (todos)
- `pnpm -r dev` (todos)
- `cd apps/api && pnpm prisma:seed`
- `cd apps/worker && pnpm dev`
- `cd apps/web && pnpm dev`

Se quiser, posso aprofundar o front (formularios completos, preview real de PDF/imagem, upload por item) e adicionar testes de integração.
