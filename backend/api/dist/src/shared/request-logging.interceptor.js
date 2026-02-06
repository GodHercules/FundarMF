"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestLoggingInterceptor = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const node_perf_hooks_1 = require("node:perf_hooks");
const request_context_1 = require("./request-context");
const logger_1 = require("./logger");
const coldStartWindowMs = (() => {
    const parsed = Number(process.env.COLD_START_WINDOW_MS ?? 60_000);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 60_000;
})();
let RequestLoggingInterceptor = class RequestLoggingInterceptor {
    intercept(context, next) {
        const req = context.switchToHttp().getRequest();
        const res = context.switchToHttp().getResponse();
        const ctx = (0, request_context_1.getRequestContext)();
        const handlerStart = node_perf_hooks_1.performance.now();
        return next.handle().pipe((0, rxjs_1.tap)({
            next: () => {
                const handlerMs = node_perf_hooks_1.performance.now() - handlerStart;
                if (ctx) {
                    ctx.perf.handlerMs = handlerMs;
                }
            },
            error: () => {
                const handlerMs = node_perf_hooks_1.performance.now() - handlerStart;
                if (ctx && typeof ctx.perf.handlerMs !== "number") {
                    ctx.perf.handlerMs = handlerMs;
                }
            }
        }), (0, rxjs_1.finalize)(() => {
            const ctxFinalize = (0, request_context_1.getRequestContext)();
            const totalMs = ctxFinalize ? node_perf_hooks_1.performance.now() - ctxFinalize.startHrTime : undefined;
            if (ctxFinalize && totalMs !== undefined) {
                ctxFinalize.perf.responseMs =
                    typeof ctxFinalize.perf.handlerMs === "number" ? totalMs - ctxFinalize.perf.handlerMs : undefined;
            }
            const uptimeMs = Math.round(process.uptime() * 1000);
            (0, logger_1.logEvent)("info", "http_request", {
                correlationId: ctxFinalize?.correlationId ?? req.correlationId,
                method: req.method,
                path: req.originalUrl ?? req.url,
                statusCode: res.statusCode,
                totalMs: totalMs ? Math.round(totalMs) : undefined,
                guardMs: ctxFinalize?.perf.authGuardMs ? Math.round(ctxFinalize.perf.authGuardMs) : undefined,
                rolesGuardMs: ctxFinalize?.perf.rolesGuardMs ? Math.round(ctxFinalize.perf.rolesGuardMs) : undefined,
                handlerMs: ctxFinalize?.perf.handlerMs ? Math.round(ctxFinalize.perf.handlerMs) : undefined,
                responseMs: ctxFinalize?.perf.responseMs ? Math.round(ctxFinalize.perf.responseMs) : undefined,
                prismaMs: ctxFinalize?.perf.prismaMs ? Math.round(ctxFinalize.perf.prismaMs) : undefined,
                prismaQueries: ctxFinalize?.perf.prismaQueries ?? undefined,
                hashMs: ctxFinalize?.perf.hashMs ? Math.round(ctxFinalize.perf.hashMs) : undefined,
                externalMs: ctxFinalize?.perf.externalMs ? Math.round(ctxFinalize.perf.externalMs) : undefined,
                coldStart: uptimeMs < coldStartWindowMs,
                uptimeMs
            });
        }));
    }
};
exports.RequestLoggingInterceptor = RequestLoggingInterceptor;
exports.RequestLoggingInterceptor = RequestLoggingInterceptor = __decorate([
    (0, common_1.Injectable)()
], RequestLoggingInterceptor);
//# sourceMappingURL=request-logging.interceptor.js.map