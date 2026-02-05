import { IsOptional, IsString, MinLength } from "class-validator";

export class DeleteProcessDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  reason?: string;
}
