import { Module } from "@nestjs/common";
import { NotificationService } from "./notification.service";
import { PrismaService } from "../../shared/prisma.service";
import { NotificationController } from "./notification.controller";
import { NotificationQueue } from "./notification.queue";

@Module({
  controllers: [NotificationController],
  providers: [
    NotificationService,
    PrismaService,
    NotificationQueue
  ],
  exports: [NotificationService]
})
export class NotificationModule {}
