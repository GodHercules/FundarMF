import { Module } from "@nestjs/common";
import { AuthGuard } from "./auth/auth.guard";
import { RolesGuard } from "./auth/roles.guard";

@Module({
  providers: [AuthGuard, RolesGuard],
  exports: [AuthGuard, RolesGuard]
})
export class CommonModule {}
