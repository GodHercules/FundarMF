import { describe, expect, it, vi } from "vitest";
import { AuthService } from "../src/modules/auth/auth.service";

describe("AuthService customer link", () => {
  it("deduplicates near-simultaneous link requests", async () => {
    process.env.LINK_REQUEST_DEDUP_SECONDS = "30";
    process.env.N8N_WEBHOOK_AUTH_ENABLED = "false";
    process.env.FRONTEND_URL = "http://localhost:3000";

    const prisma = {
      customerLinkToken: {
        findFirst: vi.fn().mockResolvedValue({
          id: "tok-1",
          createdAt: new Date()
        }),
        create: vi.fn()
      }
    };
    const sessionService = {} as any;
    const notificationService = {
      sendEmail: vi.fn(),
      sendWhatsApp: vi.fn(),
      sendWebhook: vi.fn()
    };
    const auditService = { record: vi.fn() };
    const service = new AuthService(prisma as any, sessionService, notificationService as any, auditService as any);

    const result = await service.requestCustomerLink("client@x.com", undefined, "Cliente", { email: "op@x.com", role: "OPERADOR" });
    expect(result).toEqual({ otpRequired: true, deduped: true });
    expect(prisma.customerLinkToken.create).not.toHaveBeenCalled();
    expect(notificationService.sendEmail).not.toHaveBeenCalled();
    expect(notificationService.sendWhatsApp).not.toHaveBeenCalled();
    expect(notificationService.sendWebhook).not.toHaveBeenCalled();
  });

  it("does not send webhook for auth events by default", async () => {
    process.env.LINK_REQUEST_DEDUP_SECONDS = "0";
    process.env.N8N_WEBHOOK_AUTH_ENABLED = "false";
    process.env.FRONTEND_URL = "http://localhost:3000";

    const prisma = {
      customerLinkToken: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "tok-2" })
      }
    };
    const sessionService = {} as any;
    const notificationService = {
      sendEmail: vi.fn().mockResolvedValue({ ok: true }),
      sendWhatsApp: vi.fn().mockResolvedValue({ ok: true }),
      sendWebhook: vi.fn().mockResolvedValue({ ok: true })
    };
    const auditService = { record: vi.fn() };
    const service = new AuthService(prisma as any, sessionService, notificationService as any, auditService as any);

    const result = await service.requestCustomerLink("client@x.com", undefined);
    expect(result).toEqual({ otpRequired: true });
    expect(notificationService.sendEmail).toHaveBeenCalledTimes(1);
    expect(notificationService.sendWebhook).toHaveBeenCalledTimes(0);
  });
});

