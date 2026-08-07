-- Additive migration for completed processes and editable contracts.
ALTER TYPE "IdempotencyScope" ADD VALUE IF NOT EXISTS 'COMPLETED_PROCESS_FINALIZATION';

CREATE TABLE "LegacyClient" (
  "id" TEXT NOT NULL, "kind" TEXT NOT NULL, "name" TEXT NOT NULL, "tradeName" TEXT,
  "documentNumber" TEXT NOT NULL, "normalizedDocument" TEXT NOT NULL, "address" TEXT,
  "city" TEXT, "state" TEXT, "municipalRegistration" TEXT, "stateRegistration" TEXT,
  "phone" TEXT, "email" TEXT, "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "LegacyClient_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LegacyClient_normalizedDocument_key" ON "LegacyClient"("normalizedDocument");
CREATE INDEX "LegacyClient_name_idx" ON "LegacyClient"("name");
CREATE INDEX "LegacyClient_createdAt_idx" ON "LegacyClient"("createdAt");

CREATE TABLE "ProcessFinalization" (
  "id" TEXT NOT NULL, "processId" TEXT NOT NULL, "finalizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finalizedById" TEXT, "previousStatus" "ProcessStatus", "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcessFinalization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProcessFinalization_processId_key" ON "ProcessFinalization"("processId");
CREATE INDEX "ProcessFinalization_finalizedAt_idx" ON "ProcessFinalization"("finalizedAt");
ALTER TABLE "ProcessFinalization" ADD CONSTRAINT "ProcessFinalization_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Process" ADD COLUMN "legacyClientId" TEXT;
CREATE INDEX "Process_legacyClientId_idx" ON "Process"("legacyClientId");
ALTER TABLE "Process" ADD CONSTRAINT "Process_legacyClientId_fkey" FOREIGN KEY ("legacyClientId") REFERENCES "LegacyClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Contract" (
  "id" TEXT NOT NULL, "processId" TEXT, "legacyClientId" TEXT, "title" TEXT NOT NULL, "type" TEXT,
  "description" TEXT, "status" TEXT NOT NULL DEFAULT 'RASCUNHO', "origin" TEXT NOT NULL,
  "editorSchemaVersion" TEXT NOT NULL DEFAULT '1', "currentVersion" INTEGER NOT NULL DEFAULT 1,
  "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Contract_processId_updatedAt_idx" ON "Contract"("processId", "updatedAt");
CREATE INDEX "Contract_legacyClientId_updatedAt_idx" ON "Contract"("legacyClientId", "updatedAt");
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_legacyClientId_fkey" FOREIGN KEY ("legacyClientId") REFERENCES "LegacyClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ContractVersion" (
  "id" TEXT NOT NULL, "contractId" TEXT NOT NULL, "version" INTEGER NOT NULL, "status" TEXT NOT NULL,
  "content" JSONB NOT NULL, "source" TEXT NOT NULL, "sha256" TEXT NOT NULL, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ContractVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ContractVersion_contractId_version_key" ON "ContractVersion"("contractId", "version");
CREATE INDEX "ContractVersion_contractId_createdAt_idx" ON "ContractVersion"("contractId", "createdAt");
ALTER TABLE "ContractVersion" ADD CONSTRAINT "ContractVersion_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ContractFile" (
  "id" TEXT NOT NULL, "contractId" TEXT NOT NULL, "kind" TEXT NOT NULL, "fileName" TEXT NOT NULL, "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL, "sha256" TEXT NOT NULL, "data" BYTEA NOT NULL, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ContractFile_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ContractFile_contractId_kind_createdAt_idx" ON "ContractFile"("contractId", "kind", "createdAt");
ALTER TABLE "ContractFile" ADD CONSTRAINT "ContractFile_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ContractExport" (
  "id" TEXT NOT NULL, "contractId" TEXT NOT NULL, "version" INTEGER NOT NULL, "format" TEXT NOT NULL, "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL, "sizeBytes" INTEGER NOT NULL, "sha256" TEXT NOT NULL, "data" BYTEA NOT NULL, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ContractExport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ContractExport_contractId_version_format_key" ON "ContractExport"("contractId", "version", "format");
CREATE INDEX "ContractExport_contractId_createdAt_idx" ON "ContractExport"("contractId", "createdAt");
ALTER TABLE "ContractExport" ADD CONSTRAINT "ContractExport_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
