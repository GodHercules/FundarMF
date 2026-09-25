import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ProcessStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

import { Actor } from "../../common/auth/types";
import { timeAsync } from "../../shared/perf";
import { PrismaService } from "../../shared/prisma.service";
import { AuditService } from "../audit/audit.service";

const AUDIT_RETENTION_DAYS = 30;
const SAFE_AUDIT_DETAIL_KEYS = new Set([
  "source",
  "stepKey",
  "nextStep",
  "status",
  "newStatus",
  "previousStatus",
  "kanbanStage",
  "from",
  "to",
  "sendEmail",
  "sendWhatsapp",
  "count",
  "version",
  "format",
  "conversion",
  "editable",
  "stage"
]);

function sanitizeAuditDetails(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const safeDetails: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    if (!SAFE_AUDIT_DETAIL_KEYS.has(key)) continue;
    if (typeof value === "string") {
      const normalized = value.replace(/[\r\n\t]/g, " ").trim();
      if (normalized.length > 0 && normalized.length <= 120) safeDetails[key] = normalized;
    } else if (typeof value === "number" || typeof value === "boolean") {
      safeDetails[key] = value;
    }
  }
  return safeDetails;
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService, private readonly auditService: AuditService) {}

  private ensureStrongPassword(password: string) {
    const hasMin = password.length >= 6;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);
    const score = [hasUpper, hasLower, hasNumber, hasSymbol].filter(Boolean).length;

    if (!hasMin || score < 2) {
      throw new BadRequestException("Senha fraca. Use 6+ caracteres e combine letras, nmeros e smbolos.");
    }
  }

  async listUsers(actor: Actor, limit?: number, offset?: number) {
    const take = Number.isFinite(limit) && limit && limit > 0 ? Math.min(limit, 200) : 100;
    const skip = Number.isFinite(offset) && offset && offset > 0 ? offset : 0;
    return this.prisma.user.findMany({
      where: { tenantKey: actor.tenantKey ?? "default" },
      orderBy: { createdAt: "desc" },
      take,
      skip,
      select: { id: true, email: true, name: true, whatsapp: true, role: true, createdAt: true, updatedAt: true }
    });
  }

  async createOperator(email: string, name: string, password: string, whatsapp?: string, actor?: Actor) {
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new BadRequestException("E-mail j cadastrado.");
    }
    this.ensureStrongPassword(password);
    const passwordHash = await timeAsync("hashMs", () => bcrypt.hash(password, 10));
    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        whatsapp,
        role: "OPERATOR",
        tenantKey: actor?.tenantKey ?? "default"
      },
      select: { id: true, email: true, name: true, whatsapp: true, role: true, createdAt: true, updatedAt: true }
    });
    return user;
  }

  async deleteOperator(userId: string, actorId?: string, tenantKey = "default") {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || (user.tenantKey !== undefined && user.tenantKey !== tenantKey)) {
      throw new NotFoundException("Usuário não encontrado.");
    }
    if (user.role !== "OPERATOR") {
      throw new BadRequestException("Apenas operadores podem ser removidos.");
    }

    const activeProcesses = await this.prisma.process.count({
      where: {
        ownerId: userId,
        tenantKey,
        status: { notIn: ["CONCLUIDO", "CANCELADO"] }
      }
    });
    if (activeProcesses > 0) {
      throw new ConflictException(
        "Operador possui processo(s) em andamento. Exclua os processos em andamento antes de remover o operador."
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.process.updateMany({
        where: { ownerId: userId, tenantKey },
        data: { ownerId: null }
      });

      await tx.session.deleteMany({
        where: { userId }
      });

      await tx.userNotification.deleteMany({
        where: { userId }
      });

      await tx.user.delete({
        where: { id: userId }
      });
    });

    await this.auditService.record(
      actorId ? { role: "MASTER", userId: actorId } : { role: "SYSTEM" },
      "user_deleted",
      "User",
      userId
    );

    return { ok: true };
  }

  async deleteProcess(processId: string, actorId?: string, reason?: string, tenantKey = "default") {
    const process = await this.prisma.process.findUnique({ where: { id: processId } });
    if (!process || (process.tenantKey !== undefined && process.tenantKey !== tenantKey)) {
      throw new NotFoundException("Processo não encontrado.");
    }

    await this.prisma.$transaction(async (tx) => {
      const documentItems = await tx.documentItem.findMany({
        where: { processId },
        select: { id: true }
      });
      const documentItemIds = documentItems.map((item) => item.id);

      if (documentItemIds.length > 0) {
        await tx.documentFile.deleteMany({
          where: { itemId: { in: documentItemIds } }
        });
      }

      await tx.documentItem.deleteMany({ where: { processId } });
      await tx.processStep.deleteMany({ where: { processId } });
      await tx.checklist.deleteMany({ where: { processId } });
      await tx.slaEvent.deleteMany({ where: { processId } });
      await tx.report.deleteMany({ where: { processId } });
      await tx.userNotification.deleteMany({ where: { processId } });
      await tx.processOwnerHistory.deleteMany({ where: { processId } });

      const threads = await tx.chatThread.findMany({
        where: { processId },
        select: { id: true }
      });
      const threadIds = threads.map((thread) => thread.id);

      if (threadIds.length > 0) {
        await tx.chatMessage.deleteMany({
          where: { threadId: { in: threadIds } }
        });
      }

      await tx.chatThread.deleteMany({ where: { processId } });

      await tx.process.delete({
        where: { id: processId }
      });
    });

    await this.auditService.record(
      actorId ? { role: "MASTER", userId: actorId } : { role: "SYSTEM" },
      "process_deleted",
      "Process",
      processId,
      { reason: reason ?? "Processo removido pelo master" }
    );

    return { ok: true };
  }

  async assignOwner(processId: string, ownerId: string, actorId?: string, tenantKey = "default") {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Process" WHERE id = ${processId} FOR UPDATE`;
      const process = await tx.process.findFirst({ where: { id: processId, tenantKey } });
      if (!process) {
        throw new NotFoundException("Processo não encontrado.");
      }

      const owner = await tx.user.findFirst({ where: { id: ownerId, role: "OPERATOR", active: true, tenantKey } });
      if (!owner) throw new NotFoundException("Operador não encontrado neste tenant.");

      await tx.process.update({
        where: { id: processId },
        data: { ownerId }
      });

      await tx.processOwnerHistory.create({
        data: { processId, ownerId, assignedBy: actorId }
      });
    });

    await this.auditService.record(
      actorId ? { role: "MASTER", userId: actorId } : { role: "SYSTEM" },
      "assign_owner",
      "Process",
      processId,
      { ownerId }
    );

    return { ok: true };
  }

  async listUnassigned(tenantKey = "default") {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    return this.prisma.process.findMany({
      where: { ownerId: null, tenantKey, createdAt: { lt: tenMinutesAgo } },
      orderBy: { createdAt: "asc" }
    });
  }

  async listAudit(tenantKey = "default") {
    return this.prisma.auditEvent.findMany({
      where: { tenantKey },
      orderBy: { createdAt: "desc" },
      take: 200
    });
  }

  async listProcessAudit(processId: string, actor: Actor) {
    const tenantKey = actor.tenantKey ?? "default";
    const process = await this.prisma.process.findFirst({
      where: { id: processId, tenantKey },
      select: {
        id: true,
        status: true,
        updatedAt: true,
        steps: { select: { id: true } },
        checklists: { select: { id: true } },
        documents: { select: { id: true, files: { select: { id: true } } } },
        chats: { select: { id: true } },
        alteracoesContratuais: { select: { id: true } },
        contracts: { select: { id: true } },
        reports: { select: { id: true } }
      }
    });
    if (!process) throw new NotFoundException("Processo não encontrado.");

    const idsByEntity = {
      ProcessStep: process.steps.map((item) => item.id),
      Checklist: process.checklists.map((item) => item.id),
      DocumentItem: process.documents.map((item) => item.id),
      DocumentFile: process.documents.flatMap((item) => item.files.map((file) => file.id)),
      ChatThread: process.chats.map((item) => item.id),
      AlteracaoContratual: process.alteracoesContratuais.map((item) => item.id),
      Contract: process.contracts.map((item) => item.id),
      Report: process.reports.map((item) => item.id)
    };
    const entityFilters = Object.entries(idsByEntity)
      .filter(([, ids]) => ids.length > 0)
      .map(([entity, ids]) => ({ entity, entityId: { in: ids } }));
    const processFilter = { entity: "Process", entityId: process.id };
    const auditScope = { tenantKey, OR: [processFilter, ...entityFilters] };
    const retentionCutoff = new Date(Date.now() - AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const [events, latestEvent] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where: { ...auditScope, createdAt: { gte: retentionCutoff } },
        orderBy: { createdAt: "desc" },
        take: 500,
        select: { id: true, action: true, entity: true, actorRole: true, createdAt: true, metadata: true }
      }),
      this.prisma.auditEvent.findFirst({
        where: auditScope,
        orderBy: { createdAt: "desc" },
        select: { createdAt: true }
      })
    ]);

    const lastActivityAt = latestEvent && latestEvent.createdAt > process.updatedAt ? latestEvent.createdAt : process.updatedAt;
    return {
      retentionDays: AUDIT_RETENTION_DAYS,
      retentionCutoff,
      lastActivityAt,
      activityStatus: process.status === ProcessStatus.CONCLUIDO ? "CONCLUIDA" : "SEM_MOVIMENTACAO",
      events: events.map((event) => ({
        id: event.id,
        action: event.action,
        entity: event.entity,
        actorRole: event.actorRole,
        createdAt: event.createdAt,
        details: sanitizeAuditDetails(event.metadata)
      }))
    };
  }

  async getReport(processId: string, tenantKey = "default") {
    const report = await this.prisma.report.findFirst({
      where: { processId, process: { tenantKey } },
      orderBy: { createdAt: "desc" }
    });
    if (!report) {
      throw new NotFoundException("Relatório não encontrado.");
    }
    return report;
  }
}
