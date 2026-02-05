"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessModule = void 0;
const common_1 = require("@nestjs/common");
const process_controller_1 = require("./process.controller");
const process_service_1 = require("./process.service");
const prisma_service_1 = require("../../shared/prisma.service");
const sla_module_1 = require("../sla/sla.module");
const audit_module_1 = require("../audit/audit.module");
const notification_module_1 = require("../notification/notification.module");
const auth_module_1 = require("../auth/auth.module");
const common_module_1 = require("../../common/common.module");
let ProcessModule = class ProcessModule {
};
exports.ProcessModule = ProcessModule;
exports.ProcessModule = ProcessModule = __decorate([
    (0, common_1.Module)({
        imports: [sla_module_1.SlaModule, audit_module_1.AuditModule, notification_module_1.NotificationModule, common_module_1.CommonModule, auth_module_1.AuthModule],
        controllers: [process_controller_1.ProcessController],
        providers: [process_service_1.ProcessService, prisma_service_1.PrismaService]
    })
], ProcessModule);
//# sourceMappingURL=process.module.js.map