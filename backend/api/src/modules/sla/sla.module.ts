import { Module } from "@nestjs/common";

import { CommonModule } from "../../common/common.module";
import { SlaController } from "./sla.controller";
import { SlaService } from "./sla.service";

@Module({
  controllers: [SlaController],
  providers: [SlaService],
  imports: [CommonModule],
  exports: [SlaService]
})
export class SlaModule {}
