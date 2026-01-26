-- Initial schema for FundarMF
CREATE TYPE "Role" AS ENUM ('EMPLOYEE', 'MASTER');
CREATE TYPE "ProcessStatus" AS ENUM ('EM_ANDAMENTO', 'AGUARDANDO_CLIENTE', 'AGUARDANDO_FUNCIONARIO', 'CORRECAO_SOLICITADA', 'CONCLUIDO', 'CANCELADO');
CREATE TYPE "StepKey" AS ENUM ('ETAPA_1', 'ETAPA_2', 'ETAPA_3', 'ETAPA_4', 'ETAPA_5', 'ETAPA_6');
CREATE TYPE "StepSide" AS ENUM ('CLIENTE', 'FUNCIONARIO');
CREATE TYPE "DocumentItemKey" AS ENUM ('IDENTIFICACAO_SOCIOS', 'COMPROVANTE_RESIDENCIA', 'FOTO_FACHADA');
CREATE TYPE "DocumentItemStatus" AS ENUM ('PENDENTE', 'AGUARDANDO_VALIDACAO', 'APROVADO', 'REPROVADO');
CREATE TYPE "AuditActorRole" AS ENUM ('CLIENTE', 'FUNCIONARIO', 'MASTER', 'SYSTEM');
CREATE TYPE "ChatAuthorRole" AS ENUM ('CLIENTE', 'FUNCIONARIO');
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'WHATSAPP');
CREATE TYPE "SlaStatus" AS ENUM ('ON_TRACK', 'AT_RISK', 'OVERDUE', 'STOPPED');

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Process" (
  "id" TEXT PRIMARY KEY,
  "clientName" TEXT,
  "clientEmail" TEXT NOT NULL,
  "clientPhone" TEXT,
  "status" "ProcessStatus" NOT NULL DEFAULT 'EM_ANDAMENTO',
  "currentStep" "StepKey" NOT NULL DEFAULT 'ETAPA_1',
  "ownerId" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancelledByRole" "AuditActorRole",
  "cancelledById" TEXT,
  "cancelReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "Process" ADD CONSTRAINT "Process_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ProcessStep" (
  "id" TEXT PRIMARY KEY,
  "processId" TEXT NOT NULL,
  "stepKey" "StepKey" NOT NULL,
  "side" "StepSide" NOT NULL,
  "data" JSONB NOT NULL,
  "status" "ProcessStatus" NOT NULL,
  "locked" BOOLEAN NOT NULL DEFAULT FALSE,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcessStep_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProcessStep_processId_stepKey_key" ON "ProcessStep"("processId", "stepKey");

CREATE TABLE "Checklist" (
  "id" TEXT PRIMARY KEY,
  "processId" TEXT NOT NULL,
  "stepKey" "StepKey" NOT NULL,
  "items" JSONB NOT NULL,
  "status" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Checklist_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Checklist_processId_stepKey_key" ON "Checklist"("processId", "stepKey");

CREATE TABLE "DocumentItem" (
  "id" TEXT PRIMARY KEY,
  "processId" TEXT NOT NULL,
  "itemKey" "DocumentItemKey" NOT NULL,
  "status" "DocumentItemStatus" NOT NULL DEFAULT 'PENDENTE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "reason" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentItem_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DocumentItem_processId_itemKey_key" ON "DocumentItem"("processId", "itemKey");

CREATE TABLE "DocumentFile" (
  "id" TEXT PRIMARY KEY,
  "itemId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "data" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "uploadedByRole" "AuditActorRole" NOT NULL,
  "uploadedById" TEXT,
  CONSTRAINT "DocumentFile_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "DocumentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ChatThread" (
  "id" TEXT PRIMARY KEY,
  "processId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatThread_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ChatThread_processId_key" ON "ChatThread"("processId");

CREATE TABLE "ChatMessage" (
  "id" TEXT PRIMARY KEY,
  "threadId" TEXT NOT NULL,
  "authorRole" "ChatAuthorRole" NOT NULL,
  "authorId" TEXT,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Session" (
  "id" TEXT PRIMARY KEY,
  "role" "AuditActorRole" NOT NULL,
  "userId" TEXT,
  "clientEmail" TEXT,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastActiveAt" TIMESTAMP(3) NOT NULL,
  "rotatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "CustomerLinkToken" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
  "otpHash" TEXT,
  "otpExpiresAt" TIMESTAMP(3),
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ProcessOwnerHistory" (
  "id" TEXT PRIMARY KEY,
  "processId" TEXT NOT NULL,
  "ownerId" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedBy" TEXT,
  CONSTRAINT "ProcessOwnerHistory_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AuditEvent" (
  "id" TEXT PRIMARY KEY,
  "actorRole" "AuditActorRole" NOT NULL,
  "actorId" TEXT,
  "actorEmail" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB NOT NULL,
  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "SlaConfigStep" (
  "id" TEXT PRIMARY KEY,
  "stepKey" "StepKey" NOT NULL,
  "side" "StepSide" NOT NULL,
  "durationHours" INTEGER NOT NULL,
  "alertPercent" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "SlaConfigStep_stepKey_side_key" ON "SlaConfigStep"("stepKey", "side");

CREATE TABLE "SlaEvent" (
  "id" TEXT PRIMARY KEY,
  "processId" TEXT NOT NULL,
  "stepKey" "StepKey" NOT NULL,
  "side" "StepSide" NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "status" "SlaStatus" NOT NULL,
  "lastNotifiedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SlaEvent_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SlaEvent_processId_stepKey_side_key" ON "SlaEvent"("processId", "stepKey", "side");

CREATE TABLE "Report" (
  "id" TEXT PRIMARY KEY,
  "processId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "data" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Report_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Notification" (
  "id" TEXT PRIMARY KEY,
  "channel" "NotificationChannel" NOT NULL,
  "recipient" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Enforce one active process per email (ATIVO = not CONCLUIDO or CANCELADO)
CREATE UNIQUE INDEX "Process_active_email_unique"
  ON "Process"("clientEmail")
  WHERE "status" NOT IN ('CONCLUIDO', 'CANCELADO');
