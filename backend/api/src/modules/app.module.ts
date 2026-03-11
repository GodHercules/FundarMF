import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "../shared/database.module";
import { AuthModule } from "./auth/auth.module";
import { ProcessModule } from "./process/process.module";
import { AdminModule } from "./admin/admin.module";
import { DocumentModule } from "./document/document.module";
import { ChecklistModule } from "./checklist/checklist.module";
import { ChatModule } from "./chat/chat.module";
import { SlaModule } from "./sla/sla.module";
import { NotificationModule } from "./notification/notification.module";
import { AuditModule } from "./audit/audit.module";
import { PublicModule } from "./public/public.module";
import { BackgroundModule } from "./background/background.module";

@Module({
  // Module load order is explicit to keep startup behavior predictable.
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    ProcessModule,
    AdminModule,
    DocumentModule,
    ChecklistModule,
    ChatModule,
    SlaModule,
    NotificationModule,
    AuditModule,
    PublicModule,
    BackgroundModule
  ],
})
export class AppModule {}
