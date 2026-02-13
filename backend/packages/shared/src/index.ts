export type Role = "CLIENT" | "OPERATOR" | "MASTER";

export type ProcessStatus =
  | "EM_ANDAMENTO"
  | "AGUARDANDO_CLIENTE"
  | "AGUARDANDO_OPERADOR"
  | "CORRECAO_SOLICITADA"
  | "CONCLUIDO"
  | "CANCELADO";

export type StepKey = "ETAPA_1" | "ETAPA_2" | "ETAPA_3" | "ETAPA_4" | "ETAPA_5" | "ETAPA_6";
export type KanbanStage =
  | "VIABILIDADE"
  | "DOC_INICIAL_APROVADA"
  | "DBE_RECEITA_FEDERAL"
  | "PREPARACAO_DOCUMENTOS"
  | "AGUARDANDO_DOCUMENTOS"
  | "ANALISE_JUCEB"
  | "FINALIZADO";

export type StepSide = "CLIENTE" | "OPERADOR";

export type DocumentItemKey =
  | "IDENTIFICACAO_SOCIOS"
  | "COMPROVANTE_RESIDENCIA"
  | "FOTO_FACHADA";

export type ChecklistStatus = "PENDENTE" | "COMPLETO";

export type DocumentItemStatus = "PENDENTE" | "AGUARDANDO_VALIDACAO" | "APROVADO" | "REPROVADO";

export type MessageAuthor = "CLIENTE" | "OPERADOR" | "BOT";

export const STEP_ORDER: StepKey[] = [
  "ETAPA_1",
  "ETAPA_2",
  "ETAPA_3",
  "ETAPA_4",
  "ETAPA_5",
  "ETAPA_6"
];

export const KANBAN_STAGE_ORDER: KanbanStage[] = [
  "DOC_INICIAL_APROVADA",
  "VIABILIDADE",
  "DBE_RECEITA_FEDERAL",
  "PREPARACAO_DOCUMENTOS",
  "AGUARDANDO_DOCUMENTOS",
  "ANALISE_JUCEB",
  "FINALIZADO"
];

export const NOTIFY_EMAIL_JOB = "notify:email";
export const NOTIFY_WHATSAPP_JOB = "notify:whatsapp";
