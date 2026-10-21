import { ProcessStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { ProcessService } from "../src/modules/process/process.service";

function createService(processes: unknown[], auditEvents: unknown[]) {
  const prisma = {
    process: { findMany: vi.fn().mockResolvedValue(processes) },
    auditEvent: { findMany: vi.fn().mockResolvedValue(auditEvents) }
  };
  const service = new ProcessService(
    prisma as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any
  );
  return { service, prisma };
}

describe("ProcessService dashboard snapshot", () => {
  it("keeps attention scoped to the assigned operator and merges simultaneous reasons", async () => {
    const now = new Date("2026-10-21T16:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const { service, prisma } = createService([
      {
        id: "pending",
        clientName: "DemiGod",
        status: ProcessStatus.AGUARDANDO_OPERADOR,
        currentStep: "ETAPA_2",
        kanbanStage: "VIABILIDADE",
        createdAt: new Date("2026-10-21T12:00:00.000Z"),
        steps: [{ stepKey: "ETAPA_2", updatedAt: new Date("2026-10-21T15:00:00.000Z") }]
      },
      {
        id: "stale",
        clientName: "Tech SemiDeus",
        status: ProcessStatus.EM_ANDAMENTO,
        currentStep: "ETAPA_3",
        kanbanStage: "VIABILIDADE",
        createdAt: new Date("2026-10-16T12:00:00.000Z"),
        steps: []
      },
      {
        id: "terminal",
        clientName: "Finalizada",
        status: ProcessStatus.CONCLUIDO,
        currentStep: "ETAPA_3",
        kanbanStage: "FINALIZADO",
        createdAt: new Date("2026-10-21T12:00:00.000Z"),
        steps: []
      }
    ], [
      { entityId: "stale", action: "kanban_stage_updated", createdAt: new Date("2026-10-17T12:00:00.000Z") }
    ]);

    const snapshot = await service.getDashboard({ role: "OPERADOR", userId: "operator-1", tenantKey: "tenant-a" } as any);

    expect(prisma.process.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        ownerId: "operator-1",
        tenantKey: "tenant-a",
        status: { notIn: [ProcessStatus.CONCLUIDO, ProcessStatus.CANCELADO] }
      })
    }));
    expect(snapshot.attention.map((item) => [item.id, item.attention.reason])).toEqual([
      ["pending", "form_pending"],
      ["stale", "inactive"]
    ]);
    expect(snapshot.recent).toHaveLength(3);
    vi.useRealTimers();
  });

  it("uses the latest relevant audit event before falling back to creation", async () => {
    const { service } = createService([{
      id: "p1",
      clientName: "Empresa",
      status: ProcessStatus.EM_ANDAMENTO,
      currentStep: "ETAPA_3",
      kanbanStage: "VIABILIDADE",
      createdAt: new Date("2026-10-21T10:00:00.000Z"),
      steps: []
    }], [{
      entityId: "p1",
      action: "update_step",
      createdAt: new Date("2026-10-21T15:00:00.000Z")
    }]);

    const snapshot = await service.getDashboard({ role: "MASTER", userId: "master-1", tenantKey: "default" } as any);

    expect(snapshot.recent[0].lastActivityAt).toEqual(new Date("2026-10-21T15:00:00.000Z"));
    expect(snapshot.recent[0].lastActivityAction).toBe("atualização de dados");
  });
});
