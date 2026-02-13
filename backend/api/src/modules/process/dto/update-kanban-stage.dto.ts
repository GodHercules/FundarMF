import { IsIn } from "class-validator";
import { KanbanStage } from "@fundarmf/shared";

export class UpdateKanbanStageDto {
  @IsIn([
    "VIABILIDADE",
    "DOC_INICIAL_APROVADA",
    "DBE_RECEITA_FEDERAL",
    "PREPARACAO_DOCUMENTOS",
    "AGUARDANDO_DOCUMENTOS",
    "ANALISE_JUCEB",
    "FINALIZADO"
  ])
  kanbanStage: KanbanStage;
}

