import { Body, Controller, Get, Param, Put, Req, UseGuards } from "@nestjs/common";
import { StepKey } from "@prisma/client";
import { Request } from "express";
import { AuthGuard } from "../../common/auth/auth.guard";
import { RolesGuard } from "../../common/auth/roles.guard";
import { ChecklistService } from "./checklist.service";
import { UpdateChecklistDto } from "./update-checklist.dto";

@Controller("checklists")
@UseGuards(AuthGuard, RolesGuard)
export class ChecklistController {
  constructor(private readonly checklistService: ChecklistService) {}

  @Get(":processId/step/:stepKey")
  async get(@Param("processId") processId: string, @Param("stepKey") stepKey: StepKey, @Req() req: Request) {
    return this.checklistService.getChecklist(processId, stepKey, req.actor!);
  }

  @Put(":processId/step/:stepKey")
  async update(
    @Param("processId") processId: string,
    @Param("stepKey") stepKey: StepKey,
    @Body() dto: UpdateChecklistDto,
    @Req() req: Request
  ) {
    return this.checklistService.updateChecklist(processId, stepKey, dto.items, req.actor!);
  }
}
