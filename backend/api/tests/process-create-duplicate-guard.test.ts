import { describe, expect, it, vi } from "vitest";
import { ProcessStatus, StepKey } from "@prisma/client";
import { ProcessService } from "../src/modules/process/process.service";

describe("ProcessService createProcessByOperator duplicate guard", () => {
  const baseDeps = () => {
    const prisma = {
      process: {
        findMany: vi.fn(async (args: any) => {
          if (args?.where?.currentStep === StepKey.ETAPA_2) return [];
          return [];
        }),
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => ({ id: "p1", ownerId: null })),
        findUnique: vi.fn(async () => ({
          id: "p1",
          clientName: "Empresa",
          clientEmail: "cliente@exemplo.com",
          clientPhone: "+5511999999999",
          status: ProcessStatus.AGUARDANDO_CLIENTE,
          currentStep: StepKey.ETAPA_2,
          ownerId: null
        }))
      },
      processStep: {
        findUnique: vi.fn(async () => null)
      },
      user: {
        findUnique: vi.fn(async () => null)
      },
      documentItem: {
        findMany: vi.fn(async () => [])
      },
      slaEvent: {
        updateMany: vi.fn(async () => ({ count: 0 })),
        upsert: vi.fn(async () => ({}))
      },
      slaConfigStep: {
        findUnique: vi.fn(async () => null)
      }
    };

    const slaService = {
      startSla: vi.fn(async () => undefined),
      stopSla: vi.fn(async () => undefined)
    };

    const auditService = {
      record: vi.fn(async () => undefined)
    };

    const notificationService = {
      createInApp: vi.fn(async () => undefined),
      sendEmail: vi.fn(async () => undefined),
      sendWhatsApp: vi.fn(async () => undefined),
      sendWebhook: vi.fn(async () => undefined),
      sendEmailDraft: vi.fn(async () => undefined)
    };

    const authService = {
      requestCustomerLink: vi.fn(async () => undefined)
    };

    const idempotencyService = {
      execute: vi.fn(async (_scope: any, _key: any, _request: any, work: () => Promise<any>) => ({ data: await work() }))
    };

    return { prisma, slaService, auditService, notificationService, authService, idempotencyService };
  };

  it("permite mesmo e-mail com empresas diferentes", async () => {
    const deps = baseDeps();
    deps.prisma.process.findMany = vi.fn(async (args: any) => {
      if (args?.where?.currentStep === StepKey.ETAPA_2) return [];
      return [];
    }) as any;
    deps.prisma.process.findFirst = vi.fn(async () => null) as any;

    const service = new ProcessService(
      deps.prisma as any,
      deps.slaService as any,
      deps.auditService as any,
      deps.notificationService as any,
      deps.authService as any,
      deps.idempotencyService as any
    );

    await expect(
      service.createProcessByOperator(
        { role: "MASTER", email: "master@exemplo.com" } as any,
        {
          nome: "Empresa Beta",
          email: "cliente@exemplo.com",
          telefone: "+5511999999999",
          sendEmail: false,
          sendWhatsapp: false
        }
      )
    ).resolves.toMatchObject({ id: "p1" });

    expect(deps.prisma.process.create).toHaveBeenCalledTimes(1);
  });

  it("bloqueia empresa duplicada mesmo com email diferente (ignora acentos/caixa)", async () => {
    const deps = baseDeps();
    deps.prisma.process.findMany = vi.fn(async (args: any) => {
      if (args?.where?.currentStep === StepKey.ETAPA_2) return [];
      return [];
    }) as any;
    deps.prisma.process.findFirst = vi.fn(async () => ({ id: "active-1" })) as any;

    const service = new ProcessService(
      deps.prisma as any,
      deps.slaService as any,
      deps.auditService as any,
      deps.notificationService as any,
      deps.authService as any,
      deps.idempotencyService as any
    );

    await expect(
      service.createProcessByOperator(
        { role: "MASTER", email: "master@exemplo.com" } as any,
        {
          nome: "acme comercio",
          email: "outro-cliente@exemplo.com",
          telefone: "+5511999999999",
          sendEmail: false,
          sendWhatsapp: false
        }
      )
    ).rejects.toThrow(/j\u00e1 existe um processo ativo para esta empresa/i);

    expect(deps.prisma.process.create).not.toHaveBeenCalled();
  });

  it("exige nome da empresa para iniciar o processo", async () => {
    const deps = baseDeps();
    const service = new ProcessService(
      deps.prisma as any,
      deps.slaService as any,
      deps.auditService as any,
      deps.notificationService as any,
      deps.authService as any,
      deps.idempotencyService as any
    );

    await expect(
      service.createProcessByOperator(
        { role: "MASTER", email: "master@exemplo.com" } as any,
        {
          nome: "   ",
          email: "cliente@exemplo.com",
          telefone: "+5511999999999",
          sendEmail: false,
          sendWhatsapp: false
        }
      )
    ).rejects.toThrow(/informe o nome da empresa/i);
  });
});
