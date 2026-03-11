import { Module } from "@nestjs/common";
import { AuthGuard } from "./auth/auth.guard";
import { RolesGuard } from "./auth/roles.guard";
import { IdempotencyService } from "../shared/idempotency.service";

@Module({
  providers: [AuthGuard, RolesGuard, IdempotencyService],
  exports: [AuthGuard, RolesGuard, IdempotencyService]
})
export class CommonModule {}
