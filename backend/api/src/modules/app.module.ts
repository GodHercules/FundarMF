import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { DatabaseModule } from "../shared/database.module";
import { AdminModule } from "./admin/admin.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { BackgroundModule } from "./background/background.module";
import { ChatModule } from "./chat/chat.module";
import { ChecklistModule } from "./checklist/checklist.module";
import { DocumentModule } from "./document/document.module";
import { NotificationModule } from "./notification/notification.module";
import { ProcessModule } from "./process/process.module";
import { PublicModule } from "./public/public.module";
import { SlaModule } from "./sla/sla.module";
import { ObservabilityModule } from "../shared/observability.module";

@Module({
  // Module load order is explicit to keep startup behavior predictable.
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ObservabilityModule,
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
