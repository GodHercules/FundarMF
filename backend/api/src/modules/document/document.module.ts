import { Module } from "@nestjs/common";
import { DocumentController } from "./document.controller";
import { DocumentService } from "./document.service";
import { AuditModule } from "../audit/audit.module";
import { StorageModule } from "../storage/storage.module";
import { CommonModule } from "../../common/common.module";
import { NotificationModule } from "../notification/notification.module";

@Module({
  imports: [AuditModule, StorageModule, CommonModule, NotificationModule],
  controllers: [DocumentController],
  providers: [DocumentService]
})
export class DocumentModule {}
