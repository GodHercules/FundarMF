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
          data: {
            razaoSocial1: "Empresa Teste",
            municipio: "Salvador - BA",
            emailCnpj: "cliente@exemplo.com",
            telefoneCnpj: "+5511999999999",
            endereco: {
              escritorioVirtual: "Sim"
            },
            quadroSocietario: [
              {
                socioId: "s1",
                socioNome: "Joao",
                socioCpf: "000.000.000-00",
                socioEmail: "joao@exemplo.com",
                socioTelefone: "+5511999999999",
                socioPercentual: "100%",
                socioAdministrador: "Sim",
                responsavelCnpj: "Joao",
                socioEstadoCivil: "Solteiro(a)",
                socioProfissao: "Dev"
              }
            ]
          }
        })),
        update: vi.fn(async () => ({}))
      },
      documentItem: {
        findMany: vi.fn(async () => [
          {
            itemKey: "IDENTIFICACAO_SOCIOS",
            socioId: "s1",
            files: [{ id: "file-1" }]
          },
          {
            itemKey: "COMPROVANTE_RESIDENCIA",
            socioId: "s1",
            files: [{ id: "file-2" }]
          }
        ])
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
      data: {
        razaoSocial1: "Empresa Teste",
        municipio: "Salvador - BA",
        emailCnpj: "cliente@exemplo.com",
        telefoneCnpj: "+5511999999999",
        endereco: {
          escritorioVirtual: "Sim"
        },
        quadroSocietario: [
          {
            socioId: "s1",
            socioNome: "Joao",
            socioCpf: "000.000.000-00",
            socioEmail: "joao@exemplo.com",
            socioTelefone: "+5511999999999",
            socioPercentual: "100%",
            socioAdministrador: "Sim",
            responsavelCnpj: "Joao",
            socioEstadoCivil: "Solteiro(a)",
            socioProfissao: "Dev"
          }
        ]
      }
    })) as any;

    const previousCalls = (notificationService.sendEmail as any).mock.calls.length;
    await expect(service.submitStep("p1", { role: "CLIENTE", email: "cliente@exemplo.com" }, "ETAPA_2")).resolves.toEqual({
      ok: true,
      alreadySubmitted: true
    });
    expect((notificationService.sendEmail as any).mock.calls.length).toBe(previousCalls);
  });

  it("blocks submit when client form/documents are incomplete", async () => {
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
        }))
      },
      processStep: {
        findUnique: vi.fn(async () => ({
          id: "s1",
          locked: false,
          status: ProcessStatus.EM_ANDAMENTO,
          data: {
            razaoSocial1: "",
            municipio: "Salvador - BA",
            emailCnpj: "cliente@exemplo.com"
          }
        }))
      },
      documentItem: {
        findMany: vi.fn(async () => [])
      }
    };

    const service = new ProcessService(
      prisma as any,
      { stopSla: vi.fn(async () => undefined), startSla: vi.fn(async () => undefined) } as any,
      { record: vi.fn(async () => undefined) } as any,
      {
        createInApp: vi.fn(async () => undefined),
        sendEmail: vi.fn(async () => undefined),
        sendWhatsApp: vi.fn(async () => undefined),
        sendWebhook: vi.fn(async () => undefined)
      } as any,
      {} as any
    );

    await expect(service.submitStep("p1", { role: "CLIENTE", email: "cliente@exemplo.com" }, "ETAPA_2")).rejects.toThrow(
      /incompleto/i
    );
  });
});
