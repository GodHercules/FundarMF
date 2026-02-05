"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChecklistService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../shared/prisma.service");
const audit_service_1 = require("../audit/audit.service");
let ChecklistService = class ChecklistService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    async getChecklist(processId, stepKey, actor) {
        const checklist = await this.prisma.checklist.findUnique({
            where: { processId_stepKey: { processId, stepKey: stepKey } }
        });
        if (!checklist) {
            throw new common_1.NotFoundException("Checklist não encontrado.");
        }
        if (actor.role === "OPERADOR") {
            const process = await this.prisma.process.findUnique({ where: { id: processId } });
            if (process?.ownerId !== actor.userId) {
                throw new common_1.ForbiddenException();
            }
        }
        if (actor.role === "CLIENTE") {
            throw new common_1.ForbiddenException();
        }
        return checklist;
    }
    async updateChecklist(processId, stepKey, items, actor) {
        if (actor.role !== "OPERADOR") {
            throw new common_1.ForbiddenException();
        }
        const process = await this.prisma.process.findUnique({ where: { id: processId } });
        if (!process || process.ownerId !== actor.userId) {
            throw new common_1.ForbiddenException();
        }
        const values = Object.values(items);
        const status = values.length > 0 && values.every((val) => val === true) ? "COMPLETO" : "PENDENTE";
        const checklist = await this.prisma.checklist.update({
            where: { processId_stepKey: { processId, stepKey: stepKey } },
            data: {
                items,
                status
            }
        });
        await this.auditService.record(actor, "update_checklist", "Checklist", checklist.id, { stepKey, status });
        return checklist;
    }
};
exports.ChecklistService = ChecklistService;
exports.ChecklistService = ChecklistService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, audit_service_1.AuditService])
], ChecklistService);
//# sourceMappingURL=checklist.service.js.map