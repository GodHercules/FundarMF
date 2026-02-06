import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { performance } from "node:perf_hooks";
import { addPerfTime, getRequestContext } from "./request-context";
import { logEvent } from "./logger";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();

    this.$use(async (params, next) => {
      const start = performance.now();
      try {
        return await next(params);
      } finally {
        const duration = performance.now() - start;
        addPerfTime("prismaMs", duration);
        const ctx = getRequestContext();
        if (ctx) {
          ctx.perf.prismaQueries = (ctx.perf.prismaQueries ?? 0) + 1;
        }

        const threshold = Number(process.env.PRISMA_SLOW_QUERY_MS ?? 250);
        if (Number.isFinite(threshold) && duration >= threshold) {
          logEvent("warn", "prisma_slow_query", {
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
}
