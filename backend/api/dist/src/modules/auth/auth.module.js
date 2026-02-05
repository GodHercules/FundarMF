"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const auth_controller_1 = require("./auth.controller");
const auth_service_1 = require("./auth.service");
const session_service_1 = require("./session.service");
const prisma_service_1 = require("../../shared/prisma.service");
const auth_middleware_1 = require("./auth.middleware");
const notification_module_1 = require("../notification/notification.module");
const audit_module_1 = require("../audit/audit.module");
const common_module_1 = require("../../common/common.module");
let AuthModule = class AuthModule {
    configure(consumer) {
        consumer.apply(auth_middleware_1.AuthMiddleware).forRoutes("*");
    }
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [notification_module_1.NotificationModule, audit_module_1.AuditModule, common_module_1.CommonModule],
        controllers: [auth_controller_1.AuthController],
        providers: [auth_service_1.AuthService, session_service_1.SessionService, prisma_service_1.PrismaService],
        exports: [auth_service_1.AuthService, session_service_1.SessionService]
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map