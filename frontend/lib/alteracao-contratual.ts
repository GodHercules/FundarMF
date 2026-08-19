const CATALOG = [
  ["nome", "Nome"], ["razao-social", "Razão social"], ["nome-fantasia", "Fantasia"], ["endereco-matriz", "Endereço da matriz"], ["endereco-filial", "Endereço de filial"], ["objeto-social", "Objeto social"], ["inclusao-atividade", "Inclusão de atividade econômica"], ["exclusao-atividade", "Exclusão de atividade econômica"], ["cnae-principal", "CNAE principal"], ["cnaes-secundarios", "CNAEs secundários"], ["entrada-socio", "Entrada de sócio"], ["saida-socio", "Saída de sócio"], ["substituicao-socio", "Substituição de sócio"], ["transferencia-quotas", "Transferência ou cessão de quotas"], ["redistribuicao-participacao", "Redistribuição de participação societária"], ["quadro-societario", "Quadro societário"], ["alteracao-administrador", "Administrador"], ["nomeacao-administrador", "Nomeação de administrador"], ["destituicao-administrador", "Destituição de administrador"], ["poderes-administracao", "Poderes de administração"], ["aumento-capital", "Aumento de capital social"], ["reducao-capital", "Redução de capital social"], ["integralizacao-capital", "Integralização de capital"], ["forma-integralizacao", "Forma de integralização"], ["natureza-juridica", "Natureza jurídica"], ["transformacao", "Transformação empresarial"], ["tipo-societario", "Tipo societário"], ["enquadramento", "Enquadramento"], ["reenquadramento", "Reenquadramento"], ["desenquadramento", "Desenquadramento"], ["porte-empresarial", "Porte empresarial"], ["abertura-filial", "Abertura de filial"], ["alteracao-filial", "Filial"], ["encerramento-filial", "Encerramento de filial"], ["consolidacao-contrato", "Consolidação do contrato social"], ["clausulas-contratuais", "Cláusulas contratuais"], ["prazo-duracao", "Prazo de duração"], ["distribuicao-lucros", "Distribuição de lucros"], ["exercicio-social", "Exercício social"], ["dados-cadastrais", "Dados cadastrais"], ["incorporacao", "Incorporação"], ["fusao", "Fusão"], ["cisao", "Cisão"], ["sucessao", "Sucessão"], ["dissolucao", "Dissolução"], ["baixa", "Encerramento ou baixa"], ["reativacao", "Reativação"], ["outra", "Outra alteração contratual"]
] as const;

export const ALTERACAO_CONTRATUAL_OPTIONS = CATALOG.filter(([id]) => id !== "nomeacao-administrador").map(([id, label]) => ({ id, label, description: `Organize a solicitação de ${label.toLowerCase()}.` })) as ReadonlyArray<{ id: string; label: string; description: string }>;

export type AlteracaoContratualOptionId = (typeof ALTERACAO_CONTRATUAL_OPTIONS)[number]["id"];

export const ALTERACAO_KANBAN_STAGES = [
  "DOC_INICIAL_APROVADA",
  "VIABILIDADE",
  "DBE_RECEITA_FEDERAL",
  "PREPARACAO_DOCUMENTOS",
  "AGUARDANDO_DOCUMENTOS",
  "ANALISE_JUCEB",
  "EXIGENCIA_JUCEB",
  "FINALIZADO"
] as const;

export type AlteracaoKanbanStage = (typeof ALTERACAO_KANBAN_STAGES)[number];

export const ALTERACAO_KANBAN_STAGE_LABELS: Record<AlteracaoKanbanStage, string> = {
  DOC_INICIAL_APROVADA: "Doc. Inicial Aprovada",
  VIABILIDADE: "VIABILIDADE",
  DBE_RECEITA_FEDERAL: "DBE/Receita Federal",
  PREPARACAO_DOCUMENTOS: "Preparação de Documentos",
  AGUARDANDO_DOCUMENTOS: "Aguardando Documentos",
  ANALISE_JUCEB: "Análise JUCEB",
  EXIGENCIA_JUCEB: "Exigência JUCEB",
  FINALIZADO: "Finalizado"
};

export function getAlteracaoContratualOption(optionId: string) {
  return ALTERACAO_CONTRATUAL_OPTIONS.find((option) => option.id === optionId);
}
