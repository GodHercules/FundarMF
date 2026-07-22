import { AlteracaoContratualStage } from "@prisma/client";
import { IsEnum, IsInt, Min } from "class-validator";

export class UpdateAlteracaoContratualStageDto {
  @IsEnum(AlteracaoContratualStage)
  stage!: AlteracaoContratualStage;

  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
