import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ProcessStatus } from "@prisma/client";
import dayjs from "dayjs";
import PDFDocument from "pdfkit";

import { PrismaService } from "../../shared/prisma.service";
import { ErrorObservabilityService } from "../../shared/error-observability.service";

type JobDefinition = {
  name: string;
  everyMs: number;
  handler: () => Promise<unknown>;
};

const toPositiveMs = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

function hasAnyValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return true;
  if (typeof value === "boolean") return value === true;
  if (Array.isArray(value)) return value.some((item) => hasAnyValue(item));
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) => hasAnyValue(item));
  }
  return false;
}

@Injectable()
export class BackgroundService implements OnModuleInit, OnModuleDestroy {
  private readonly timers: NodeJS.Timeout[] = [];
  private readonly running = new Set<string>();

  constructor(private readonly prisma: PrismaService, private readonly observability: ErrorObservabilityService) {}

  async onModuleInit() {
    const jobs: JobDefinition[] = [
      {
        name: "autoAssign",
        everyMs: toPositiveMs(process.env.WORKER_AUTO_ASSIGN_EVERY_MS, 3_600_000),
        handler: () => this.autoAssign()
      },
      {
        name: "slaCheck",
        everyMs: toPositiveMs(process.env.WORKER_SLA_CHECK_EVERY_MS, 3_600_000),
        handler: () => this.checkSla()
      },
      {
        name: "generateReports",
        everyMs: toPositiveMs(process.env.WORKER_REPORTS_EVERY_MS, 3_600_000),
        handler: () => this.generateReports()
      },
      {
        name: "cancelInactiveProcesses",
        everyMs: toPositiveMs(process.env.WORKER_CANCEL_INACTIVE_EVERY_MS, 3_600_000),
        handler: () => this.cancelInactiveProcesses()
      }
    ];

    for (const job of jobs) {
      this.startJob(job);
    }
  }

  async onModuleDestroy() {
    for (const timer of this.timers) {
      clearInterval(timer);
    }
    this.timers.length = 0;
  }

  private startJob(job: JobDefinition) {
    const run = async () => {
      if (this.running.has(job.name)) return;
      this.running.add(job.name);
      try {
        await job.handler();
      } catch (err) {
        console.error(`[background] ${job.name} failed`, err);
        void this.observability.capture(err, { service: "background", processType: "cron", category: "worker", operation: job.name, execution: { processId: process.pid } });
      } finally {
        this.running.delete(job.name);
      }
    };

    const initialDelay = Math.min(5_000, Math.max(500, Math.floor(job.everyMs / 10)));
    const initialTimer = setTimeout(() => {
      void run();
    }, initialDelay);
    this.timers.push(initialTimer as unknown as NodeJS.Timeout);

    const interval = setInterval(() => {
      void run();
    }, job.everyMs);
    this.timers.push(interval);
  }

  private async autoAssign() {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const unassigned = await this.prisma.process.findMany({
      where: {
        ownerId: null,
        createdAt: { lt: tenMinutesAgo },
        status: { notIn: [ProcessStatus.CONCLUIDO, ProcessStatus.CANCELADO] }
      },
      orderBy: { createdAt: "asc" }
    });

    if (unassigned.length === 0) return { assigned: 0 };

    const operators = await this.prisma.user.findMany({ where: { role: "OPERATOR", active: true } });
    if (operators.length === 0) return { assigned: 0 };

    const load = await this.prisma.process.groupBy({
      by: ["ownerId"],
      where: { status: { notIn: [ProcessStatus.CONCLUIDO, ProcessStatus.CANCELADO] } },
      _count: { ownerId: true }
    });

    const loadMap = new Map(load.map((item) => [item.ownerId ?? "", item._count.ownerId]));
    const lastAssignments = await this.prisma.processOwnerHistory.groupBy({
      by: ["ownerId"],
      _max: { assignedAt: true }
    });
    const lastAssignedMap = new Map(
      lastAssignments.map((item) => [item.ownerId ?? "", item._max.assignedAt?.getTime() ?? 0])
    );

    for (const process of unassigned) {
      const sorted = [...operators].sort((a, b) => {
        const countA = loadMap.get(a.id) ?? 0;
        const countB = loadMap.get(b.id) ?? 0;
        if (countA !== countB) return countA - countB;
        const lastA = lastAssignedMap.get(a.id) ?? 0;
        const lastB = lastAssignedMap.get(b.id) ?? 0;
        return lastA - lastB;
      });

      const chosen = sorted[0];
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Process" WHERE id = ${process.id} FOR UPDATE`;
        await tx.process.update({
          where: { id: process.id },
          data: { ownerId: chosen.id }
        });
        await tx.processOwnerHistory.create({
          data: { processId: process.id, ownerId: chosen.id, assignedBy: "system" }
        });
      });

