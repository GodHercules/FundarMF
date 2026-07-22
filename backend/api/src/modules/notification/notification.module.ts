import { Module } from "@nestjs/common";

import { PrismaService } from "../../shared/prisma.service";
import {
  FakeWhatsAppProvider,
  MockEmailProvider,
  TerminalEmailProvider,
  TerminalWhatsAppProvider
} from "./mock.provider";
import { NotificationController } from "./notification.controller";
import { NotificationQueue } from "./notification.queue";
import { NotificationService } from "./notification.service";
import { EMAIL_PROVIDER, WHATSAPP_PROVIDER } from "./notification.types";
import { NotificationWorkerService } from "./notification.worker.service";
import { ResendEmailProvider } from "./resend.provider";
import { SmtpEmailProvider, TwilioWhatsAppProvider } from "./smtp.provider";

@Module({
  controllers: [NotificationController],
  providers: [
    NotificationService,
    {
      provide: EMAIL_PROVIDER,
      useFactory: (prisma: PrismaService) => {
        const notifyMode = (process.env.NOTIFY_MODE ?? "mock").toLowerCase();
        if (process.env.NODE_ENV === "production" && (notifyMode === "mock" || notifyMode === "terminal")) {
          throw new Error("NOTIFY_MODE mock/terminal is not allowed in production.");
        }
        if (notifyMode === "terminal") return new TerminalEmailProvider();
        if (notifyMode === "mock") return new MockEmailProvider(prisma);

        const mode = (process.env.EMAIL_PROVIDER ?? "").toLowerCase();
        if (mode === "resend" || process.env.RESEND_API_KEY) {
          return new ResendEmailProvider();
        }
        if (mode === "smtp" || process.env.SMTP_HOST) {
          return new SmtpEmailProvider();
        }
        if (process.env.NODE_ENV === "production") {
          throw new Error("A production email provider must be configured.");
        }
        return new MockEmailProvider(prisma);
      },
      inject: [PrismaService]
    },
    {
      provide: WHATSAPP_PROVIDER,
      useFactory: (prisma: PrismaService) => {
        const notifyMode = (process.env.NOTIFY_MODE ?? "mock").toLowerCase();
        if (process.env.NODE_ENV === "production" && (notifyMode === "mock" || notifyMode === "terminal")) {
          throw new Error("NOTIFY_MODE mock/terminal is not allowed in production.");
        }
        if (notifyMode === "terminal") return new TerminalWhatsAppProvider();
        if (notifyMode === "mock") return new FakeWhatsAppProvider(prisma);

        const mode = (process.env.WHATSAPP_PROVIDER ?? "fake").toLowerCase();
        if (mode === "twilio") {
          return new TwilioWhatsAppProvider();
        }
        if (process.env.NODE_ENV === "production") {
          throw new Error("A production WhatsApp provider must be configured.");
        }
        return new FakeWhatsAppProvider(prisma);
      },
      inject: [PrismaService]
    },
    NotificationQueue,
    NotificationWorkerService
  ],
  exports: [NotificationService]
})
export class NotificationModule {}
