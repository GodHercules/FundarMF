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
    process.env.N8N_WEBHOOK_AUTH_EVENTS_ENABLED = "false";
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

  it("sends the customer link and OTP to n8n when auth events are enabled", async () => {
    process.env.LINK_REQUEST_DEDUP_SECONDS = "0";
    process.env.N8N_WEBHOOK_AUTH_EVENTS_ENABLED = "true";
    process.env.FRONTEND_URL = "https://fundarmf.com.br";

    const prisma = {
      customerLinkToken: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "tok-3" })
      }
    };
    const notificationService = {
      sendEmail: vi.fn().mockResolvedValue({ ok: true }),
      sendWhatsApp: vi.fn().mockResolvedValue({ ok: true }),
      sendWebhook: vi.fn().mockResolvedValue({ ok: true })
    };
    const auditService = { record: vi.fn() };
    const service = new AuthService(
      prisma as any,
      {} as any,
      notificationService as any,
      auditService as any
    );

    const result = await service.requestCustomerLink(
      "cliente@x.com",
      undefined,
      "Cliente",
      { email: "op@x.com", role: "OPERADOR" }
    );

    expect(result).toEqual({ otpRequired: true });
    expect(notificationService.sendWebhook).toHaveBeenCalledTimes(1);
    const payload = notificationService.sendWebhook.mock.calls[0][0];
    expect(payload).toMatchObject({
      audience: "client",
      email: "cliente@x.com",
      reason: "link_created",
      requestedBy: { email: "op@x.com", role: "OPERADOR" },
      emails: { client: { target: "client", to: "cliente@x.com" } }
    });
    expect(payload.link).toContain("https://fundarmf.com.br/client/link?token=");
    expect(payload.otp).toMatch(/^\d{6}$/);
  });
});

