import { describe, expect, it, vi } from "vitest";
import { NotificationDispatcher } from "../src/notify/dispatcher";

const makeEmailJob = (overrides: Partial<any> = {}) =>
  ({
    id: "job-1",
    retryCount: 0,
    data: {
      to: "user@example.com",
      subject: "Assunto",
      text: "Texto",
      html: "<html></html>",
      correlationId: "cid-1",
      ...overrides
    }
  } as any);

const makeWhatsAppJob = (overrides: Partial<any> = {}) =>
  ({
    id: "job-2",
    retryCount: 0,
    data: {
      to: "+5511999999999",
      body: "Mensagem",
      correlationId: "cid-2",
      ...overrides
    }
  } as any);

describe("NotificationDispatcher", () => {
  it("uses mock mode without real send", async () => {
    process.env.NOTIFY_MODE = "mock";
    process.env.NOTIFY_EMAIL_ENABLED = "true";
    process.env.NOTIFY_WHATSAPP_ENABLED = "true";

    const prisma = {
      notification: {
        create: vi.fn().mockResolvedValue({})
      }
    } as any;

    const dispatcher = new NotificationDispatcher(prisma);
    await dispatcher.handleEmail(makeEmailJob());
    await dispatcher.handleWhatsApp(makeWhatsAppJob());

    expect(prisma.notification.create).toHaveBeenCalled();
    const calls = prisma.notification.create.mock.calls.map((call: any) => call[0].data.status);
    expect(calls).toContain("MOCK");
  });

  it("records error and rethrows in real mode when provider misconfigured", async () => {
    process.env.NOTIFY_MODE = "real";
    process.env.NOTIFY_EMAIL_ENABLED = "true";
    process.env.EMAIL_PROVIDER = "smtp";
    delete process.env.SMTP_HOST;

    const prisma = {
      notification: {
        create: vi.fn().mockResolvedValue({})
      }
    } as any;

    const dispatcher = new NotificationDispatcher(prisma);

    await expect(dispatcher.handleEmail(makeEmailJob())).rejects.toBeTruthy();
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ERROR" }) })
    );
  });

  it("uses terminal mode without real send", async () => {
    process.env.NOTIFY_MODE = "terminal";
    process.env.NOTIFY_EMAIL_ENABLED = "true";

    const prisma = {
      notification: {
        create: vi.fn().mockResolvedValue({})
      }
    } as any;

    const dispatcher = new NotificationDispatcher(prisma);
    await dispatcher.handleEmail(makeEmailJob());

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "TERMINAL" }) })
    );
  });
});
