import { performance } from "node:perf_hooks";

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import type { Response } from "express";
import { finalize,Observable, tap } from "rxjs";

import { logEvent } from "./logger";
import { getRequestContext, type RequestWithContext } from "./request-context";

const coldStartWindowMs = (() => {
  const parsed = Number(process.env.COLD_START_WINDOW_MS ?? 60_000);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60_000;
})();

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<RequestWithContext>();
    const res = context.switchToHttp().getResponse<Response>();
    const ctx = getRequestContext();
    const handlerStart = performance.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const handlerMs = performance.now() - handlerStart;
          if (ctx) {
            ctx.perf.handlerMs = handlerMs;
          }
        },
        error: () => {
          const handlerMs = performance.now() - handlerStart;
          if (ctx && typeof ctx.perf.handlerMs !== "number") {
            ctx.perf.handlerMs = handlerMs;
          }
        }
      }),
      finalize(() => {
        const ctxFinalize = getRequestContext();
        const totalMs = ctxFinalize ? performance.now() - ctxFinalize.startHrTime : undefined;
        if (ctxFinalize && totalMs !== undefined) {
          ctxFinalize.perf.responseMs =
            typeof ctxFinalize.perf.handlerMs === "number" ? totalMs - ctxFinalize.perf.handlerMs : undefined;
        }
        const uptimeMs = Math.round(process.uptime() * 1000);
        logEvent("info", "http_request", {
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
      })
    );
  }
}
