import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma.service";
import { NotificationProvider } from "./notification.types";

@Injectable()
export class MockNotificationProvider implements NotificationProvider {
  constructor(private readonly prisma: PrismaService) {}

  async sendEmail(to: string, subject: string, body: string) {
    await this.prisma.notification.create({
      data: {
        channel: "EMAIL",
        recipient: to,
        subject,
        body,
        status: "SENT"
      }
    });
    console.log(`[EMAIL] To: ${to} | ${subject}`);
  }

  async sendWhatsApp(to: string, body: string) {
    await this.prisma.notification.create({
      data: {
        channel: "WHATSAPP",
        recipient: to,
        subject: "WhatsApp",
        body,
        status: "SENT"
      }
    });
    console.log(`[WHATSAPP] To: ${to} | ${body}`);
  }
}
