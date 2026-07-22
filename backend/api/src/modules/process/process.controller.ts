import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";

import { AuthGuard } from "../../common/auth/auth.guard";
import { Roles } from "../../common/auth/roles.decorator";
import { RolesGuard } from "../../common/auth/roles.guard";
import { ApproveStepDto } from "./dto/approve-step.dto";
import { CancelDto } from "./dto/cancel.dto";
import { CreateAlteracaoContratualDto } from "./dto/create-alteracao-contratual.dto";
import { CreateProcessDto } from "./dto/create-process.dto";
import { RequestCorrectionDto } from "./dto/request-correction.dto";
import { SendLinkDto } from "./dto/send-link.dto";
import { SubmitStepDto } from "./dto/submit-step.dto";
import { UpdateAlteracaoContratualStageDto } from "./dto/update-alteracao-contratual-stage.dto";
import { UpdateKanbanStageDto } from "./dto/update-kanban-stage.dto";
import { UpdateStatusDto } from "./dto/update-status.dto";
import { UpdateStepDto } from "./dto/update-step.dto";
import { ProcessService } from "./process.service";

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
    }, req.header("idempotency-key") ?? undefined);
  }

  @Post(":id/send-link")
  @Roles("OPERADOR", "MASTER")
  async sendLink(@Param("id") id: string, @Body() dto: SendLinkDto, @Req() req: Request) {
    return this.processService.sendClientLink(id, req.actor!, {
      sendEmail: dto.sendEmail,
      sendWhatsapp: dto.sendWhatsapp
    });
  }

  @Post(":id/send-otp")
  @Roles("OPERADOR", "MASTER")
  async sendOtp(@Param("id") id: string, @Req() req: Request) {
    return this.processService.sendClientOtp(id, req.actor!);
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

  @Get("kanban")
  @Roles("OPERADOR", "MASTER")
  async listKanban(
    @Req() req: Request,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string
  ) {
    return this.processService.listKanbanProcesses(req.actor!, {
      take: limit ? Number(limit) : undefined,
      skip: offset ? Number(offset) : undefined
    });
  }

  @Get("alteracoes-contratuais")
  @Roles("OPERADOR", "MASTER")
  async listAllAlteracoes(@Req() req: Request) {
    return this.processService.listAllAlteracaoContratual(req.actor!);
  }

  @Get(":id")
  async get(@Param("id") id: string, @Req() req: Request) {
    return this.processService.getProcess(id, req.actor!);
  }

  @Post(":id/alteracoes-contratuais")
  async createAlteracao(@Param("id") id: string, @Body() dto: CreateAlteracaoContratualDto, @Req() req: Request) {
    return this.processService.createAlteracaoContratual(id, req.actor!, dto.alterationType);
  }

  @Get(":id/alteracoes-contratuais")
  async listAlteracoes(@Param("id") id: string, @Req() req: Request) {
    return this.processService.listAlteracaoContratual(id, req.actor!);
  }

  @Patch("alteracoes-contratuais/:alteracaoId/stage")
  @Roles("OPERADOR", "MASTER")
  async updateAlteracaoStage(
    @Param("alteracaoId") alteracaoId: string,
    @Body() dto: UpdateAlteracaoContratualStageDto,
    @Req() req: Request
  ) {
    return this.processService.updateAlteracaoContratualStage(alteracaoId, req.actor!, dto.stage, dto.expectedVersion);
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

  @Post(":id/status-update")
  @Roles("OPERADOR", "MASTER")
  async updateClientStatus(@Param("id") id: string, @Body() dto: UpdateStatusDto, @Req() req: Request) {
    return this.processService.updateClientStatus(id, req.actor!, dto.message);
  }

  @Patch(":id/kanban-stage")
  @Roles("OPERADOR", "MASTER")
  async updateKanbanStage(@Param("id") id: string, @Body() dto: UpdateKanbanStageDto, @Req() req: Request) {
    return this.processService.updateKanbanStage(id, req.actor!, dto.kanbanStage);
  }

  @Post(":id/cancel")
  @Roles("OPERADOR", "MASTER")
  async cancel(@Param("id") id: string, @Body() dto: CancelDto, @Req() req: Request) {
    return this.processService.cancelProcess(id, req.actor!, dto.reason);
  }
}
