import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import bcrypt from "bcryptjs";

import { timeAsync } from "../../shared/perf";
import { PrismaService } from "../../shared/prisma.service";
import { AuditService } from "../audit/audit.service";

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

  async listUsers(limit?: number, offset?: number) {
    const take = Number.isFinite(limit) && limit && limit > 0 ? Math.min(limit, 200) : 100;
    const skip = Number.isFinite(offset) && offset && offset > 0 ? offset : 0;
    return this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take,
      skip,
      select: { id: true, email: true, name: true, whatsapp: true, role: true, createdAt: true, updatedAt: true }
    });
  }

  async createOperator(email: string, name: string, password: string, whatsapp?: string) {
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
        role: "OPERATOR"
      },
      select: { id: true, email: true, name: true, whatsapp: true, role: true, createdAt: true, updatedAt: true }
    });
    return user;
  }

  async deleteOperator(userId: string, actorId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Usuário não encontrado.");
    }
    if (user.role !== "OPERATOR") {
      throw new BadRequestException("Apenas operadores podem ser removidos.");
    }

    const activeProcesses = await this.prisma.process.count({
      where: {
        ownerId: userId,
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
        where: { ownerId: userId },
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

  async deleteProcess(processId: string, actorId?: string, reason?: string) {
    const process = await this.prisma.process.findUnique({ where: { id: processId } });
    if (!process) {
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

  async assignOwner(processId: string, ownerId: string, actorId?: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Process" WHERE id = ${processId} FOR UPDATE`;
      const process = await tx.process.findUnique({ where: { id: processId } });
      if (!process) {
        throw new NotFoundException("Processo não encontrado.");
      }

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

  async listUnassigned() {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    return this.prisma.process.findMany({
      where: { ownerId: null, createdAt: { lt: tenMinutesAgo } },
      orderBy: { createdAt: "asc" }
    });
  }

  async listAudit() {
    return this.prisma.auditEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 200
    });
  }

  async getReport(processId: string) {
    const report = await this.prisma.report.findFirst({
      where: { processId },
      orderBy: { createdAt: "desc" }
    });
    if (!report) {
      throw new NotFoundException("Relatório não encontrado.");
    }
    return report;
  }
}
