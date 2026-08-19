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
  | "EXIGENCIA_JUCEB"
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
  "EXIGENCIA_JUCEB",
  "FINALIZADO"
];

/** Canonical stages shared by the opening and contractual-alteration boards. */
export const ALTERACAO_KANBAN_STAGE_ORDER: KanbanStage[] = [...KANBAN_STAGE_ORDER];

export const ALTERACAO_CONTRATUAL_CATALOG = [
  ["nome", "Nome"],
  ["razao-social", "Alteração de razão social"],
  ["nome-fantasia", "Alteração de nome fantasia"],
  ["endereco-matriz", "Alteração de endereço da matriz"],
  ["endereco-filial", "Alteração de endereço de filial"],
  ["objeto-social", "Alteração de objeto social"],
  ["inclusao-atividade", "Inclusão de atividade econômica"],
  ["exclusao-atividade", "Exclusão de atividade econômica"],
  ["cnae-principal", "Alteração de CNAE principal"],
  ["cnaes-secundarios", "Alteração de CNAEs secundários"],
  ["entrada-socio", "Entrada de sócio"],
  ["saida-socio", "Saída de sócio"],
  ["substituicao-socio", "Substituição de sócio"],
  ["transferencia-quotas", "Transferência ou cessão de quotas"],
  ["redistribuicao-participacao", "Redistribuição de participação societária"],
  ["quadro-societario", "Alteração do quadro societário"],
  ["alteracao-administrador", "Alteração de administrador"],
  ["nomeacao-administrador", "Nomeação de administrador"],
  ["destituicao-administrador", "Destituição de administrador"],
  ["poderes-administracao", "Alteração de poderes de administração"],
  ["aumento-capital", "Aumento de capital social"],
  ["reducao-capital", "Redução de capital social"],
  ["integralizacao-capital", "Integralização de capital"],
  ["forma-integralizacao", "Alteração da forma de integralização"],
  ["natureza-juridica", "Alteração de natureza jurídica"],
  ["transformacao", "Transformação empresarial"],
  ["tipo-societario", "Alteração de tipo societário"],
  ["enquadramento", "Enquadramento"],
  ["reenquadramento", "Reenquadramento"],
  ["desenquadramento", "Desenquadramento"],
  ["porte-empresarial", "Alteração de porte empresarial"],
  ["abertura-filial", "Abertura de filial"],
  ["alteracao-filial", "Alteração de filial"],
  ["encerramento-filial", "Encerramento de filial"],
  ["consolidacao-contrato", "Consolidação do contrato social"],
  ["clausulas-contratuais", "Inclusão, remoção ou alteração de cláusulas contratuais"],
  ["prazo-duracao", "Alteração de prazo de duração"],
  ["distribuicao-lucros", "Alteração de regras de distribuição de lucros"],
  ["exercicio-social", "Alteração de exercício social"],
  ["dados-cadastrais", "Alteração de dados cadastrais"],
  ["incorporacao", "Incorporação"],
  ["fusao", "Fusão"],
  ["cisao", "Cisão"],
  ["sucessao", "Sucessão"],
  ["dissolucao", "Dissolução"],
  ["baixa", "Encerramento ou baixa"],
  ["reativacao", "Reativação"],
  ["outra", "Outra alteração contratual"]
] as const;

export const NOTIFY_EMAIL_JOB = "notify:email";
export const NOTIFY_WHATSAPP_JOB = "notify:whatsapp";
