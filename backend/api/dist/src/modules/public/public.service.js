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
exports.PublicService = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../shared/prisma.service");
let municipalitiesCache = null;
let PublicService = class PublicService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getMetrics() {
        const [slaConfigs, slaAlerts, auditedDocuments, completedProcesses] = await Promise.all([
            this.prisma.slaConfigStep.count(),
            this.prisma.slaEvent.count({ where: { status: { in: [client_1.SlaStatus.AT_RISK, client_1.SlaStatus.OVERDUE] } } }),
            this.prisma.documentItem.count({
                where: { status: { in: [client_1.DocumentItemStatus.APROVADO, client_1.DocumentItemStatus.REPROVADO] } }
            }),
            this.prisma.process.findMany({
                where: { status: client_1.ProcessStatus.CONCLUIDO },
                select: { createdAt: true, updatedAt: true }
            })
        ]);
        let avgCompletionDays = 0;
        if (completedProcesses.length > 0) {
            const totalDays = completedProcesses.reduce((sum, process) => {
                return sum + (0, dayjs_1.default)(process.updatedAt).diff(process.createdAt, "day", true);
            }, 0);
            avgCompletionDays = totalDays / completedProcesses.length;
        }
        return {
            criticalSteps: slaConfigs,
            avgCompletionDays,
            activeAlerts: slaAlerts,
            auditedDocuments
        };
    }
    async getMunicipalities() {
        const now = Date.now();
        if (municipalitiesCache && municipalitiesCache.expiresAt > now) {
            return { items: municipalitiesCache.value, cached: true };
        }
        try {
            const response = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios", {
                headers: { Accept: "application/json" }
            });
            if (!response.ok) {
                throw new Error("IBGE unavailable");
            }
            const data = (await response.json());
            const list = data
                .map((municipio) => {
                const uf = municipio?.microrregiao?.mesorregiao?.UF?.sigla ?? municipio?.UF?.sigla ?? "";
                return uf ? `${municipio.nome} - ${uf}` : municipio.nome;
            })
                .filter(Boolean)
                .sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
            municipalitiesCache = {
                value: list,
                expiresAt: now + 24 * 60 * 60 * 1000
            };
            return { items: list, cached: false };
        }
        catch {
            return { items: municipalitiesCache?.value ?? [], cached: true };
        }
    }
};
exports.PublicService = PublicService;
exports.PublicService = PublicService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PublicService);
//# sourceMappingURL=public.service.js.map