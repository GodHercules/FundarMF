import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { IsIn, IsInt, Max, Min } from "class-validator";
import { Roles } from "../../common/auth/roles.decorator";
import { RolesGuard } from "../../common/auth/roles.guard";
import { SlaService } from "./sla.service";
import { AuthGuard } from "../../common/auth/auth.guard";

class UpdateSlaDto {
  @IsIn(["ETAPA_1", "ETAPA_2", "ETAPA_3", "ETAPA_4", "ETAPA_5", "ETAPA_6"])
  stepKey: any;

  @IsIn(["CLIENTE", "FUNCIONARIO"])
  side: any;

  @IsInt()
  @Min(1)
  durationHours: number;

  @IsInt()
  @Min(1)
  @Max(100)
  alertPercent: number;
}

@Controller("sla")
@UseGuards(AuthGuard, RolesGuard)
export class SlaController {
  constructor(private readonly slaService: SlaService) {}

  @Get("config")
  @Roles("MASTER")
  async listConfig() {
    return this.slaService.listConfig();
  }

  @Put("config")
  @Roles("MASTER")
  async update(@Body() dto: UpdateSlaDto) {
    return this.slaService.updateConfig(dto.stepKey, dto.side, dto.durationHours, dto.alertPercent);
  }
}
