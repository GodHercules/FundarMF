import { IsOptional, IsString, Length } from "class-validator";

export class VerifyLinkDto {
  @IsString()
  token: string;

  @IsOptional()
  @Length(4, 8)
  otp?: string;
}
