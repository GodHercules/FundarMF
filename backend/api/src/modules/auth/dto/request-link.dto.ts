import { IsEmail, IsOptional, IsString, Matches, MinLength, ValidateIf } from "class-validator";

export class RequestLinkDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nome?: string;

  @ValidateIf((value) => value.email !== undefined)
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/)
  whatsapp?: string;
}
