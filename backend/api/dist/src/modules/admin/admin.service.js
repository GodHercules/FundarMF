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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_service_1 = require("../../shared/prisma.service");
const audit_service_1 = require("../audit/audit.service");
let AdminService = class AdminService {
    prisma;
    auditService;
    constructor(prisma, auditService) {
        this.prisma = prisma;
        this.auditService = auditService;
    }
    ensureStrongPassword(password) {
        const hasMin = password.length >= 6;
        const hasUpper = /[A-Z]/.test(password);
        const hasLower = /[a-z]/.test(password);
        const hasNumber = /\d/.test(password);
        const hasSymbol = /[^A-Za-z0-9]/.test(password);
        const score = [hasUpper, hasLower, hasNumber, hasSymbol].filter(Boolean).length;
        if (!hasMin || score < 2) {
            throw new common_1.BadRequestException("Senha fraca. Use 6+ caracteres e combine letras, nmeros e smbolos.");
        }
    }
    async listUsers(limit, offset) {
        const take = Number.isFinite(limit) && limit && limit > 0 ? Math.min(limit, 200) : 100;
        const skip = Number.isFinite(offset) && offset && offset > 0 ? offset : 0;
        return this.prisma.user.findMany({ orderBy: { createdAt: "desc" }, take, skip });
    }
    async createOperator(email, name, password, whatsapp) {
        const exists = await this.prisma.user.findUnique({ where: { email } });
        if (exists) {
            throw new common_1.BadRequestException("E-mail j cadastrado.");
        }
        this.ensureStrongPassword(password);
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        return this.prisma.user.create({
            data: {
                email,
                name,
                passwordHash,
                whatsapp,
                role: "OPERATOR"
            }
        });
    }
    async assignOwner(processId, ownerId, actorId) {
        await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id FROM "Process" WHERE id = ${processId} FOR UPDATE`;
            const process = await tx.process.findUnique({ where: { id: processId } });
            if (!process) {
                throw new common_1.NotFoundException("Processo não encontrado.");
            }
            await tx.process.update({
                where: { id: processId },
                data: { ownerId }
            });
            await tx.processOwnerHistory.create({
                data: { processId, ownerId, assignedBy: actorId }
            });
        });
        await this.auditService.record(actorId ? { role: "MASTER", userId: actorId } : { role: "SYSTEM" }, "assign_owner", "Process", processId, { ownerId });
        return { ok: true };
    }
    async listUnassigned() {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        return this.prisma.process.findMany({
            where: { ownerId: null, createdAt: { lt: tenMinutesAgo } },
            orderBy: { createdAt: "asc" }
        });
    }
    async listAudit() {
        return this.prisma.auditEvent.findMany({
            orderBy: { createdAt: "desc" },
            take: 200
        });
    }
    async getReport(processId) {
        const report = await this.prisma.report.findFirst({
            where: { processId },
            orderBy: { createdAt: "desc" }
        });
        if (!report) {
            throw new common_1.NotFoundException("Relatório não encontrado.");
        }
        return report;
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, audit_service_1.AuditService])
], AdminService);
//# sourceMappingURL=admin.service.js.map