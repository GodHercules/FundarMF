import { Module } from "@nestjs/common";

import { CommonModule } from "../../common/common.module";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { NotificationModule } from "../notification/notification.module";
import { SlaModule } from "../sla/sla.module";
import { ProcessController } from "./process.controller";
import { ProcessService } from "./process.service";

@Module({
  imports: [SlaModule, AuditModule, NotificationModule, CommonModule, AuthModule],
  controllers: [ProcessController],
  providers: [ProcessService]
})
export class ProcessModule {}
