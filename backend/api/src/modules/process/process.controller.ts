import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { ProcessService } from "./process.service";
import { AuthGuard } from "../../common/auth/auth.guard";
import { RolesGuard } from "../../common/auth/roles.guard";
import { Roles } from "../../common/auth/roles.decorator";
import { CreateProcessDto } from "./dto/create-process.dto";
import { SendLinkDto } from "./dto/send-link.dto";
import { UpdateStepDto } from "./dto/update-step.dto";
import { SubmitStepDto } from "./dto/submit-step.dto";
import { ApproveStepDto } from "./dto/approve-step.dto";
import { RequestCorrectionDto } from "./dto/request-correction.dto";
import { CancelDto } from "./dto/cancel.dto";

@Controller("processes")
@UseGuards(AuthGuard, RolesGuard)
export class ProcessController {
  constructor(private readonly processService: ProcessService) {}

  @Post()
  @Roles("OPERADOR", "MASTER")
  async create(@Body() dto: CreateProcessDto, @Req() req: Request) {
    return this.processService.createProcessByOperator(req.actor!, {
      nome: dto.nome,
      email: dto.email,
      telefone: dto.telefone,
      sendEmail: dto.sendEmail,
      sendWhatsapp: dto.sendWhatsapp
    });
  }

  @Post(":id/send-link")
  @Roles("OPERADOR", "MASTER")
  async sendLink(@Param("id") id: string, @Body() dto: SendLinkDto, @Req() req: Request) {
    return this.processService.sendClientLink(id, req.actor!, {
      sendEmail: dto.sendEmail,
      sendWhatsapp: dto.sendWhatsapp
    });
  }

  @Get()
  async list(
    @Req() req: Request,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string
  ) {
    return this.processService.listProcesses(req.actor!, {
      take: limit ? Number(limit) : undefined,
      skip: offset ? Number(offset) : undefined
    });
  }

  @Get(":id")
  async get(@Param("id") id: string, @Req() req: Request) {
    return this.processService.getProcess(id, req.actor!);
  }

  @Put(":id/steps")
  async updateStep(@Param("id") id: string, @Body() dto: UpdateStepDto, @Req() req: Request) {
    return this.processService.updateStep(id, req.actor!, dto.stepKey, dto.data);
  }

  @Post(":id/submit-step")
  async submit(@Param("id") id: string, @Body() dto: SubmitStepDto, @Req() req: Request) {
    return this.processService.submitStep(id, req.actor!, dto.stepKey);
  }

  @Post(":id/approve-step")
  async approve(@Param("id") id: string, @Body() dto: ApproveStepDto, @Req() req: Request) {
    return this.processService.approveStep(id, req.actor!, dto.stepKey);
  }

  @Post(":id/request-correction")
  async correction(@Param("id") id: string, @Body() dto: RequestCorrectionDto, @Req() req: Request) {
    return this.processService.requestCorrection(id, req.actor!, dto.stepKey, dto.fields, dto.reason);
  }

  @Post(":id/mark-in-progress")
  async markInProgress(@Param("id") id: string, @Req() req: Request) {
    return this.processService.markInProgress(id, req.actor!);
  }

  @Post(":id/cancel")
  async cancel(@Param("id") id: string, @Body() dto: CancelDto, @Req() req: Request) {
    return this.processService.cancelProcess(id, req.actor!, dto.reason);
  }
}
