import { StepKey } from "@fundarmf/shared";
import { IsIn, IsObject } from "class-validator";

export class UpdateStepDto {
  @IsIn(["ETAPA_1", "ETAPA_2", "ETAPA_3", "ETAPA_4", "ETAPA_5", "ETAPA_6"])
  stepKey: StepKey;

  @IsObject()
  data: Record<string, unknown>;
}
