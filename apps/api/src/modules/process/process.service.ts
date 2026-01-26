import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ProcessStatus, StepKey, StepSide } from "@prisma/client";
import { PrismaService } from "../../shared/prisma.service";
import { Actor } from "../../common/auth/types";
import { isClientOwner, normalizePhone } from "../../common/auth/identity";
import { SlaService } from "../sla/sla.service";
import { AuditService } from "../audit/audit.service";
import { NotificationService } from "../notification/notification.service";

const CLIENT_STEPS: StepKey[] = ["ETAPA_1", "ETAPA_2", "ETAPA_4", "ETAPA_5", "ETAPA_6"];
const EMPLOYEE_STEPS: StepKey[] = ["ETAPA_3"];

function nextStep(step: StepKey): StepKey | null {
  const order: StepKey[] = ["ETAPA_1", "ETAPA_2", "ETAPA_3", "ETAPA_4", "ETAPA_5", "ETAPA_6"];
  const index = order.indexOf(step);
  if (index === -1 || index === order.length - 1) return null;
  return order[index + 1];
}

function stepSide(step: StepKey): StepSide {
  return step === "ETAPA_3" ? "FUNCIONARIO" : "CLIENTE";
}

@Injectable()
export class ProcessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly slaService: SlaService,
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService
  ) {}

  async createProcessFromClient(payload: { nome: string; email: string; telefone: string }) {
    const normalizedPhone = normalizePhone(payload.telefone) ?? payload.telefone;
    const active = await this.prisma.process.findFirst({
      where: {
        clientEmail: payload.email,
        status: { notIn: [ProcessStatus.CONCLUIDO, ProcessStatus.CANCELADO] }
      }
    });
    if (active) {
      throw new BadRequestException("Já existe um processo ativo para este e-mail.");
    }

    const process = await this.prisma.process.create({
      data: {
        clientName: payload.nome,
        clientEmail: payload.email,
        clientPhone: normalizedPhone,
        status: ProcessStatus.AGUARDANDO_CLIENTE,
        currentStep: StepKey.ETAPA_2,
        steps: {
          create: {
            stepKey: StepKey.ETAPA_1,
            side: StepSide.CLIENTE,
            status: ProcessStatus.CONCLUIDO,
            data: {
              nome: payload.nome,
              email: payload.email,
              telefone: normalizedPhone
            }
          }
        },
        documents: {
          create: [
            { itemKey: "IDENTIFICACAO_SOCIOS" },
            { itemKey: "COMPROVANTE_RESIDENCIA" },
            { itemKey: "FOTO_FACHADA" }
          ]
        },
        checklists: {
          create: [
            {
              stepKey: StepKey.ETAPA_2,
              status: "PENDENTE",
              items: {
                razoesSociais: false,
                municipio: false,
                contatoCnpj: false,
                tributacao: false,
                cnae: false
              }
            },
            {
              stepKey: StepKey.ETAPA_4,
              status: "PENDENTE",
              items: {
                dadosCompletos: false,
                percentuaisOk: false,
                administradores: false,
                responsavelCnpj: false
              }
            },
            {
              stepKey: StepKey.ETAPA_5,
              status: "PENDENTE",
              items: {
                enderecoOk: false,
                iptuOk: false,
                fotoOk: false,
                escritorioVirtual: false
              }
            },
            {
              stepKey: StepKey.ETAPA_6,
              status: "PENDENTE",
              items: {
                identificacaoSocios: false,
                comprovanteResidencia: false,
                fotoFachada: false
              }
            }
          ]
        }
      }
    });

    await this.slaService.startSla(process.id, StepKey.ETAPA_2, StepSide.CLIENTE);

    return process;
  }

  async listProcesses(actor: Actor) {
    if (actor.role === "CLIENTE") {
      if (actor.email) {
        return this.prisma.process.findMany({
          where: { clientEmail: actor.email },
          orderBy: { createdAt: "desc" }
        });
      }
      if (actor.whatsapp) {
        return this.prisma.process.findMany({
          where: { clientPhone: normalizePhone(actor.whatsapp) ?? actor.whatsapp },
          orderBy: { createdAt: "desc" }
        });
      }
      return this.prisma.process.findMany({
        where: { clientEmail: "" },
        orderBy: { createdAt: "desc" }
      });
    }

    if (actor.role === "FUNCIONARIO") {
      return this.prisma.process.findMany({
        where: { ownerId: actor.userId },
        orderBy: { createdAt: "desc" }
      });
    }

    return this.prisma.process.findMany({ orderBy: { createdAt: "desc" } });
  }

  async getProcess(processId: string, actor: Actor) {
    const process = await this.prisma.process.findUnique({
      where: { id: processId },
      include: { steps: true, checklists: true, documents: true, chats: true, slaEvents: true }
    });
    if (!process) {
      throw new NotFoundException("Processo não encontrado.");
    }

    if (actor.role === "CLIENTE" && !isClientOwner(actor, process.clientEmail, process.clientPhone)) {
      throw new ForbiddenException();
    }

    if (actor.role === "FUNCIONARIO" && process.ownerId !== actor.userId) {
      throw new ForbiddenException();
    }

    return process;
  }

  private ensureNotReadOnly(process: { status: ProcessStatus }) {
    if (process.status === ProcessStatus.CANCELADO || process.status === ProcessStatus.CONCLUIDO) {
      throw new BadRequestException("Processo somente leitura.");
    }
  }

  async updateStep(processId: string, actor: Actor, stepKey: StepKey, data: Record<string, unknown>) {
    const process = await this.getProcess(processId, actor);
    this.ensureNotReadOnly(process);

    if (actor.role === "MASTER") {
      throw new ForbiddenException();
    }

    if (process.currentStep !== stepKey) {
      throw new BadRequestException("Etapa não é a atual do processo.");
    }

    if (actor.role === "CLIENTE" && !CLIENT_STEPS.includes(stepKey)) {
      throw new ForbiddenException();
    }
    if (actor.role === "FUNCIONARIO" && !EMPLOYEE_STEPS.includes(stepKey)) {
      throw new ForbiddenException();
    }

    const existing = await this.prisma.processStep.findUnique({
      where: { processId_stepKey: { processId, stepKey } }
    });

    if (existing?.locked && actor.role === "CLIENTE") {
      const allowedFields = (existing.data as any)?.correction?.fields ?? [];
      const invalid = Object.keys(data).filter((key) => !allowedFields.includes(key));
      if (invalid.length > 0) {
        throw new BadRequestException("Campos não liberados para correção.");
      }
    }

    const existingData = (existing?.data ?? {}) as Record<string, unknown>;
    const merged = {
      ...existingData,
      ...data
    } as Prisma.InputJsonValue;

    const updated = await this.prisma.processStep.upsert({
      where: { processId_stepKey: { processId, stepKey } },
      update: {
        data: merged,
        status: ProcessStatus.EM_ANDAMENTO
      },
      create: {
        processId,
        stepKey,
        side: stepSide(stepKey),
        data: merged,
        status: ProcessStatus.EM_ANDAMENTO
      }
    });

    await this.auditService.record(actor, "update_step", "ProcessStep", updated.id, { stepKey });

    return updated;
  }

  async submitStep(processId: string, actor: Actor, stepKey: StepKey) {
    if (actor.role !== "CLIENTE") {
      throw new ForbiddenException();
    }

    const process = await this.getProcess(processId, actor);
    this.ensureNotReadOnly(process);

    if (process.currentStep !== stepKey) {
      throw new BadRequestException("Etapa inválida.");
    }

    await this.prisma.processStep.update({
      where: { processId_stepKey: { processId, stepKey } },
      data: { status: ProcessStatus.AGUARDANDO_FUNCIONARIO, locked: true }
    });

    await this.prisma.process.update({
      where: { id: processId },
      data: { status: ProcessStatus.AGUARDANDO_FUNCIONARIO }
    });

    await this.slaService.stopSla(processId, stepKey, "CLIENTE");
    await this.slaService.startSla(processId, stepKey, "FUNCIONARIO");

    await this.auditService.record(actor, "submit_step", "Process", processId, { stepKey });

    return { ok: true };
  }

  async approveStep(processId: string, actor: Actor, stepKey: StepKey) {
    if (actor.role !== "FUNCIONARIO") {
      throw new ForbiddenException();
    }

    const process = await this.getProcess(processId, actor);
    this.ensureNotReadOnly(process);

    if (process.ownerId !== actor.userId) {
      throw new ForbiddenException();
    }

    if (process.currentStep !== stepKey) {
      throw new BadRequestException("Etapa inválida para aprovação.");
    }

    const checklist = await this.prisma.checklist.findUnique({
      where: { processId_stepKey: { processId, stepKey } }
    });
    if (checklist && checklist.status !== "COMPLETO") {
      throw new BadRequestException("Checklist incompleto.");
    }

    if (stepKey === "ETAPA_6") {
      const docs = await this.prisma.documentItem.findMany({ where: { processId } });
      const pending = docs.find((doc) => doc.status !== "APROVADO");
      if (pending) {
        throw new BadRequestException("Documentos pendentes de aprovação.");
      }
    }

    await this.prisma.processStep.update({
      where: { processId_stepKey: { processId, stepKey } },
      data: { status: ProcessStatus.CONCLUIDO, locked: true }
    });

    await this.slaService.stopSla(processId, stepKey, "FUNCIONARIO");

    const next = nextStep(stepKey);
    if (!next) {
      await this.prisma.process.update({
        where: { id: processId },
        data: { status: ProcessStatus.CONCLUIDO, currentStep: stepKey }
      });
      await this.slaService.stopAll(processId);
    await this.notificationService.sendEmail(
      process.clientEmail,
      "Processo concluído",
      "Seu processo foi concluído com sucesso."
    );
    await this.notificationService.sendWhatsApp(process.clientPhone ?? process.clientEmail, "Processo concluído.");
      await this.auditService.record(actor, "process_completed", "Process", processId);
      return { ok: true, status: "CONCLUIDO" };
    }

    const nextSide = stepSide(next);
    const newStatus = nextSide === "CLIENTE" ? ProcessStatus.AGUARDANDO_CLIENTE : ProcessStatus.AGUARDANDO_FUNCIONARIO;

    await this.prisma.process.update({
      where: { id: processId },
      data: { status: newStatus, currentStep: next }
    });

    await this.slaService.startSla(processId, next, nextSide);

    await this.auditService.record(actor, "approve_step", "Process", processId, { stepKey });

    return { ok: true, nextStep: next };
  }

  async requestCorrection(processId: string, actor: Actor, stepKey: StepKey, fields: string[], reason: string) {
    if (actor.role !== "FUNCIONARIO") {
      throw new ForbiddenException();
    }
    const process = await this.getProcess(processId, actor);
    this.ensureNotReadOnly(process);

    if (process.ownerId !== actor.userId) {
      throw new ForbiddenException();
    }

    if (process.currentStep !== stepKey) {
      throw new BadRequestException("Etapa inválida para correção.");
    }

    const step = await this.prisma.processStep.findUnique({
      where: { processId_stepKey: { processId, stepKey } }
    });
    if (!step) {
      throw new BadRequestException("Etapa ainda não preenchida.");
    }

    const updated = await this.prisma.processStep.update({
      where: { processId_stepKey: { processId, stepKey } },
      data: {
        status: ProcessStatus.CORRECAO_SOLICITADA,
        locked: false,
        data: {
          ...(step.data as any),
          correction: {
            fields,
            reason
          }
        }
      }
    });

    await this.prisma.process.update({
      where: { id: processId },
      data: { status: ProcessStatus.CORRECAO_SOLICITADA }
    });

    await this.slaService.stopSla(processId, stepKey, "FUNCIONARIO");
    await this.slaService.startSla(processId, stepKey, "CLIENTE");

    await this.notificationService.sendEmail(
      process.clientEmail,
      "Correção solicitada",
      `Correção solicitada na ${stepKey}: ${reason}`
    );
    await this.notificationService.sendWhatsApp(
      process.clientPhone ?? process.clientEmail,
      `Correção solicitada na ${stepKey}: ${reason}`
    );

    await this.auditService.record(actor, "request_correction", "Process", processId, { stepKey, fields, reason });

    return updated;
  }

  async cancelProcess(processId: string, actor: Actor, reason: string) {
    const process = await this.getProcess(processId, actor);
    this.ensureNotReadOnly(process);

    await this.prisma.process.update({
      where: { id: processId },
      data: {
        status: ProcessStatus.CANCELADO,
        cancelledAt: new Date(),
        cancelledByRole: actor.role,
        cancelledById: actor.userId,
        cancelReason: reason
      }
    });

    await this.prisma.processStep.updateMany({
      where: { processId },
      data: { locked: true }
    });

    await this.slaService.stopAll(processId);

    await this.notificationService.sendEmail(
      process.clientEmail,
      "Processo cancelado",
      `Seu processo foi cancelado. Motivo: ${reason}`
    );
    await this.notificationService.sendWhatsApp(
      process.clientPhone ?? process.clientEmail,
      `Processo cancelado. Motivo: ${reason}`
    );

    await this.auditService.record(actor, "process_cancelled", "Process", processId, { reason });

    return { ok: true };
  }
}
