import { Module } from "@nestjs/common";
import { NotificationService } from "./notification.service";
import { PrismaService } from "../../shared/prisma.service";
import { FakeWhatsAppProvider, MockEmailProvider } from "./mock.provider";
import { EMAIL_PROVIDER, WHATSAPP_PROVIDER } from "./notification.types";
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
        return process.env.SMTP_HOST ? new SmtpEmailProvider() : new MockEmailProvider(prisma);
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
