ALTER TABLE "Process"
ADD COLUMN IF NOT EXISTS "companyKey" TEXT;

UPDATE "Process"
SET "companyKey" = lower(
  regexp_replace(
    trim(
      regexp_replace(
        translate(coalesce("clientName", ''), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'),
        '\s+',
        ' ',
        'g'
      )
    ),
    '\s+',
    ' ',
    'g'
  )
)
WHERE coalesce(trim("clientName"), '') <> ''
  AND ("companyKey" IS NULL OR trim("companyKey") = '');

DROP INDEX IF EXISTS "Process_active_email_unique";
DROP INDEX IF EXISTS "process_active_client_company_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "process_active_company_key_unique"
ON "Process"("companyKey")
WHERE "status" NOT IN ('CONCLUIDO', 'CANCELADO')
  AND "companyKey" IS NOT NULL
  AND trim("companyKey") <> '';
