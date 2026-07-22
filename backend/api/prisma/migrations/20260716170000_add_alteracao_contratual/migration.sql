CREATE TYPE "AlteracaoContratualStage" AS ENUM (
  'SOLICITACAO_RECEBIDA',
  'ANALISE_JURIDICA',
  'AJUSTES_DOCUMENTAIS',
  'PROTOCOLO',
  'FINALIZADO'
);

CREATE TABLE "AlteracaoContratual" (
  "id" TEXT NOT NULL,
  "processId" TEXT NOT NULL,
  "alterationType" TEXT NOT NULL,
  "stage" "AlteracaoContratualStage" NOT NULL DEFAULT 'SOLICITACAO_RECEBIDA',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AlteracaoContratual_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AlteracaoContratual_processId_alterationType_key"
  ON "AlteracaoContratual"("processId", "alterationType");
CREATE INDEX "AlteracaoContratual_stage_updatedAt_idx"
  ON "AlteracaoContratual"("stage", "updatedAt");
CREATE INDEX "AlteracaoContratual_processId_updatedAt_idx"
  ON "AlteracaoContratual"("processId", "updatedAt");

ALTER TABLE "AlteracaoContratual"
  ADD CONSTRAINT "AlteracaoContratual_processId_fkey"
  FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE CASCADE ON UPDATE CASCADE;
