CREATE UNIQUE INDEX IF NOT EXISTS "process_active_client_company_unique"
ON "Process" (
  lower(trim("clientEmail")),
  lower(regexp_replace(trim(coalesce("clientName", '')), '\s+', ' ', 'g'))
)
WHERE "status" NOT IN ('CONCLUIDO', 'CANCELADO');
