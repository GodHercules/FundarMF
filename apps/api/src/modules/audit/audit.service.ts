import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../shared/prisma.service";
import { Actor } from "../../common/auth/types";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    actor: Actor | undefined,
    action: string,
    entity: string,
    entityId?: string,
    metadata: Prisma.InputJsonValue = {},
    context?: { ip?: string; userAgent?: string }
  ) {
    await this.prisma.auditEvent.create({
      data: {
        actorRole: actor?.role ?? "SYSTEM",
        actorId: actor?.userId,
        actorEmail: actor?.email,
        action,
        entity,
        entityId,
        metadata,
        ip: context?.ip,
        userAgent: context?.userAgent
      }
    });
  }
}
