import { IsIn, IsString, Length } from "class-validator";

export const ALTERACAO_CONTRATUAL_TYPES = [
  "orgaos-registro-conversao",
  "natureza-juridica-transformacao",
  "nome",
  "atividade-economica",
  "tipo-de-unidade",
  "forma-de-atuacao",
  "endereco"
] as const;

export class CreateAlteracaoContratualDto {
  @IsString()
  @Length(1, 80)
  @IsIn(ALTERACAO_CONTRATUAL_TYPES)
  alterationType!: string;
}
