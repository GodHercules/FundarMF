UPDATE "AlteracaoContratual" AS alteration
SET "stage" = 'VIABILIDADE'
WHERE alteration."stage" = 'DOC_INICIAL_APROVADA'
  AND NOT EXISTS (
    SELECT 1
    FROM "AlteracaoContratualHistory" AS history
    WHERE history."alteracaoId" = alteration."id"
      AND history."fromStage" IS NOT NULL
  );
