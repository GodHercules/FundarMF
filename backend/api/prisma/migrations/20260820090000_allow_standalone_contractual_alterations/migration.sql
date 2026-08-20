ALTER TABLE "AlteracaoContratual" ALTER COLUMN "processId" DROP NOT NULL;

ALTER TABLE "AlteracaoContratual" ADD COLUMN IF NOT EXISTS "legacyClientId" TEXT;

CREATE INDEX IF NOT EXISTS "AlteracaoContratual_legacyClientId_alterationType_updatedAt_idx"
  ON "AlteracaoContratual"("legacyClientId", "alterationType", "updatedAt");

DO $$
BEGIN
  ALTER TABLE "AlteracaoContratual"
    ADD CONSTRAINT "AlteracaoContratual_legacyClientId_fkey"
    FOREIGN KEY ("legacyClientId") REFERENCES "LegacyClient"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
