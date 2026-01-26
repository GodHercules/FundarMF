import { Module } from "@nestjs/common";
import { ChecklistController } from "./checklist.controller";
import { ChecklistService } from "./checklist.service";
import { PrismaService } from "../../shared/prisma.service";
import { AuditModule } from "../audit/audit.module";
import { CommonModule } from "../../common/common.module";

@Module({
  imports: [AuditModule, CommonModule],
  controllers: [ChecklistController],
  providers: [ChecklistService, PrismaService]
})
export class ChecklistModule {}
