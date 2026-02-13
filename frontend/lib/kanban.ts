export const KANBAN_STAGES = [
  "DOC_INICIAL_APROVADA",
  "VIABILIDADE",
  "DBE_RECEITA_FEDERAL",
  "PREPARACAO_DOCUMENTOS",
  "AGUARDANDO_DOCUMENTOS",
  "ANALISE_JUCEB",
  "FINALIZADO"
] as const;

export type KanbanStage = (typeof KANBAN_STAGES)[number];

export const KANBAN_STAGE_LABELS: Record<KanbanStage, string> = {
  VIABILIDADE: "VIABILIDADE",
  DOC_INICIAL_APROVADA: "Doc. Inicial Aprovada",
  DBE_RECEITA_FEDERAL: "DBE/Receita Federal",
  PREPARACAO_DOCUMENTOS: "Preparacao Documentos",
  AGUARDANDO_DOCUMENTOS: "Aguardando Documentos",
  ANALISE_JUCEB: "Analise JUCEB",
  FINALIZADO: "Finalizado"
};
