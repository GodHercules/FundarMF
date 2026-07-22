import { KanbanStage } from "@fundarmf/shared";
import { IsIn } from "class-validator";

export class UpdateKanbanStageDto {
  @IsIn([
    "VIABILIDADE",
    "DOC_INICIAL_APROVADA",
    "DBE_RECEITA_FEDERAL",
    "PREPARACAO_DOCUMENTOS",
    "AGUARDANDO_DOCUMENTOS",
    "ANALISE_JUCEB",
    "EXIGENCIA_JUCEB",
    "FINALIZADO"
  ])
  kanbanStage: KanbanStage;
}

