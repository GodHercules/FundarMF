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
export class TerminalEmailProvider implements EmailProvider {
  async sendEmail(to: string, subject: string, body: string) {
    const htmlPreview = body
      .split("\n")
      .map((line) => line.trim())
      .map((line) => (line ? `<p style="margin:0 0 8px;">${line}</p>` : "<br/>"))
      .join("");
    console.log("----- EMAIL (terminal mode) -----");
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log("");
    console.log("HTML:");
    console.log(htmlPreview);
    console.log("");
    console.log("Text:");
    console.log(body);
    console.log("--------------------------------");
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

@Injectable()
export class TerminalWhatsAppProvider implements WhatsAppProvider {
  async sendWhatsApp(to: string, body: string) {
    console.log("----- WHATSAPP (terminal mode) -----");
    console.log(`To: ${to}`);
    console.log("");
    console.log(body);
    console.log("-----------------------------------");
  }
}
