import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

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

export type RequestWithContext = Request & {
  correlationId?: string;
  perf?: RequestPerf;
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
  const normalizedIncomingId = typeof incomingId === "string" ? incomingId.trim() : "";
  const correlationId =
    normalizedIncomingId.length > 0 && normalizedIncomingId.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(normalizedIncomingId)
      ? normalizedIncomingId
      : randomUUID();

  const perf: RequestPerf = {
    startTime: Date.now()
  };
  const ctx: RequestContext = {
    correlationId,
    perf,
    startHrTime: performance.now()
  };

  storage.run(ctx, () => {
    const request = req as RequestWithContext;
    request.correlationId = correlationId;
    request.perf = perf;
    res.setHeader("x-correlation-id", correlationId);
    next();
  });
};
