import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { AuditModule } from "../audit/audit.module";
import { CommonModule } from "../../common/common.module";

@Module({
  imports: [AuditModule, CommonModule],
  controllers: [AdminController],
  providers: [AdminService]
})
export class AdminModule {}
