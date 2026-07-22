import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { IdempotencyScope, Prisma } from "@prisma/client";
import crypto from "crypto";

import { PrismaService } from "./prisma.service";

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  private hash(value: unknown) {
    return crypto.createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");
  }

  private serializeResponse<T>(value: T): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  async execute<T>(
    scope: IdempotencyScope,
    key: string | undefined,
    payloadForHash: unknown,
    handler: () => Promise<T>,
    ttlSeconds = 3600
  ): Promise<{ data: T; replayed: boolean }> {
    if (!key || key.trim().length === 0) {
      return { data: await handler(), replayed: false };
    }

    const normalizedKey = key.trim();
    const requestHash = this.hash(payloadForHash);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    let recordId: string | null = null;
    try {
      const created = await this.prisma.idempotencyKey.create({
        data: {
          scope,
          key: normalizedKey,
          requestHash,
          expiresAt
        }
      });
      recordId = created.id;
    } catch (error: unknown) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;

      const existing = await this.prisma.idempotencyKey.findUnique({
        where: { scope_key: { scope, key: normalizedKey } }
      });
      if (!existing) {
        throw new ConflictException("Conflito de idempotência. Tente novamente.");
      }
      if (existing.expiresAt <= now) {
        await this.prisma.idempotencyKey.delete({
          where: { scope_key: { scope, key: normalizedKey } }
        });
        return this.execute(scope, normalizedKey, payloadForHash, handler, ttlSeconds);
      }
      if (existing.requestHash !== requestHash) {
        throw new BadRequestException("Idempotency-Key reutilizada com payload diferente.");
      }
      if (existing.response !== null && existing.response !== undefined) {
        return { data: existing.response as T, replayed: true };
      }
      throw new ConflictException("Uma requisição com esta Idempotency-Key já está em processamento.");
    }

    try {
      const data = await handler();
      await this.prisma.idempotencyKey.update({
        where: { id: recordId! },
        data: {
          response: this.serializeResponse(data),
          expiresAt
        }
      });
      return { data, replayed: false };
    } catch (error) {
      if (recordId) {
        await this.prisma.idempotencyKey.deleteMany({ where: { id: recordId } });
      }
      throw error;
    }
  }
}
