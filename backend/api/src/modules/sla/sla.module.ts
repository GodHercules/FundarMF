import { Module } from "@nestjs/common";
import { SlaService } from "./sla.service";
import { SlaController } from "./sla.controller";
import { PrismaService } from "../../shared/prisma.service";
import { CommonModule } from "../../common/common.module";

@Module({
  controllers: [SlaController],
  providers: [SlaService, PrismaService],
  imports: [CommonModule],
  exports: [SlaService]
})
export class SlaModule {}