      loadMap.set(chosen.id, (loadMap.get(chosen.id) ?? 0) + 1);
      lastAssignedMap.set(chosen.id, Date.now());
    }

    return { assigned: unassigned.length };
  }

  private async checkSla() {
    const events = await this.prisma.slaEvent.findMany({
      where: { status: { in: ["ON_TRACK", "AT_RISK"] } },
      include: { process: true }
    });
    const configs = await this.prisma.slaConfigStep.findMany();
    const configByKey = new Map(configs.map((config) => [`${config.stepKey}:${config.side}`, config]));

    let notified = 0;

    for (const event of events) {
      const totalMs = dayjs(event.dueAt).diff(dayjs(event.startedAt));
      const elapsedMs = dayjs().diff(dayjs(event.startedAt));
      const percent = (elapsedMs / totalMs) * 100;

      if (percent >= 100 && event.status !== "OVERDUE") {
        await this.prisma.slaEvent.update({
          where: { id: event.id },
          data: { status: "OVERDUE" }
        });
        await this.prisma.notification.createMany({
          data: [
            {
              channel: "EMAIL",
              recipient: event.process.clientEmail,
              subject: "SLA estourado",
              body: `SLA estourado na ${event.stepKey} (${event.side}).`,
              status: "SENT"
            },
            {
              channel: "WHATSAPP",
              recipient: event.process.clientEmail,
              subject: "WhatsApp",
              body: `SLA estourado na ${event.stepKey} (${event.side}).`,
              status: "SENT"
            }
          ]
        });
        notified += 1;
        continue;
      }

      const config = configByKey.get(`${event.stepKey}:${event.side}`);

      const alertPercent = config?.alertPercent ?? 80;
      if (percent >= alertPercent && event.status === "ON_TRACK") {
        await this.prisma.slaEvent.update({
          where: { id: event.id },
          data: { status: "AT_RISK" }
        });
        await this.prisma.notification.createMany({
          data: [
            {
              channel: "EMAIL",
              recipient: event.process.clientEmail,
              subject: "SLA em risco",
              body: `SLA em risco na ${event.stepKey} (${event.side}).`,
              status: "SENT"
            },
            {
              channel: "WHATSAPP",
              recipient: event.process.clientEmail,
              subject: "WhatsApp",
              body: `SLA em risco na ${event.stepKey} (${event.side}).`,
              status: "SENT"
            }
          ]
        });
        notified += 1;
      }
    }

    return { notified };
  }

  private async generateReports() {
    const processes = await this.prisma.process.findMany({
      where: {
        status: ProcessStatus.CONCLUIDO,
        reports: { none: {} }
      },
      include: {
        steps: true,
        checklists: true,
        documents: true,
        slaEvents: true
      },
      orderBy: { createdAt: "asc" },
      take: 20
    });

    for (const process of processes) {
      const doc = new PDFDocument();
      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));

      doc.fontSize(18).text("Relatorio Final - FundarMF", { align: "center" });
      doc.moveDown();
      doc.fontSize(12).text(`Processo: ${process.id}`);
      doc.text(`Cliente: ${process.clientName ?? "-"} (${process.clientEmail})`);
      doc.text(`Status: ${process.status}`);
      doc.moveDown();

      doc.fontSize(14).text("Etapas", { underline: true });
      for (const step of process.steps) {
        doc.fontSize(12).text(`${step.stepKey} - ${step.status}`);
      }

      doc.moveDown();
      doc.fontSize(14).text("Checklist", { underline: true });
      for (const checklist of process.checklists) {
        doc.fontSize(12).text(`${checklist.stepKey}: ${checklist.status}`);
      }

      doc.moveDown();
      doc.fontSize(14).text("Documentos", { underline: true });
      for (const item of process.documents) {
        doc.fontSize(12).text(`${item.itemKey}: ${item.status} (v${item.version})`);
      }

      doc.moveDown();
      doc.fontSize(14).text("SLA", { underline: true });
      for (const sla of process.slaEvents) {
        doc.fontSize(12).text(`${sla.stepKey} ${sla.side}: ${sla.status}`);
      }

      doc.end();

      const buffer = await new Promise<Buffer>((resolve) => {
        doc.on("end", () => resolve(Buffer.concat(chunks)));
      });

      await this.prisma.report.create({
        data: {
          processId: process.id,
          fileName: `relatorio-${process.id}.pdf`,
          mimeType: "application/pdf",
          data: buffer
        }
      });
    }

    return { generated: processes.length };
  }

  private async cancelInactiveProcesses() {
    const fiveDaysAgo = dayjs().subtract(5, "day").toDate();
    const candidates = await this.prisma.process.findMany({
      where: {
        status: ProcessStatus.AGUARDANDO_CLIENTE,
        currentStep: "ETAPA_2",
        createdAt: { lte: fiveDaysAgo }
      },
      include: {
        steps: { where: { stepKey: "ETAPA_2" }, take: 1 }
      }
    });

    let cancelled = 0;

    for (const process of candidates) {
      const step = process.steps[0];
      const data = (step?.data ?? {}) as Record<string, unknown>;
      const hasData = hasAnyValue(data);
      if (hasData) continue;

      await this.prisma.process.update({
        where: { id: process.id },
        data: {
          status: ProcessStatus.CANCELADO,
          cancelledAt: new Date(),
          cancelledByRole: "SYSTEM",
          cancelReason: "Inatividade do cliente"
        }
      });
      cancelled += 1;
    }

    return { cancelled };
  }
}
