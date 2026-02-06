import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import PgBoss from "pg-boss";
import { randomUUID } from "crypto";
import { NOTIFY_EMAIL_JOB, NOTIFY_WHATSAPP_JOB } from "@fundarmf/shared";

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

  async onModuleInit() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is required to enqueue notifications.");
    }
    this.boss = new PgBoss({ connectionString });
    await this.boss.start();
  }

  async onModuleDestroy() {
    if (this.boss) {
      await this.boss.stop();
    }
  }

  async enqueueEmail(payload: Omit<EmailJobPayload, "correlationId"> & { correlationId?: string }) {
    if (!this.boss) return null;

    const correlationId = payload.correlationId ?? randomUUID();
    const retryLimit = toNumber(process.env.NOTIFY_RETRY_LIMIT, 5);
    const retryDelay = toNumber(process.env.NOTIFY_RETRY_DELAY_MS, 60_000);
    const retryBackoff = (process.env.NOTIFY_RETRY_BACKOFF ?? "true") === "true";

    try {
      return await this.boss.send(NOTIFY_EMAIL_JOB, { ...payload, correlationId }, {
        retryLimit,
        retryDelay,
        retryBackoff
      });
    } catch (err) {
      console.error("[notify] enqueue email failed", err);
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
      return await this.boss.send(NOTIFY_WHATSAPP_JOB, { ...payload, correlationId }, {
        retryLimit,
        retryDelay,
        retryBackoff
      });
    } catch (err) {
      console.error("[notify] enqueue whatsapp failed", err);
      return null;
    }
  }
}
