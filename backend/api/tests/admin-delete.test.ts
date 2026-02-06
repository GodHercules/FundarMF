import { ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AdminService } from "../src/modules/admin/admin.service";

describe("AdminService hard delete", () => {
  it("blocks operator deletion when there are in-progress processes", async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: "u1", role: "OPERATOR" }) },
      process: { count: vi.fn().mockResolvedValue(2) },
      $transaction: vi.fn()
    };
    const auditService = { record: vi.fn() };
    const service = new AdminService(prisma as any, auditService as any);

    await expect(service.deleteOperator("u1", "master")).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("hard deletes process and records audit", async () => {
    const tx = {
      documentItem: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
      documentFile: { deleteMany: vi.fn() },
      processStep: { deleteMany: vi.fn() },
      checklist: { deleteMany: vi.fn() },
      slaEvent: { deleteMany: vi.fn() },
      report: { deleteMany: vi.fn() },
      userNotification: { deleteMany: vi.fn() },
      processOwnerHistory: { deleteMany: vi.fn() },
      chatThread: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
      chatMessage: { deleteMany: vi.fn() },
      process: { delete: vi.fn() }
    };
    const prisma = {
      process: { findUnique: vi.fn().mockResolvedValue({ id: "p1" }) },
      $transaction: vi.fn((fn: any) => fn(tx))
    };
    const auditService = { record: vi.fn() };
    const service = new AdminService(prisma as any, auditService as any);

    const result = await service.deleteProcess("p1", "master", "teste");
    expect(result).toEqual({ ok: true });
    expect(auditService.record).toHaveBeenCalledWith(
      { role: "MASTER", userId: "master" },
      "process_deleted",
      "Process",
      "p1",
      expect.objectContaining({ reason: "teste" })
    );
  });
});
