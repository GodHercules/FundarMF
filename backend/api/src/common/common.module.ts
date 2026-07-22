import { Module } from "@nestjs/common";

import { IdempotencyService } from "../shared/idempotency.service";
import { AuthGuard } from "./auth/auth.guard";
import { RolesGuard } from "./auth/roles.guard";

@Module({
  providers: [AuthGuard, RolesGuard, IdempotencyService],
  exports: [AuthGuard, RolesGuard, IdempotencyService]
})
export class CommonModule {}
