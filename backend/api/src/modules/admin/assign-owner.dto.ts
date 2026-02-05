import { IsString } from "class-validator";

export class AssignOwnerDto {
  @IsString()
  ownerId: string;
}
