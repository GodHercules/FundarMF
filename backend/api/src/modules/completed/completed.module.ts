import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { CompletedController } from "./completed.controller";
import { CompletedService } from "./completed.service";

@Module({ imports: [AuditModule], controllers: [CompletedController], providers: [CompletedService] })
export class CompletedModule {}
