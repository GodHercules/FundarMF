"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChecklistModule = void 0;
const common_1 = require("@nestjs/common");
const checklist_controller_1 = require("./checklist.controller");
const checklist_service_1 = require("./checklist.service");
const prisma_service_1 = require("../../shared/prisma.service");
const audit_module_1 = require("../audit/audit.module");
const common_module_1 = require("../../common/common.module");
let ChecklistModule = class ChecklistModule {
};
exports.ChecklistModule = ChecklistModule;
exports.ChecklistModule = ChecklistModule = __decorate([
    (0, common_1.Module)({
        imports: [audit_module_1.AuditModule, common_module_1.CommonModule],
        controllers: [checklist_controller_1.ChecklistController],
        providers: [checklist_service_1.ChecklistService, prisma_service_1.PrismaService]
    })
], ChecklistModule);
//# sourceMappingURL=checklist.module.js.map