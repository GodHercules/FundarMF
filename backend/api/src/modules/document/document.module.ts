import { Module } from "@nestjs/common";

import { CommonModule } from "../../common/common.module";
import { AuditModule } from "../audit/audit.module";
import { NotificationModule } from "../notification/notification.module";
import { StorageModule } from "../storage/storage.module";
import { DocumentController } from "./document.controller";
import { DocumentService } from "./document.service";

@Module({
  imports: [AuditModule, StorageModule, CommonModule, NotificationModule],
  controllers: [DocumentController],
  providers: [DocumentService]
})
export class DocumentModule {}
