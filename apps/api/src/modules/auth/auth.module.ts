import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SessionService } from "./session.service";
import { PrismaService } from "../../shared/prisma.service";
import { AuthMiddleware } from "./auth.middleware";
import { NotificationModule } from "../notification/notification.module";
import { AuditModule } from "../audit/audit.module";
import { CommonModule } from "../../common/common.module";

@Module({
  imports: [NotificationModule, AuditModule, CommonModule],
  controllers: [AuthController],
  providers: [AuthService, SessionService, PrismaService],
  exports: [AuthService, SessionService]
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes("*");
  }
}
