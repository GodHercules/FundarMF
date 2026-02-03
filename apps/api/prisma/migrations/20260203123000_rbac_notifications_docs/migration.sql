-- Rename enum values to match new role naming
ALTER TYPE "Role" RENAME VALUE 'EMPLOYEE' TO 'OPERATOR';
ALTER TYPE "ProcessStatus" RENAME VALUE 'AGUARDANDO_FUNCIONARIO' TO 'AGUARDANDO_OPERADOR';
ALTER TYPE "StepSide" RENAME VALUE 'FUNCIONARIO' TO 'OPERADOR';
ALTER TYPE "AuditActorRole" RENAME VALUE 'FUNCIONARIO' TO 'OPERADOR';
ALTER TYPE "ChatAuthorRole" RENAME VALUE 'FUNCIONARIO' TO 'OPERADOR';
ALTER TYPE "ChatAuthorRole" ADD VALUE IF NOT EXISTS 'BOT';

-- User WhatsApp contact
ALTER TABLE "User" ADD COLUMN "whatsapp" TEXT;

-- DocumentItem per partner
ALTER TABLE "DocumentItem" ADD COLUMN "socioId" TEXT;
DROP INDEX "DocumentItem_processId_itemKey_key";
CREATE UNIQUE INDEX "DocumentItem_processId_itemKey_socioId_key" ON "DocumentItem"("processId", "itemKey", "socioId");

-- Chat bot state
ALTER TABLE "ChatThread" ADD COLUMN "botState" JSONB;
ALTER TABLE "ChatThread" ADD COLUMN "handoffAt" TIMESTAMP(3);

-- In-app notifications
CREATE TABLE "UserNotification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "processId" TEXT,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserNotification_userId_readAt_idx" ON "UserNotification"("userId", "readAt");

ALTER TABLE "UserNotification"
  ADD CONSTRAINT "UserNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserNotification"
  ADD CONSTRAINT "UserNotification_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE SET NULL ON UPDATE CASCADE;
