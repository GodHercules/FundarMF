import { IsString, MinLength } from "class-validator";

export class CancelDto {
  @IsString()
  @MinLength(3)
  reason: string;
}
