import { Module } from "@nestjs/common";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { PrismaService } from "../../shared/prisma.service";
import { NotificationModule } from "../notification/notification.module";
import { AuditModule } from "../audit/audit.module";
import { CommonModule } from "../../common/common.module";

@Module({
  imports: [NotificationModule, AuditModule, CommonModule],
  controllers: [ChatController],
  providers: [ChatService, PrismaService]
})
export class ChatModule {}
