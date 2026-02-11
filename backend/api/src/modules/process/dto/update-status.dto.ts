import { IsString, MaxLength, MinLength } from "class-validator";

export class UpdateStatusDto {
  @IsString()
  @MinLength(1)
  @MaxLength(600)
  message: string;
}
