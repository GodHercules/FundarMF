import { Module } from "@nestjs/common";
import { NotificationService } from "./notification.service";
import { PrismaService } from "../../shared/prisma.service";
import { MockNotificationProvider } from "./mock.provider";
import { NOTIFICATION_PROVIDER } from "./notification.types";
import { SmtpNotificationProvider } from "./smtp.provider";

@Module({
  providers: [
    NotificationService,
    PrismaService,
    {
      provide: NOTIFICATION_PROVIDER,
      useFactory: (prisma: PrismaService) => {
        return process.env.SMTP_HOST ? new SmtpNotificationProvider() : new MockNotificationProvider(prisma);
      },
      inject: [PrismaService]
    }
  ],
  exports: [NotificationService]
})
export class NotificationModule {}
