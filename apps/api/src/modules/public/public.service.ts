import dayjs from "dayjs";
import { Injectable } from "@nestjs/common";
import { DocumentItemStatus, ProcessStatus, SlaStatus } from "@prisma/client";
import { PrismaService } from "../../shared/prisma.service";

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics() {
    const [slaConfigs, slaAlerts, auditedDocuments, completedProcesses] = await Promise.all([
      this.prisma.slaConfigStep.count(),
      this.prisma.slaEvent.count({ where: { status: { in: [SlaStatus.AT_RISK, SlaStatus.OVERDUE] } } }),
      this.prisma.documentItem.count({
        where: { status: { in: [DocumentItemStatus.APROVADO, DocumentItemStatus.REPROVADO] } }
      }),
      this.prisma.process.findMany({
        where: { status: ProcessStatus.CONCLUIDO },
        select: { createdAt: true, updatedAt: true }
      })
    ]);

    let avgCompletionDays = 0;
    if (completedProcesses.length > 0) {
      const totalDays = completedProcesses.reduce((sum, process) => {
        return sum + dayjs(process.updatedAt).diff(process.createdAt, "day", true);
      }, 0);
      avgCompletionDays = totalDays / completedProcesses.length;
    }

    return {
      criticalSteps: slaConfigs,
      avgCompletionDays,
      activeAlerts: slaAlerts,
      auditedDocuments
    };
  }
}
