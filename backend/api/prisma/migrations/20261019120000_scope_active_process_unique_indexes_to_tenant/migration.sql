-- Scope active-process uniqueness to a tenant.
-- This migration is intentionally not applied automatically to any remote database.
DROP INDEX IF EXISTS "process_active_client_company_unique";
DROP INDEX IF EXISTS "process_active_company_key_unique";
DROP INDEX IF EXISTS "Process_active_email_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "process_active_tenant_client_company_unique"
ON "Process"(
  "tenantKey",
  lower(trim("clientEmail")),
  lower(regexp_replace(trim(coalesce("clientName", '')), '\s+', ' ', 'g'))
)
WHERE "status" NOT IN ('CONCLUIDO', 'CANCELADO');

CREATE UNIQUE INDEX IF NOT EXISTS "process_active_tenant_company_key_unique"
ON "Process"("tenantKey", "companyKey")
WHERE "status" NOT IN ('CONCLUIDO', 'CANCELADO')
AND "companyKey" IS NOT NULL
AND trim("companyKey") <> '';
