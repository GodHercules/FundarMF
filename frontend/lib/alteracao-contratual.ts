export const ALTERACAO_CONTRATUAL_OPTIONS = [
  {
    id: "orgaos-registro-conversao",
    label: "Alteração entre órgãos de registro/Conversão",
    description: "Use quando a mudança envolve migração entre órgãos de registro ou conversão societária."
  },
  {
    id: "natureza-juridica-transformacao",
    label: "Natureza Jurídica - Transformação",
    description: "Indicado para transformar a natureza jurídica da empresa sem trocar a identidade do negócio."
  },
  {
    id: "nome",
    label: "Nome",
    description: "Altere a razão social, nome fantasia ou a identificação principal da empresa."
  },
  {
    id: "atividade-economica",
    label: "Atividade Econômica",
    description: "Atualize CNAE, objeto social ou escopo operacional da empresa."
  },
  {
    id: "tipo-de-unidade",
    label: "Alteração do Tipo de Unidade",
    description: "Ajuste a classificação da unidade, filial, matriz ou ponto de operação."
  },
  {
    id: "forma-de-atuacao",
    label: "Alteração da Forma de Atuação",
    description: "Mude como a empresa atua, inclusive presencial, virtual ou híbrida."
  },
  {
    id: "endereco",
    label: "Endereço",
    description: "Solicite atualização de endereço, sede, complemento ou estrutura do imóvel."
  }
] as const;

export type AlteracaoContratualOptionId = (typeof ALTERACAO_CONTRATUAL_OPTIONS)[number]["id"];

export const ALTERACAO_KANBAN_STAGES = [
  "SOLICITACAO_RECEBIDA",
  "ANALISE_JURIDICA",
  "AJUSTES_DOCUMENTAIS",
  "PROTOCOLO",
  "FINALIZADO"
] as const;

export type AlteracaoKanbanStage = (typeof ALTERACAO_KANBAN_STAGES)[number];

export const ALTERACAO_KANBAN_STAGE_LABELS: Record<AlteracaoKanbanStage, string> = {
  SOLICITACAO_RECEBIDA: "Solicitação recebida",
  ANALISE_JURIDICA: "Análise jurídica",
  AJUSTES_DOCUMENTAIS: "Ajustes documentais",
  PROTOCOLO: "Protocolo",
  FINALIZADO: "Finalizado"
};

export function getAlteracaoContratualOption(optionId: string) {
  return ALTERACAO_CONTRATUAL_OPTIONS.find((option) => option.id === optionId);
}
