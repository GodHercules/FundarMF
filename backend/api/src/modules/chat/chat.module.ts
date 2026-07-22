import { Module } from "@nestjs/common";

import { CommonModule } from "../../common/common.module";
import { AuditModule } from "../audit/audit.module";
import { NotificationModule } from "../notification/notification.module";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";

@Module({
  imports: [NotificationModule, AuditModule, CommonModule],
  controllers: [ChatController],
  providers: [ChatService]
})
export class ChatModule {}
