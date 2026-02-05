import { Module } from "@nestjs/common";
import { NotificationService } from "./notification.service";
import { PrismaService } from "../../shared/prisma.service";
import { FakeWhatsAppProvider, MockEmailProvider } from "./mock.provider";
import { EMAIL_PROVIDER, WHATSAPP_PROVIDER } from "./notification.types";
import { ResendEmailProvider } from "./resend.provider";
import { SmtpEmailProvider, TwilioWhatsAppProvider } from "./smtp.provider";
import { NotificationController } from "./notification.controller";

@Module({
  controllers: [NotificationController],
  providers: [
    NotificationService,
    PrismaService,
    {
      provide: EMAIL_PROVIDER,
      useFactory: (prisma: PrismaService) => {
        const mode = (process.env.EMAIL_PROVIDER ?? "").toLowerCase();
        if (mode === "resend" || process.env.RESEND_API_KEY) {
          return new ResendEmailProvider();
        }
        if (mode === "smtp" || process.env.SMTP_HOST) {
          return new SmtpEmailProvider();
        }
        return new MockEmailProvider(prisma);
      },
      inject: [PrismaService]
    },
    {
      provide: WHATSAPP_PROVIDER,
      useFactory: (prisma: PrismaService) => {
        const mode = (process.env.WHATSAPP_PROVIDER ?? "fake").toLowerCase();
        if (mode === "twilio") {
          return new TwilioWhatsAppProvider();
        }
        return new FakeWhatsAppProvider(prisma);
      },
      inject: [PrismaService]
    }
  ],
  exports: [NotificationService]
})
export class NotificationModule {}
