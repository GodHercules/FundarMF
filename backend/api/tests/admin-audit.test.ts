import { describe, expect, it, vi } from "vitest";
import { AdminService } from "../src/modules/admin/admin.service";

describe("AdminService process audit", () => {
  it("returns only recent allowlisted details scoped to the actor tenant", async () => {
    const process = {
      id: "p1",
      status: "EM_ANDAMENTO",
      updatedAt: new Date("2026-09-24T10:00:00.000Z"),
      steps: [{ id: "step-1" }],
      checklists: [],
      documents: [{ id: "doc-1", files: [{ id: "file-1" }] }],
      chats: [],
      alteracoesContratuais: [],
      contracts: [],
      reports: []
    };
    const prisma = {
      process: { findFirst: vi.fn().mockResolvedValue(process) },
      auditEvent: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "audit-1",
            action: "update_step",
            entity: "ProcessStep",
            actorRole: "OPERADOR",
            createdAt: new Date("2026-09-24T11:00:00.000Z"),
            metadata: { stepKey: "ETAPA_2", email: "secret@example.com", documentNumber: "123" }
          }
        ]),
        findFirst: vi.fn().mockResolvedValue({ createdAt: new Date("2026-09-24T11:00:00.000Z") })
      }
    };
    const service = new AdminService(prisma as any, { record: vi.fn() } as any);

    const result = await service.listProcessAudit("p1", { role: "MASTER", tenantKey: "tenant-a" });

    expect(prisma.process.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "p1", tenantKey: "tenant-a" } }));
    expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantKey: "tenant-a", createdAt: expect.any(Object) })
    }));
    expect(result.activityStatus).toBe("SEM_MOVIMENTACAO");
    expect(result.events[0].details).toEqual({ stepKey: "ETAPA_2" });
  });
});
