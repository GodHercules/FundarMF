import { describe, expect, it, vi } from "vitest";
import { ProcessStatus } from "@prisma/client";
import { ProcessService } from "../src/modules/process/process.service";

describe("ProcessService submitStep email", () => {
  it("sends email to client on first submit and is idempotent on retry", async () => {
    const prisma = {
      process: {
        findUnique: vi.fn(async () => ({
          id: "p1",
          status: ProcessStatus.EM_ANDAMENTO,
          currentStep: "ETAPA_2",
          clientEmail: "cliente@exemplo.com",
          clientPhone: "+5511999999999",
          ownerId: "op-1",
          steps: [],
          checklists: [],
          slaEvents: []
        })),
        update: vi.fn(async () => ({}))
      },
      processStep: {
        findUnique: vi.fn(async () => ({
          id: "s1",
          locked: false,
          status: ProcessStatus.EM_ANDAMENTO,
          data: {}
        })),
        update: vi.fn(async () => ({}))
      },
      user: {
        findUnique: vi.fn(async () => ({
          id: "op-1",
          email: "op@exemplo.com",
          whatsapp: "+5511999999999"
        }))
      }
    };

    const slaService = { stopSla: vi.fn(async () => undefined), startSla: vi.fn(async () => undefined) };
    const auditService = { record: vi.fn(async () => undefined) };
    const notificationService = {
      createInApp: vi.fn(async () => undefined),
      sendEmail: vi.fn(async () => undefined),
      sendWhatsApp: vi.fn(async () => undefined),
      sendWebhook: vi.fn(async () => undefined)
    };
    const authService = {} as any;

    const service = new ProcessService(prisma as any, slaService as any, auditService as any, notificationService as any, authService);

    await expect(service.submitStep("p1", { role: "CLIENTE", email: "cliente@exemplo.com" }, "ETAPA_2")).resolves.toEqual({
      ok: true
    });

    expect(notificationService.sendEmail).toHaveBeenCalledWith(
      "cliente@exemplo.com",
      expect.stringMatching(/processo iniciado/i),
      expect.stringContaining("Processo: p1")
    );

    // Retry: already submitted should not send again.
    prisma.processStep.findUnique = vi.fn(async () => ({
      id: "s1",
      locked: true,
      status: ProcessStatus.AGUARDANDO_OPERADOR,
      data: {}
    })) as any;

    const previousCalls = (notificationService.sendEmail as any).mock.calls.length;
    await expect(service.submitStep("p1", { role: "CLIENTE", email: "cliente@exemplo.com" }, "ETAPA_2")).resolves.toEqual({
      ok: true,
      alreadySubmitted: true
    });
    expect((notificationService.sendEmail as any).mock.calls.length).toBe(previousCalls);
  });
});

