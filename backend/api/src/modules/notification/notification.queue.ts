import { NOTIFY_EMAIL_JOB, NOTIFY_WHATSAPP_JOB } from "@fundarmf/shared";
import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "crypto";
import PgBoss from "pg-boss";
import { ErrorObservabilityService } from "../../shared/error-observability.service";

export type EmailJobPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
  from?: string;
  replyTo?: string;
  correlationId: string;
};

export type WhatsAppJobPayload = {
  to: string;
  body: string;
  correlationId: string;
};

const toNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

@Injectable()
export class NotificationQueue implements OnModuleInit, OnModuleDestroy {
  private boss?: PgBoss;
  private resolveReady?: () => void;
  private readonly ready = new Promise<void>((resolve) => {
    this.resolveReady = resolve;
  });

  constructor(private readonly observability: ErrorObservabilityService) {}

  async onModuleInit() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is required to enqueue notifications.");
    }
    const sslMode = (process.env.PGSSLMODE ?? "").toLowerCase();
    const noVerify =
      sslMode === "no-verify" || (process.env.PG_BOSS_SSL_NO_VERIFY ?? "false").toLowerCase() === "true";

    const bossOptions: Record<string, unknown> = {
      connectionString,
      max: toNumber(process.env.PG_BOSS_CONNECTION_LIMIT, 3),
      retentionDays: toNumber(process.env.PG_BOSS_RETENTION_DAYS, 30)
    };
    if (noVerify) {
      // Some managed Postgres providers use custom CA chains. Allow opting out of CA validation for pg-boss only.
      bossOptions.ssl = { rejectUnauthorized: false };
    }

    this.boss = new PgBoss(bossOptions as PgBoss.ConstructorOptions);
    await this.boss.start();
    this.resolveReady?.();
  }

  async onModuleDestroy() {
    if (this.boss) {
      await this.boss.stop();
    }
  }

  async whenReady() {
    await this.ready;
  }

  async createQueue(name: string) {
    if (!this.boss) return;
    await this.boss.createQueue(name);
  }

  async work<T = unknown>(
    name: string,
    options: PgBoss.WorkOptions,
    handler: (jobs: PgBoss.Job<T>[]) => Promise<T>
  ) {
    if (!this.boss) return;
    await this.boss.work(name, options as PgBoss.WorkOptions, handler as PgBoss.WorkHandler<T>);
  }

  async enqueueEmail(payload: Omit<EmailJobPayload, "correlationId"> & { correlationId?: string }) {
    if (!this.boss) return null;

    const correlationId = payload.correlationId ?? randomUUID();
    const retryLimit = toNumber(process.env.NOTIFY_RETRY_LIMIT, 5);
    const retryDelay = toNumber(process.env.NOTIFY_RETRY_DELAY_MS, 60_000);
    const retryBackoff = (process.env.NOTIFY_RETRY_BACKOFF ?? "true") === "true";

    try {
      console.log(
        "[notify] enqueue email",
        JSON.stringify({
          correlationId,
          to: payload.to,
          subject: payload.subject,
          mode: process.env.NOTIFY_MODE ?? "mock"
        })
      );
      return await this.boss.send(NOTIFY_EMAIL_JOB, { ...payload, correlationId }, {
        retryLimit,
        retryDelay,
        retryBackoff
      });
    } catch (err) {
      console.error("[notify] enqueue email failed", err);
      void this.observability.capture(err, { service: "notification-queue", processType: "worker", category: "worker", operation: "enqueue_email" });
      return null;
    }
  }

  async enqueueWhatsApp(payload: Omit<WhatsAppJobPayload, "correlationId"> & { correlationId?: string }) {
    if (!this.boss) return null;

    const correlationId = payload.correlationId ?? randomUUID();
    const retryLimit = toNumber(process.env.NOTIFY_RETRY_LIMIT, 5);
    const retryDelay = toNumber(process.env.NOTIFY_RETRY_DELAY_MS, 60_000);
    const retryBackoff = (process.env.NOTIFY_RETRY_BACKOFF ?? "true") === "true";

    try {
      console.log(
        "[notify] enqueue whatsapp",
        JSON.stringify({
          correlationId,
          to: payload.to,
          mode: process.env.NOTIFY_MODE ?? "mock"
        })
      );
      return await this.boss.send(NOTIFY_WHATSAPP_JOB, { ...payload, correlationId }, {
        retryLimit,
        retryDelay,
        retryBackoff
      });
    } catch (err) {
      console.error("[notify] enqueue whatsapp failed", err);
      void this.observability.capture(err, { service: "notification-queue", processType: "worker", category: "worker", operation: "enqueue_whatsapp" });
      return null;
    }
  }
}
