import { IsIn, IsObject } from "class-validator";

export class UpdateChecklistDto {
  @IsIn(["ETAPA_2", "ETAPA_4", "ETAPA_5", "ETAPA_6"])
  stepKey: any;

  @IsObject()
  items: Record<string, boolean>;
}
