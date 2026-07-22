import { StepKey } from "@fundarmf/shared";
import { ArrayNotEmpty, IsIn, IsString } from "class-validator";

export class RequestCorrectionDto {
  @IsIn(["ETAPA_2", "ETAPA_4", "ETAPA_5", "ETAPA_6"])
  stepKey: StepKey;

  @ArrayNotEmpty()
  fields: string[];

  @IsString()
  reason: string;
}
