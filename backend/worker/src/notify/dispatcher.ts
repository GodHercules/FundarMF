import type PgBoss from "pg-boss";
import { PrismaClient } from "@prisma/client";
import {
  EmailProvider,
  MockEmailProvider,
  ResendEmailProvider,
  SmtpEmailProvider,
  TerminalEmailProvider
} from "./email.providers";
import {
  MockWhatsAppProvider,
  TerminalWhatsAppProvider,
  TwilioWhatsAppProvider,
  WhatsAppProvider
} from "./whatsapp.providers";
import {
  getEmailProviderMode,
  getNotifyMode,
  getNotifyTimeoutMs,
  getWhatsAppProviderMode,
  isEmailEnabled,
  isWhatsAppEnabled
} from "./config";
import { EmailJobPayload, NotifyMode, WhatsAppJobPayload } from "./types";

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

const logAttempt = (payload: Record<string, unknown>) => {
  console.log(JSON.stringify(payload));
};

export class NotificationDispatcher {
  private readonly prisma: PrismaClient;
  private emailProvider?: EmailProvider;
  private whatsappProvider?: WhatsAppProvider;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  private getEmailProvider(mode: NotifyMode): EmailProvider {
    if (mode === "terminal") return new TerminalEmailProvider();
    if (mode === "mock") return new MockEmailProvider();

    if (!this.emailProvider) {
      const provider = getEmailProviderMode();
      if (provider === "resend") {
        this.emailProvider = new ResendEmailProvider();
      } else {
        this.emailProvider = new SmtpEmailProvider();
      }
    }
    return this.emailProvider;
  }

  private getWhatsAppProvider(mode: NotifyMode): WhatsAppProvider {
    if (mode === "terminal") return new TerminalWhatsAppProvider();
    if (mode === "mock") return new MockWhatsAppProvider();

    if (!this.whatsappProvider) {
      const provider = getWhatsAppProviderMode();
      if (provider === "twilio") {
        this.whatsappProvider = new TwilioWhatsAppProvider();
      } else {
        this.whatsappProvider = new MockWhatsAppProvider();
      }
    }
    return this.whatsappProvider;
  }

  async handleEmail(job: PgBoss.JobWithMetadata<EmailJobPayload>) {
    const mode = getNotifyMode();
    const attempt = job.retryCount + 1;
    const startedAt = Date.now();
    const payload = job.data;
    const timeoutMs = getNotifyTimeoutMs();
    console.log(
      "[notify] worker received email",
      JSON.stringify({
        correlationId: payload.correlationId,
        jobId: job.id,
        attempt,
        mode,
        to: payload.to,
        subject: payload.subject
      })
    );

    if (!isEmailEnabled()) {
      logAttempt({
        level: "info",
        event: "notify_email_skipped",
        correlationId: payload.correlationId,
        jobId: job.id,
        attempt,
        mode,
        to: payload.to,
        subject: payload.subject
      });
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
      const provider = this.getEmailProvider(mode);
      await withTimeout(provider.sendEmail(payload), timeoutMs);
      const durationMs = Date.now() - startedAt;
      logAttempt({
        level: "info",
        event: "notify_email_sent",
        correlationId: payload.correlationId,
        jobId: job.id,
        attempt,
        mode,
        durationMs,
        to: payload.to,
        subject: payload.subject
      });
      await this.prisma.notification.create({
        data: {
          channel: "EMAIL",
          recipient: payload.to,
          subject: payload.subject,
          body: payload.text,
          status: mode === "real" ? "SENT" : mode.toUpperCase()
        }
      });
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      logAttempt({
        level: "error",
        event: "notify_email_failed",
        correlationId: payload.correlationId,
        jobId: job.id,
        attempt,
        mode,
        durationMs,
        to: payload.to,
        subject: payload.subject,
        error: err instanceof Error ? err.message : String(err)
      });
      await this.prisma.notification.create({
        data: {
          channel: "EMAIL",
          recipient: payload.to,
          subject: payload.subject,
          body: payload.text,
          status: "ERROR"
        }
      });
      throw err;
    }
  }

  async handleWhatsApp(job: PgBoss.JobWithMetadata<WhatsAppJobPayload>) {
    const mode = getNotifyMode();
    const attempt = job.retryCount + 1;
    const startedAt = Date.now();
    const payload = job.data;
    const timeoutMs = getNotifyTimeoutMs();
    console.log(
      "[notify] worker received whatsapp",
      JSON.stringify({
        correlationId: payload.correlationId,
        jobId: job.id,
        attempt,
        mode,
        to: payload.to
      })
    );

    if (!isWhatsAppEnabled()) {
      logAttempt({
        level: "info",
        event: "notify_whatsapp_skipped",
        correlationId: payload.correlationId,
        jobId: job.id,
        attempt,
        mode,
        to: payload.to
      });
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
      const provider = this.getWhatsAppProvider(mode);
      await withTimeout(provider.sendWhatsApp(payload), timeoutMs);
      const durationMs = Date.now() - startedAt;
      logAttempt({
        level: "info",
        event: "notify_whatsapp_sent",
        correlationId: payload.correlationId,
        jobId: job.id,
        attempt,
        mode,
        durationMs,
        to: payload.to
      });
      await this.prisma.notification.create({
        data: {
          channel: "WHATSAPP",
          recipient: payload.to,
          subject: "WhatsApp",
          body: payload.body,
          status: mode === "real" ? "SENT" : mode.toUpperCase()
        }
      });
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      logAttempt({
        level: "error",
        event: "notify_whatsapp_failed",
        correlationId: payload.correlationId,
        jobId: job.id,
        attempt,
        mode,
        durationMs,
        to: payload.to,
        error: err instanceof Error ? err.message : String(err)
      });
      await this.prisma.notification.create({
        data: {
          channel: "WHATSAPP",
          recipient: payload.to,
          subject: "WhatsApp",
          body: payload.body,
          status: "ERROR"
        }
      });
      throw err;
    }
  }
}
