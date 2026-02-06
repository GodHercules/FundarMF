import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export type RequestPerf = {
  startTime: number;
  authGuardMs?: number;
  rolesGuardMs?: number;
  handlerMs?: number;
  responseMs?: number;
  prismaMs?: number;
  prismaQueries?: number;
  hashMs?: number;
  externalMs?: number;
};

export type RequestContext = {
  correlationId: string;
  perf: RequestPerf;
  startHrTime: number;
};

const storage = new AsyncLocalStorage<RequestContext>();

export const getRequestContext = () => storage.getStore();

export const addPerfTime = (field: keyof RequestPerf, deltaMs: number) => {
  const ctx = storage.getStore();
  if (!ctx) return;
  const current = ctx.perf[field];
  if (typeof current === "number") {
    ctx.perf[field] = current + deltaMs;
  } else {
    ctx.perf[field] = deltaMs;
  }
};

export const requestContextMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const incomingId = req.headers["x-correlation-id"];
  const correlationId =
    typeof incomingId === "string" && incomingId.trim().length > 0 ? incomingId : randomUUID();

  const perf: RequestPerf = {
    startTime: Date.now()
  };
  const ctx: RequestContext = {
    correlationId,
    perf,
    startHrTime: performance.now()
  };

  storage.run(ctx, () => {
    (req as any).correlationId = correlationId;
    (req as any).perf = perf;
    res.setHeader("x-correlation-id", correlationId);
    next();
  });
};
