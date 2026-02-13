CREATE TYPE "KanbanStage" AS ENUM ('VIABILIDADE', 'DBE_RECEITA_FEDERAL', 'PREPARACAO_DOCUMENTOS', 'AGUARDANDO_DOCUMENTOS', 'ANALISE_JUCEB', 'FINALIZADO');

ALTER TABLE "Process"
ADD COLUMN "kanbanStage" "KanbanStage" NOT NULL DEFAULT 'VIABILIDADE';

CREATE INDEX "Process_kanbanStage_ownerId_createdAt_idx"
ON "Process"("kanbanStage", "ownerId", "createdAt");

