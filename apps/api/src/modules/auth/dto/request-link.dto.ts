import { IsEmail, IsOptional, IsString, Matches, ValidateIf } from "class-validator";

export class RequestLinkDto {
  @ValidateIf((value) => value.email !== undefined)
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/)
  whatsapp?: string;
}
