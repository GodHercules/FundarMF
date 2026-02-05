import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class CreateProcessDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nome?: string;

  @IsString()
  telefone: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  sendWhatsapp?: boolean;
}
