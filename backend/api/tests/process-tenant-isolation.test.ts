import { describe, expect, it, vi } from "vitest";
import { ProcessStatus, StepKey } from "@prisma/client";

import { ProcessService } from "../src/modules/process/process.service";

describe("ProcessService tenant isolation", () => {
  it("scopes duplicate and stale-process checks to the actor tenant", async () => {
    const process = {
      id: "process-1",
      status: ProcessStatus.AGUARDANDO_CLIENTE,
      currentStep: StepKey.ETAPA_2,
      ownerId: "operator-1",
      clientEmail: "client@example.com",
      clientPhone: "+5511999999999"
    };
    const processFindMany = vi.fn().mockResolvedValue([]);
    const processFindFirst = vi.fn().mockResolvedValue(null);
    const prisma = {
      process: {
        findMany: processFindMany,
        findFirst: processFindFirst,
        create: vi.fn().mockResolvedValue(process)
      },
      processStep: { findUnique: vi.fn().mockResolvedValue(null) },
      slaConfigStep: { findUnique: vi.fn().mockResolvedValue(null) },
      slaEvent: { upsert: vi.fn() },
      user: { findUnique: vi.fn().mockResolvedValue(null) }
    };
    const service = new ProcessService(
      prisma as never,
      { startSla: vi.fn() } as never,
      { record: vi.fn() } as never,
      { createInApp: vi.fn(), sendWebhook: vi.fn() } as never,
      { requestCustomerLink: vi.fn() } as never,
      { execute: vi.fn(async (_scope: unknown, _key: unknown, _input: unknown, callback: () => Promise<unknown>) => ({ data: await callback() })) } as never
    );

    await service.createProcessByOperator(
      { role: "MASTER", userId: "master-1", tenantKey: "tenant-b" },
      { nome: "Empresa Beta", email: "client@example.com", telefone: "+5511999999999", sendEmail: false, sendWhatsapp: false }
    );

    expect(processFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantKey: "tenant-b" }) }));
    expect(processFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantKey: "tenant-b" }) }));
  });
});
