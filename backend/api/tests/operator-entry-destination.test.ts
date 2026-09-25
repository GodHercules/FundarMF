import { ForbiddenException } from "@nestjs/common";
import { ProcessStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { ProcessService } from "../src/modules/process/process.service";

describe("ProcessService operator entry destination", () => {
  it("returns only a boolean based on active or completed owned processes", async () => {
    const prisma = {
      process: { count: vi.fn().mockResolvedValue(1) }
    };
    const service = new ProcessService(prisma as any, {} as any, {} as any, {} as any, {} as any, {} as any);

    await expect(service.getOperatorEntryDestination({ role: "OPERADOR", userId: "operator-1", tenantKey: "tenant-a" }))
      .resolves.toEqual({ hasProcesses: true });
    expect(prisma.process.count).toHaveBeenCalledWith({
      where: { ownerId: "operator-1", tenantKey: "tenant-a", status: { not: ProcessStatus.CANCELADO } }
    });
  });

  it("does not expose the destination check to non-operators", async () => {
    const prisma = { process: { count: vi.fn() } };
    const service = new ProcessService(prisma as any, {} as any, {} as any, {} as any, {} as any, {} as any);

    await expect(service.getOperatorEntryDestination({ role: "MASTER" })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.process.count).not.toHaveBeenCalled();
  });
});
