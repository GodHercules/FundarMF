import { Module } from "@nestjs/common";
import { SlaService } from "./sla.service";
import { SlaController } from "./sla.controller";
import { CommonModule } from "../../common/common.module";

@Module({
  controllers: [SlaController],
  providers: [SlaService],
  imports: [CommonModule],
  exports: [SlaService]
})
export class SlaModule {}
