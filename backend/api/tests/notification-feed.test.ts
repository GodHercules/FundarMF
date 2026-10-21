import { describe, expect, it, vi } from "vitest";
import { NotificationService } from "../src/modules/notification/notification.service";

describe("NotificationService dashboard feed", () => {
  it("returns only non-dismissed notifications from the strict 72-hour window", async () => {
    const prisma = { userNotification: { findMany: vi.fn().mockResolvedValue([]) } };
    const service = new NotificationService(prisma as any);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-21T16:00:00.000Z"));

    await service.listInApp("operator-1", 5, 0);

    expect(prisma.userNotification.findMany).toHaveBeenCalledWith({
      where: {
        userId: "operator-1",
        dismissedAt: null,
        createdAt: { gt: new Date("2026-10-18T16:00:00.000Z") }
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      skip: 0
    });
    vi.useRealTimers();
  });

  it("persists dismissal without deleting the audit/history record", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const service = new NotificationService({ userNotification: { updateMany } } as any);

    await service.dismiss("operator-1", "notification-1");

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "notification-1", userId: "operator-1" },
      data: { dismissedAt: expect.any(Date) }
    });
  });
});
