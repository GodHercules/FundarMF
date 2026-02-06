import { describe, expect, it, vi } from "vitest";
import { NotificationService } from "../src/modules/notification/notification.service";

describe("NotificationService", () => {
  it("enqueues email with rendered html", async () => {
    const queue = {
      enqueueEmail: vi.fn().mockResolvedValue("job-id"),
      enqueueWhatsApp: vi.fn()
    };
    const service = new NotificationService(queue as any, {} as any);

    await service.sendEmail("user@example.com", "Assunto", "Linha 1\nLinha 2");

    expect(queue.enqueueEmail).toHaveBeenCalledTimes(1);
    const payload = queue.enqueueEmail.mock.calls[0][0];
    expect(payload.to).toBe("user@example.com");
    expect(payload.subject).toBe("Assunto");
    expect(payload.text).toContain("Linha 1");
    expect(payload.html).toContain("<html");
  });

  it("enqueues whatsapp", async () => {
    const queue = {
      enqueueEmail: vi.fn(),
      enqueueWhatsApp: vi.fn().mockResolvedValue("job-id")
    };
    const service = new NotificationService(queue as any, {} as any);

    await service.sendWhatsApp("+5511999999999", "Teste");

    expect(queue.enqueueWhatsApp).toHaveBeenCalledTimes(1);
    const payload = queue.enqueueWhatsApp.mock.calls[0][0];
    expect(payload.to).toBe("+5511999999999");
    expect(payload.body).toBe("Teste");
  });
});
