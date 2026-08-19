ALTER TABLE "AlteracaoContratual" ADD COLUMN IF NOT EXISTS "tenantKey" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "AlteracaoContratual" ADD COLUMN IF NOT EXISTS "dueAt" TIMESTAMP(3);
ALTER TABLE "AlteracaoContratual" ADD COLUMN IF NOT EXISTS "slaStatus" TEXT NOT NULL DEFAULT 'ON_TRACK';
ALTER TABLE "AlteracaoContratualHistory" ADD COLUMN IF NOT EXISTS "tenantKey" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "alteracaoId" TEXT;
UPDATE "AlteracaoContratual" a SET "tenantKey" = p."tenantKey" FROM "Process" p WHERE p."id" = a."processId";
UPDATE "AlteracaoContratualHistory" h SET "tenantKey" = a."tenantKey" FROM "AlteracaoContratual" a WHERE a."id" = h."alteracaoId";
CREATE INDEX IF NOT EXISTS "AlteracaoContratual_tenantKey_stage_updatedAt_idx" ON "AlteracaoContratual"("tenantKey", "stage", "updatedAt");
CREATE INDEX IF NOT EXISTS "Contract_alteracaoId_updatedAt_idx" ON "Contract"("alteracaoId", "updatedAt");
DO $$ BEGIN
  ALTER TABLE "Contract" ADD CONSTRAINT "Contract_alteracaoId_fkey" FOREIGN KEY ("alteracaoId") REFERENCES "AlteracaoContratual"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
