import { Module } from "@nestjs/common";

import { CommonModule } from "../../common/common.module";
import { AuditModule } from "../audit/audit.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [AuditModule, CommonModule],
  controllers: [AdminController],
  providers: [AdminService]
})
export class AdminModule {}
