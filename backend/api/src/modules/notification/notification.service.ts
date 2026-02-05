import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma.service";
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
    @Inject(EMAIL_PROVIDER)
    private readonly emailProvider: EmailProvider,
    @Inject(WHATSAPP_PROVIDER)
    private readonly whatsappProvider: WhatsAppProvider,
    private readonly prisma: PrismaService
  ) {}

  async sendEmail(to: string, subject: string, body: string) {
    await this.emailProvider.sendEmail(to, subject, body);
  }

  async sendWhatsApp(to: string, body: string) {
    await this.whatsappProvider.sendWhatsApp(to, body);
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
