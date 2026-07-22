import { NOTIFY_EMAIL_JOB, NOTIFY_WHATSAPP_JOB } from "@fundarmf/shared";
import { Inject, Injectable, OnModuleInit } from "@nestjs/common";

import { PrismaService } from "../../shared/prisma.service";
import { ErrorObservabilityService } from "../../shared/error-observability.service";
import {
  EmailJobPayload,
  NotificationQueue,
  WhatsAppJobPayload
} from "./notification.queue";
import {
  EMAIL_PROVIDER,
  EmailProvider,
  WHATSAPP_PROVIDER,
  WhatsAppProvider
} from "./notification.types";

type BossJob<T> = {
  id: string;
  retryCount?: number;
  data: T;
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number) => {
  let timeout: NodeJS.Timeout | undefined;
  try {
    const timer = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error("notify_timeout")), timeoutMs);
    });
    return await Promise.race([promise, timer]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

const toNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const toBoolean = (value: string | undefined, fallback: boolean) => {
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

const getNotifyMode = () => (process.env.NOTIFY_MODE ?? "mock").toLowerCase();

@Injectable()
export class NotificationWorkerService implements OnModuleInit {
  constructor(
    private readonly queue: NotificationQueue,
    private readonly prisma: PrismaService,
    private readonly observability: ErrorObservabilityService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
    @Inject(WHATSAPP_PROVIDER) private readonly whatsappProvider: WhatsAppProvider
  ) {}

  async onModuleInit() {
    await this.queue.whenReady();
    const concurrency = toNumber(
      process.env.NOTIFY_WORKER_CONCURRENCY ?? process.env.WORKER_CONCURRENCY,
      2
    );

    await this.queue.createQueue(NOTIFY_EMAIL_JOB);
    await this.queue.createQueue(NOTIFY_WHATSAPP_JOB);

    await this.queue.work(
      NOTIFY_EMAIL_JOB,
      { batchSize: Math.max(1, concurrency), includeMetadata: true },
      async (jobs) => {
        for (const job of jobs as BossJob<EmailJobPayload>[]) {
          await this.handleEmail(job);
        }
      }
    );

    await this.queue.work(
      NOTIFY_WHATSAPP_JOB,
      { batchSize: Math.max(1, concurrency), includeMetadata: true },
      async (jobs) => {
        for (const job of jobs as BossJob<WhatsAppJobPayload>[]) {
          await this.handleWhatsApp(job);
        }
      }
    );
  }

  private async handleEmail(job: BossJob<EmailJobPayload>) {
    const payload = job.data;
    const mode = getNotifyMode();
    const emailEnabled = toBoolean(process.env.NOTIFY_EMAIL_ENABLED, true);
    if (!emailEnabled) {
      await this.prisma.notification.create({
        data: {
          channel: "EMAIL",
          recipient: payload.to,
          subject: payload.subject,
          body: payload.text,
          status: "SKIPPED"
        }
      });
      return;
    }

    try {
      await withTimeout(
        this.emailProvider.sendEmail(payload.to, payload.subject, payload.text),
        toNumber(process.env.NOTIFY_SEND_TIMEOUT_MS, 15_000)
      );

      if (mode !== "mock") {
        await this.prisma.notification.create({
          data: {
            channel: "EMAIL",
            recipient: payload.to,
            subject: payload.subject,
            body: payload.text,
            status: mode === "real" ? "SENT" : "TERMINAL"
          }
        });
      }
    } catch (err) {
      await this.prisma.notification.create({
        data: {
          channel: "EMAIL",
          recipient: payload.to,
          subject: payload.subject,
          body: payload.text,
          status: "ERROR"
        }
      });
      const attempt = (job.retryCount ?? 0) + 1;
      console.error(
        "[notify] email dispatch failed",
        JSON.stringify({
          correlationId: payload.correlationId,
          jobId: job.id,
          attempt,
          error: err instanceof Error ? err.message : String(err)
        })
      );
      void this.observability.capture(err, { service: "notification-worker", processType: "worker", category: "integration", operation: "email_dispatch", execution: { processId: process.pid, jobId: job.id, attempt } });
      throw err;
    }
  }

  private async handleWhatsApp(job: BossJob<WhatsAppJobPayload>) {
    const payload = job.data;
    const mode = getNotifyMode();
    const whatsAppEnabled = toBoolean(process.env.NOTIFY_WHATSAPP_ENABLED, true);
    if (!whatsAppEnabled) {
      await this.prisma.notification.create({
        data: {
          channel: "WHATSAPP",
          recipient: payload.to,
          subject: "WhatsApp",
          body: payload.body,
          status: "SKIPPED"
        }
      });
      return;
    }

    try {
      await withTimeout(
        this.whatsappProvider.sendWhatsApp(payload.to, payload.body),
        toNumber(process.env.NOTIFY_SEND_TIMEOUT_MS, 15_000)
      );

      if (mode !== "mock") {
        await this.prisma.notification.create({
          data: {
            channel: "WHATSAPP",
            recipient: payload.to,
            subject: "WhatsApp",
            body: payload.body,
            status: mode === "real" ? "SENT" : "TERMINAL"
          }
        });
      }
    } catch (err) {
      await this.prisma.notification.create({
        data: {
          channel: "WHATSAPP",
          recipient: payload.to,
          subject: "WhatsApp",
          body: payload.body,
          status: "ERROR"
        }
      });
      const attempt = (job.retryCount ?? 0) + 1;
      console.error(
        "[notify] whatsapp dispatch failed",
        JSON.stringify({
          correlationId: payload.correlationId,
          jobId: job.id,
          attempt,
          error: err instanceof Error ? err.message : String(err)
        })
      );
      void this.observability.capture(err, { service: "notification-worker", processType: "worker", category: "integration", operation: "whatsapp_dispatch", execution: { processId: process.pid, jobId: job.id, attempt } });
      throw err;
    }
  }
}
