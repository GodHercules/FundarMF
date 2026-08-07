ALTER TABLE "User" ADD COLUMN "tenantKey" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "Process" ADD COLUMN "tenantKey" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "LegacyClient" ADD COLUMN "tenantKey" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "Contract" ADD COLUMN "tenantKey" TEXT NOT NULL DEFAULT 'default';

DROP INDEX IF EXISTS "LegacyClient_normalizedDocument_key";
CREATE UNIQUE INDEX "LegacyClient_tenantKey_normalizedDocument_key" ON "LegacyClient"("tenantKey", "normalizedDocument");
CREATE INDEX "Process_tenantKey_status_finalizedAt_idx" ON "Process"("tenantKey", "status", "finalizedAt");
CREATE INDEX "Contract_tenantKey_updatedAt_idx" ON "Contract"("tenantKey", "updatedAt");
