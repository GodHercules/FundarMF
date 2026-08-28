import { describe, expect, it, vi } from "vitest";
import { NotificationService } from "../src/modules/notification/notification.service";

describe("NotificationService", () => {
  const prisma = { user: { findUnique: vi.fn().mockResolvedValue(null) } };

  it("sends email through n8n webhook with rendered html", async () => {
    const service = new NotificationService(prisma as any);
    const sendWebhook = vi.spyOn(service, "sendWebhook").mockResolvedValue(undefined);

    await service.sendEmail("user@example.com", "Assunto", "Linha 1\nLinha 2");

    expect(sendWebhook).toHaveBeenCalledTimes(1);
    const payload = sendWebhook.mock.calls[0][0];
    expect(payload.to).toBe("user@example.com");
    expect(payload.subject).toBe("Assunto");
    expect(payload.emails.client.text).toContain("Linha 1");
    expect(payload.emails.client.html).toContain("<html");
    expect(payload.emails.client.html).toContain("MF Contabilidade");
    expect(payload.emails.client.html).not.toContain("{{logoUrl}}");
    expect(payload.emails.client.html).not.toContain("{{fundarLogoUrl}}");
  });

  it("does not use a direct email provider", async () => {
    const service = new NotificationService(prisma as any);
    const sendWebhook = vi.spyOn(service, "sendWebhook").mockResolvedValue(undefined);

    await service.sendEmail("user@example.com", "Assunto", "Mensagem");

    expect(sendWebhook).toHaveBeenCalledTimes(1);
  });

  it("sends whatsapp through n8n webhook", async () => {
    const service = new NotificationService(prisma as any);
    const sendWebhook = vi.spyOn(service, "sendWebhook").mockResolvedValue(undefined);

    await service.sendWhatsApp("+5511999999999", "Teste");

    expect(sendWebhook).toHaveBeenCalledTimes(1);
    const payload = sendWebhook.mock.calls[0][0];
    expect(payload.to).toBe("+5511999999999");
    expect(payload.body).toBe("Teste");
  });
});
