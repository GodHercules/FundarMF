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
exports.SlaService = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../shared/prisma.service");
let SlaService = class SlaService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async startSla(processId, stepKey, side) {
        const config = await this.prisma.slaConfigStep.findUnique({
            where: { stepKey_side: { stepKey, side } }
        });
        if (!config) {
            return;
        }
        const startedAt = new Date();
        const dueAt = (0, dayjs_1.default)(startedAt).add(config.durationHours, "hour").toDate();
        await this.prisma.slaEvent.upsert({
            where: { processId_stepKey_side: { processId, stepKey, side } },
            update: {
                startedAt,
                dueAt,
                status: "ON_TRACK"
            },
            create: {
                processId,
                stepKey,
                side,
                startedAt,
                dueAt,
                status: "ON_TRACK"
            }
        });
    }
    async stopSla(processId, stepKey, side) {
        await this.prisma.slaEvent.updateMany({
            where: { processId, stepKey, side },
            data: { status: "STOPPED" }
        });
    }
    async stopAll(processId) {
        await this.prisma.slaEvent.updateMany({
            where: { processId },
            data: { status: "STOPPED" }
        });
    }
    async listConfig() {
        return this.prisma.slaConfigStep.findMany({ orderBy: [{ stepKey: "asc" }, { side: "asc" }] });
    }
    async updateConfig(stepKey, side, durationHours, alertPercent) {
        return this.prisma.slaConfigStep.upsert({
            where: { stepKey_side: { stepKey, side } },
            update: { durationHours, alertPercent },
            create: { stepKey, side, durationHours, alertPercent }
        });
    }
};
exports.SlaService = SlaService;
exports.SlaService = SlaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SlaService);
//# sourceMappingURL=sla.service.js.map