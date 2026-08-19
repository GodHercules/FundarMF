import { IsArray, IsIn, IsOptional, IsString, Length, ArrayNotEmpty, ArrayUnique } from "class-validator";
import { ALTERACAO_CONTRATUAL_CATALOG } from "@fundarmf/shared";

export const ALTERACAO_CONTRATUAL_TYPES = ALTERACAO_CONTRATUAL_CATALOG.map(([id]) => id);

export class CreateAlteracaoContratualDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  processId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  @IsIn(ALTERACAO_CONTRATUAL_TYPES)
  alterationType?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  @IsIn(ALTERACAO_CONTRATUAL_TYPES, { each: true })
  alterationTypes?: string[];

  @IsOptional()
  @IsString()
  @Length(1, 500)
  otherDescription?: string;
}
