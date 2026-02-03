import { IsBoolean, IsOptional } from "class-validator";

export class SendLinkDto {
  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  sendWhatsapp?: boolean;
}
