import { Module } from "@nestjs/common";
import { ProcessController } from "./process.controller";
import { ProcessService } from "./process.service";
import { PrismaService } from "../../shared/prisma.service";
import { SlaModule } from "../sla/sla.module";
import { AuditModule } from "../audit/audit.module";
import { NotificationModule } from "../notification/notification.module";
import { AuthModule } from "../auth/auth.module";
import { CommonModule } from "../../common/common.module";

@Module({
  imports: [SlaModule, AuditModule, NotificationModule, CommonModule, AuthModule],
  controllers: [ProcessController],
  providers: [ProcessService, PrismaService]
})
export class ProcessModule {}
