import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { StepKey } from "@prisma/client";
import { PrismaService } from "../../shared/prisma.service";
import { Actor } from "../../common/auth/types";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class ChecklistService {
  constructor(private readonly prisma: PrismaService, private readonly auditService: AuditService) {}

  async getChecklist(processId: string, stepKey: StepKey, actor: Actor) {
    const checklist = await this.prisma.checklist.findUnique({
      where: { processId_stepKey: { processId, stepKey } }
    });
    if (!checklist) {
      throw new NotFoundException("Checklist não encontrado.");
    }

    if (actor.role === "OPERADOR") {
      const process = await this.prisma.process.findUnique({ where: { id: processId } });
      if (process?.ownerId !== actor.userId) {
        throw new ForbiddenException();
      }
    }

    if (actor.role === "CLIENTE") {
      throw new ForbiddenException();
    }

    return checklist;
  }

  async updateChecklist(processId: string, stepKey: StepKey, items: Record<string, boolean>, actor: Actor) {
    if (actor.role !== "OPERADOR") {
      throw new ForbiddenException();
    }

    const process = await this.prisma.process.findUnique({ where: { id: processId } });
    if (!process || process.ownerId !== actor.userId) {
      throw new ForbiddenException();
    }

    const values = Object.values(items);
    const status = values.length > 0 && values.every((val) => val === true) ? "COMPLETO" : "PENDENTE";

    const checklist = await this.prisma.checklist.update({
      where: { processId_stepKey: { processId, stepKey } },
      data: {
        items,
        status
      }
    });

    await this.auditService.record(actor, "update_checklist", "Checklist", checklist.id, { stepKey, status });

    return checklist;
  }
}
