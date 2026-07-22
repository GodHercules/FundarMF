import { Module } from "@nestjs/common";

import { CommonModule } from "../../common/common.module";
import { AuditModule } from "../audit/audit.module";
import { ChecklistController } from "./checklist.controller";
import { ChecklistService } from "./checklist.service";

@Module({
  imports: [AuditModule, CommonModule],
  controllers: [ChecklistController],
  providers: [ChecklistService]
})
export class ChecklistModule {}
