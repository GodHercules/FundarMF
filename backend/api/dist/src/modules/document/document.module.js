"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentModule = void 0;
const common_1 = require("@nestjs/common");
const document_controller_1 = require("./document.controller");
const document_service_1 = require("./document.service");
const prisma_service_1 = require("../../shared/prisma.service");
const audit_module_1 = require("../audit/audit.module");
const storage_module_1 = require("../storage/storage.module");
const common_module_1 = require("../../common/common.module");
const notification_module_1 = require("../notification/notification.module");
let DocumentModule = class DocumentModule {
};
exports.DocumentModule = DocumentModule;
exports.DocumentModule = DocumentModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_module_1.AuditModule, storage_module_1.StorageModule, common_module_1.CommonModule, notification_module_1.NotificationModule],
        controllers: [document_controller_1.DocumentController],
        providers: [document_service_1.DocumentService, prisma_service_1.PrismaService]
    })
], DocumentModule);
//# sourceMappingURL=document.module.js.map