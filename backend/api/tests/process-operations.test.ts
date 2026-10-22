import { ProcessStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { ProcessService } from "../src/modules/process/process.service";

describe("ProcessService operator operations list", () => {
  it("returns operational rows scoped to the actor and excludes terminal processes", async () => {
    const process = {
      id: "process-1",
      clientName: "Empresa Horizonte",
      clientEmail: "contato@horizonte.test",
      companyKey: "empresa horizonte",
      status: ProcessStatus.AGUARDANDO_OPERADOR,
      currentStep: "ETAPA_2",
      kanbanStage: "VIABILIDADE",
      operatorStatusNote: null,
      createdAt: new Date("2026-10-21T10:00:00.000Z"),
      updatedAt: new Date("2026-10-21T12:00:00.000Z"),
      steps: [{ stepKey: "ETAPA_2", data: {}, locked: false, status: ProcessStatus.AGUARDANDO_OPERADOR, updatedAt: new Date("2026-10-21T12:00:00.000Z") }],
      documents: []
    };
    const prisma = {
      process: {
        findMany: vi.fn().mockResolvedValue([process]),
        count: vi.fn().mockResolvedValue(1)
      }
    };
    const service = new ProcessService(prisma as any, {} as any, {} as any, {} as any, {} as any, {} as any);

    const result = await service.listOperatorProcesses({ role: "OPERADOR", userId: "operator-1", tenantKey: "tenant-a" } as any, {
      search: "horizonte",
      take: 10
    });

    expect(prisma.process.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantKey: "tenant-a",
        ownerId: "operator-1",
        status: { notIn: [ProcessStatus.CONCLUIDO, ProcessStatus.CANCELADO] },
        OR: expect.any(Array)
      })
    }));
    expect(result).toMatchObject({ total: 1, hasMore: false });
    expect(result.items[0]).toMatchObject({
      id: "process-1",
      clientName: "Empresa Horizonte",
      fillStatus: "Aguardando conferência",
      situation: "Aguardando operador",
      nextAction: "Conferir dados enviados pelo cliente"
    });
  });
});
