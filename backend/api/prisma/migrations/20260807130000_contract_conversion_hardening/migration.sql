ALTER TABLE "Process" ADD COLUMN "finalizedAt" TIMESTAMP(3);
CREATE INDEX "Process_status_finalizedAt_idx" ON "Process"("status", "finalizedAt");

ALTER TABLE "Contract" ADD COLUMN "conversionStatus" TEXT NOT NULL DEFAULT 'CONCLUIDO';
ALTER TABLE "Contract" ADD COLUMN "conversionMessage" TEXT;
ALTER TABLE "Contract" ADD COLUMN "conversionMetadata" JSONB;
ALTER TABLE "Contract" ADD COLUMN "usedOcr" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ContractConversion" (
  "id" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'CONCLUIDO',
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "progress" INTEGER NOT NULL DEFAULT 100,
  "usedOcr" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContractConversion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ContractConversion_contractId_createdAt_idx" ON "ContractConversion"("contractId", "createdAt");
CREATE INDEX "ContractConversion_status_createdAt_idx" ON "ContractConversion"("status", "createdAt");
ALTER TABLE "ContractConversion" ADD CONSTRAINT "ContractConversion_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "Process" SET "finalizedAt" = "updatedAt" WHERE "status" = 'CONCLUIDO' AND "finalizedAt" IS NULL;
INSERT INTO "ProcessFinalization" ("id", "processId", "finalizedAt", "previousStatus", "createdAt")
SELECT md5(p."id" || ':finalization'), p."id", COALESCE(p."finalizedAt", p."updatedAt"), 'CONCLUIDO'::"ProcessStatus", CURRENT_TIMESTAMP
FROM "Process" p WHERE p."status" = 'CONCLUIDO'
  AND NOT EXISTS (SELECT 1 FROM "ProcessFinalization" f WHERE f."processId" = p."id");
