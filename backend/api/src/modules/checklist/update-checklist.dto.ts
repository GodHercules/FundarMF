import { StepKey } from "@prisma/client";
import { IsEnum, IsObject } from "class-validator";

export class UpdateChecklistDto {
  @IsEnum(StepKey)
  stepKey: StepKey;

  @IsObject()
  items: Record<string, boolean>;
}
