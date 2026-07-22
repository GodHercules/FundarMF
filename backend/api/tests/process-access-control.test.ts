import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { ProcessStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { AuditService } from "../src/modules/audit/audit.service";
import { AuthService } from "../src/modules/auth/auth.service";
import { NotificationService } from "../src/modules/notification/notification.service";
import { ProcessService } from "../src/modules/process/process.service";
import { SlaService } from "../src/modules/sla/sla.service";
import { IdempotencyService } from "../src/shared/idempotency.service";
import { PrismaService } from "../src/shared/prisma.service";

function createService(process: unknown) {
  const prisma = {
    process: {
      findUnique: vi.fn().mockResolvedValue(process),
      findMany: vi.fn().mockResolvedValue([])
    },
    alteracaoContratual: {
      findMany: vi.fn().mockResolvedValue([])
    }
  };
  const service = new ProcessService(
    prisma as unknown as PrismaService,
    {} as unknown as SlaService,
    { record: vi.fn() } as unknown as AuditService,
    {} as unknown as NotificationService,
    {} as unknown as AuthService,
    {} as unknown as IdempotencyService
  );
  return { service, prisma };
}

const process = {
  id: "process-1",
  ownerId: "operator-1",
  clientEmail: "client@example.com",
  clientPhone: "+5571999999999",
  status: ProcessStatus.EM_ANDAMENTO,
  steps: [],
  checklists: [],
  slaEvents: []
};

describe("ProcessService access isolation", () => {
  it("allows the assigned operator, but denies another operator", async () => {
    const { service } = createService(process);

    await expect(
      service.getProcess("process-1", { role: "OPERADOR", userId: "operator-1" })
    ).resolves.toEqual(process);

    await expect(
      service.getProcess("process-1", { role: "OPERADOR", userId: "operator-2" })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows only the client identified by email or phone", async () => {
    const { service } = createService(process);

    await expect(
      service.getProcess("process-1", { role: "CLIENTE", email: "client@example.com" })
    ).resolves.toEqual(process);
    await expect(
      service.getProcess("process-1", { role: "CLIENTE", email: "other@example.com" })
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.getProcess("process-1", { role: "CLIENTE", whatsapp: "+55 (71) 99999-9999" })
    ).resolves.toEqual(process);
  });

  it("allows master to inspect a process regardless of ownership", async () => {
    const { service } = createService(process);

    await expect(
      service.getProcess("process-1", { role: "MASTER", userId: "master-1" })
    ).resolves.toEqual(process);
  });

  it("does not disclose whether a foreign process exists to an unknown client", async () => {
    const { service } = createService(process);

    await expect(
      service.getProcess("process-1", { role: "CLIENTE", email: "attacker@example.com" })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("filters the global alteration list by operator ownership", async () => {
    const { service, prisma } = createService(null);
    const operator = { role: "OPERADOR" as const, userId: "operator-1" };

    await service.listAllAlteracaoContratual(operator);

    expect(prisma.alteracaoContratual.findMany).toHaveBeenCalledWith({
      where: { process: { ownerId: "operator-1" } },
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: { process: { select: { id: true, clientName: true, clientEmail: true, ownerId: true } } }
    });
  });

  it("rejects global alteration listing for clients and does not query the database", async () => {
    const { service } = createService(null);

    await expect(
      service.listAllAlteracaoContratual({ role: "CLIENTE", email: "client@example.com" })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("raises not found for a missing process", async () => {
    const { service } = createService(null);

    await expect(service.getProcess("missing", { role: "MASTER" })).rejects.toBeInstanceOf(NotFoundException);
  });
});
