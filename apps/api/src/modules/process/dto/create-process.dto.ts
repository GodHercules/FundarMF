import { IsEmail, IsString, MinLength } from "class-validator";

export class CreateProcessDto {
  @IsString()
  @MinLength(2)
  nome: string;

  @IsString()
  telefone: string;

  @IsEmail()
  email: string;
}
