import { IsIn, IsOptional, IsString } from "class-validator";

export class ValidateItemDto {
  @IsIn(["APROVADO", "REPROVADO"])
  status: "APROVADO" | "REPROVADO";

  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  socioId?: string;

  @IsOptional()
  fileReasons?: Record<string, string>;
}
