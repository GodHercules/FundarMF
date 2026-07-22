ALTER TABLE "AlteracaoContratual"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "requestedByRole" "AuditActorRole" NOT NULL DEFAULT 'CLIENTE',
  ADD COLUMN "requestedById" TEXT;

CREATE TABLE "AlteracaoContratualHistory" (
  "id" TEXT NOT NULL,
  "alteracaoId" TEXT NOT NULL,
  "fromStage" "AlteracaoContratualStage",
  "toStage" "AlteracaoContratualStage" NOT NULL,
  "version" INTEGER NOT NULL,
  "actorRole" "AuditActorRole" NOT NULL,
  "actorId" TEXT,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AlteracaoContratualHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AlteracaoContratualHistory_alteracaoId_createdAt_idx"
  ON "AlteracaoContratualHistory"("alteracaoId", "createdAt");
CREATE UNIQUE INDEX "AlteracaoContratualHistory_alteracaoId_version_key"
  ON "AlteracaoContratualHistory"("alteracaoId", "version");

ALTER TABLE "AlteracaoContratualHistory"
  ADD CONSTRAINT "AlteracaoContratualHistory_alteracaoId_fkey"
  FOREIGN KEY ("alteracaoId") REFERENCES "AlteracaoContratual"("id") ON DELETE CASCADE ON UPDATE CASCADE;
