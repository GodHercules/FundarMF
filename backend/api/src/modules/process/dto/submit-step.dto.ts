import { StepKey } from "@fundarmf/shared";
import { IsIn } from "class-validator";

export class SubmitStepDto {
  @IsIn(["ETAPA_2", "ETAPA_4", "ETAPA_5", "ETAPA_6"])
  stepKey: StepKey;
}
