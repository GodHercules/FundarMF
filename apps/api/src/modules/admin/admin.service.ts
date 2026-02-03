import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import bcrypt from "bcryptjs";
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
      throw new BadRequestException("Senha fraca. Use 6+ caracteres e combine letras, números e símbolos.");
    }
  }

  async listUsers() {
    return this.prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  }

  async createOperator(email: string, name: string, password: string, whatsapp?: string) {
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new BadRequestException("E-mail já cadastrado.");
    }
    this.ensureStrongPassword(password);
    const passwordHash = await bcrypt.hash(password, 10);
    return this.prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        whatsapp,
        role: "OPERATOR"
      }
    });
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
