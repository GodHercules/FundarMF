import { IsIn } from "class-validator";
import { StepKey } from "@fundarmf/shared";

export class SubmitStepDto {
  @IsIn(["ETAPA_2", "ETAPA_4", "ETAPA_5", "ETAPA_6"])
  stepKey: StepKey;
}
