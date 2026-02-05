import { IsIn } from "class-validator";
import { StepKey } from "@fundarmf/shared";

export class ApproveStepDto {
  @IsIn(["ETAPA_2", "ETAPA_3", "ETAPA_4", "ETAPA_5", "ETAPA_6"])
  stepKey: StepKey;
}
