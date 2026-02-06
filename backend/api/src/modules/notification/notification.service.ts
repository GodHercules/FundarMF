import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma.service";
import { timeAsync } from "../../shared/perf";
import { getRequestContext } from "../../shared/request-context";
import { renderBaseEmail } from "./email.template";
import { NotificationQueue } from "./notification.queue";
import { EMAIL_PROVIDER, EmailProvider, WHATSAPP_PROVIDER, WhatsAppProvider } from "./notification.types";

export type InAppPayload = {
  userId: string;
  title: string;
  body: string;
  type: string;
  processId?: string;
};

@Injectable()
export class NotificationService {
  constructor(
    private readonly queue: NotificationQueue,
    @Inject(EMAIL_PROVIDER)
    private readonly emailProvider: EmailProvider,
    @Inject(WHATSAPP_PROVIDER)
    private readonly whatsappProvider: WhatsAppProvider,
    private readonly prisma: PrismaService
  ) {}

  async sendEmail(to: string, subject: string, body: string) {
    try {
      const inline = (process.env.NOTIFY_INLINE ?? "false") === "true";
      const { html, text } = renderBaseEmail({ title: subject, body });
      const from = process.env.EMAIL_FROM ?? "no-reply@fundarmf.local";
      const replyTo = process.env.EMAIL_REPLY_TO?.trim() || undefined;
      const correlationId = getRequestContext()?.correlationId;
      if (inline) {
        await timeAsync("externalMs", async () => {
          await this.emailProvider.sendEmail(to, subject, text);
        });
      } else {
        await timeAsync("externalMs", () =>
          this.queue.enqueueEmail({
            to,
            subject,
            text,
            html,
            from,
            replyTo,
            correlationId
          })
        );
      }
    } catch (err) {
      console.error("[notify] sendEmail failed", err);
    }
  }

  async sendWhatsApp(to: string, body: string) {
    try {
      const inline = (process.env.NOTIFY_INLINE ?? "false") === "true";
      const correlationId = getRequestContext()?.correlationId;
      if (inline) {
        await timeAsync("externalMs", async () => {
          await this.whatsappProvider.sendWhatsApp(to, body);
        });
      } else {
        await timeAsync("externalMs", () =>
          this.queue.enqueueWhatsApp({
            to,
            body,
            correlationId
          })
        );
      }
    } catch (err) {
      console.error("[notify] sendWhatsApp failed", err);
    }
  }

  async sendWebhook(payload: {
    email?: string;
    whatsapp?: string;
    link: string;
    otp?: string;
    reason: string;
  }) {
    const enabled = (process.env.N8N_WEBHOOK_ENABLED ?? "true") === "true";
    const url = process.env.N8N_WEBHOOK_URL;
    if (!enabled || !url) return;

    const correlationId = getRequestContext()?.correlationId;
    const secret = process.env.N8N_WEBHOOK_SECRET;
    const controller = new AbortController();
    const timeoutMs = Number(process.env.N8N_WEBHOOK_TIMEOUT_MS ?? 5000);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(secret ? { "x-webhook-secret": secret } : {}),
          ...(correlationId ? { "x-correlation-id": correlationId } : {})
        },
        body: JSON.stringify({
          ...payload,
          correlationId
        }),
        signal: controller.signal
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        console.warn("[notify] webhook failed", response.status, text);
      }
    } catch (err) {
      console.warn("[notify] webhook error", err);
    } finally {
      clearTimeout(timeout);
    }
  }

  async createInApp(payload: InAppPayload) {
    return this.prisma.userNotification.create({
      data: {
        userId: payload.userId,
        processId: payload.processId,
        title: payload.title,
        body: payload.body,
        type: payload.type
      }
    });
  }

  async listInApp(userId: string, limit = 50, offset = 0) {
    const take = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : 50;
    const skip = Number.isFinite(offset) && offset > 0 ? offset : 0;
    return this.prisma.userNotification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
      skip
    });
  }

  async unreadCount(userId: string) {
    return this.prisma.userNotification.count({
      where: { userId, readAt: null }
    });
  }

  async markRead(userId: string, notificationId: string) {
    const result = await this.prisma.userNotification.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date() }
    });
    return { ok: result.count > 0 };
  }
}
