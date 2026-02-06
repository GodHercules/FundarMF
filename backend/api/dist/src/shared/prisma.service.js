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
exports.PrismaService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const node_perf_hooks_1 = require("node:perf_hooks");
const request_context_1 = require("./request-context");
const logger_1 = require("./logger");
let PrismaService = class PrismaService extends client_1.PrismaClient {
    constructor() {
        super();
        this.$use(async (params, next) => {
            const start = node_perf_hooks_1.performance.now();
            try {
                return await next(params);
            }
            finally {
                const duration = node_perf_hooks_1.performance.now() - start;
                (0, request_context_1.addPerfTime)("prismaMs", duration);
                const ctx = (0, request_context_1.getRequestContext)();
                if (ctx) {
                    ctx.perf.prismaQueries = (ctx.perf.prismaQueries ?? 0) + 1;
                }
                const threshold = Number(process.env.PRISMA_SLOW_QUERY_MS ?? 250);
                if (Number.isFinite(threshold) && duration >= threshold) {
                    (0, logger_1.logEvent)("warn", "prisma_slow_query", {
                        correlationId: ctx?.correlationId,
                        model: params.model,
                        action: params.action,
                        durationMs: Math.round(duration)
                    });
                }
            }
        });
    }
    async onModuleInit() {
        await this.$connect();
    }
    async onModuleDestroy() {
        await this.$disconnect();
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], PrismaService);
//# sourceMappingURL=prisma.service.js.map