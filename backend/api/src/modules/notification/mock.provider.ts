import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma.service";
import { EmailProvider, WhatsAppProvider } from "./notification.types";

@Injectable()
export class MockEmailProvider implements EmailProvider {
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
}

@Injectable()
export class FakeWhatsAppProvider implements WhatsAppProvider {
  constructor(private readonly prisma: PrismaService) {}

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
    console.log(`[WHATSAPP:FAKE] To: ${to} | ${body}`);
  }
}
