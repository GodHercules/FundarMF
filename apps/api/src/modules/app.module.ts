import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaService } from "../shared/prisma.service";
import { AuthModule } from "./auth/auth.module";
import { ProcessModule } from "./process/process.module";
import { AdminModule } from "./admin/admin.module";
import { DocumentModule } from "./document/document.module";
import { ChecklistModule } from "./checklist/checklist.module";
import { ChatModule } from "./chat/chat.module";
import { SlaModule } from "./sla/sla.module";
import { NotificationModule } from "./notification/notification.module";
import { AuditModule } from "./audit/audit.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    ProcessModule,
    AdminModule,
    DocumentModule,
    ChecklistModule,
    ChatModule,
    SlaModule,
    NotificationModule,
    AuditModule
  ],
  providers: [PrismaService]
})
export class AppModule {}
