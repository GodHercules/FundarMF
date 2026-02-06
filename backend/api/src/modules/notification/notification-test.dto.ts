import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class TestEmailDto {
  @IsEmail()
  to!: string;

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;
}

export class TestWhatsAppDto {
  @IsString()
  @IsNotEmpty()
  to!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsOptional()
  @IsString()
  label?: string;
}
