import { Module } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { PrismaService } from "../../shared/prisma.service";

@Module({
  providers: [AuditService, PrismaService],
  exports: [AuditService]
})
export class AuditModule {}
