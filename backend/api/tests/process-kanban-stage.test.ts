import { describe, expect, it, vi } from "vitest";
import { ProcessStatus } from "@prisma/client";
import { ProcessService } from "../src/modules/process/process.service";

describe("ProcessService updateKanbanStage", () => {
  it("updates stage, records audit and dispatches client email", async () => {
    const prisma = {
      process: {
        findUnique: vi.fn(async () => ({
          id: "p1",
          status: ProcessStatus.EM_ANDAMENTO,
          currentStep: "ETAPA_3",
          kanbanStage: "VIABILIDADE",
          ownerId: "op-1",
          clientName: "Joana",
          clientEmail: "cliente@teste.com",
          steps: [
            {
              stepKey: "ETAPA_2",
              locked: true,
              status: ProcessStatus.AGUARDANDO_OPERADOR,
              data: {
                razaoSocial1: "Empresa Teste",
                municipio: "Salvador - BA",
                emailCnpj: "cliente@teste.com",
                telefoneCnpj: "+5571999999999",
                endereco: { escritorioVirtual: "Sim" },
                quadroSocietario: [
                  {
                    socioId: "s1",
                    socioNome: "Joana",
                    socioCpf: "000.000.000-00",
                    socioEmail: "joana@teste.com",
                    socioTelefone: "+5571999999999",
                    socioPercentual: "100%",
                    socioAdministrador: "Sim",
                    socioEstadoCivil: "Solteiro(a)",
                    socioProfissao: "Analista"
                  }
                ]
              }
            },
            {
              stepKey: "ETAPA_3",
              data: {
                tipoAtividade: "Servico",
                naturezaJuridica: "Sociedade empresaria Ltda",
                capitalSocial: "10000",
                cnae: "6201-5/01",
                tributacao: "Simples Nacional"
              }
            }
          ],
          documents: [
            { itemKey: "IDENTIFICACAO_SOCIOS", socioId: "s1", status: "APROVADO" },
            { itemKey: "COMPROVANTE_RESIDENCIA", socioId: "s1", status: "APROVADO" }
          ]
        })),
        update: vi.fn(async () => ({
          id: "p1",
          status: ProcessStatus.EM_ANDAMENTO,
          currentStep: "ETAPA_3",
          kanbanStage: "DBE_RECEITA_FEDERAL",
          ownerId: "op-1",
          clientName: "Joana",
          clientEmail: "cliente@teste.com"
        }))
      }
    };

    const slaService = {} as any;
    const auditService = { record: vi.fn(async () => undefined) };
    const notificationService = {
      sendEmail: vi.fn(async () => undefined),
      sendWebhook: vi.fn(async () => undefined)
    };
    const authService = {} as any;

    const service = new ProcessService(
      prisma as any,
      slaService,
      auditService as any,
      notificationService as any,
      authService
    );

    const result = await service.updateKanbanStage(
      "p1",
      { role: "OPERADOR", userId: "op-1", email: "op@teste.com" },
      "DBE_RECEITA_FEDERAL" as any
    );

    expect(result.ok).toBe(true);
    expect(prisma.process.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { kanbanStage: "DBE_RECEITA_FEDERAL" }
    });
    expect(notificationService.sendEmail).toHaveBeenCalledWith(
      "cliente@teste.com",
      expect.stringContaining("Joana"),
      expect.stringContaining("DBE")
    );
    expect(auditService.record).toHaveBeenCalledWith(
      { role: "OPERADOR", userId: "op-1", email: "op@teste.com" },
      "kanban_stage_updated",
      "Process",
      "p1",
      { from: "VIABILIDADE", to: "DBE_RECEITA_FEDERAL" }
    );
  });

  it("returns alreadyInStage without dispatching notification", async () => {
    const prisma = {
      process: {
        findUnique: vi.fn(async () => ({
          id: "p1",
          status: ProcessStatus.EM_ANDAMENTO,
          currentStep: "ETAPA_2",
          kanbanStage: "VIABILIDADE",
          ownerId: "op-1",
          clientEmail: "cliente@teste.com",
          steps: [],
          documents: []
        })),
        update: vi.fn()
      }
    };

    const service = new ProcessService(
      prisma as any,
      {} as any,
      { record: vi.fn(async () => undefined) } as any,
      { sendEmail: vi.fn(async () => undefined), sendWebhook: vi.fn(async () => undefined) } as any,
      {} as any
    );

    const result = await service.updateKanbanStage(
      "p1",
      { role: "OPERADOR", userId: "op-1", email: "op@teste.com" },
      "VIABILIDADE" as any
    );

    expect(result).toEqual({ ok: true, alreadyInStage: true, process: expect.any(Object) });
    expect(prisma.process.update).not.toHaveBeenCalled();
  });

  it("suppresses client email and records an intentional audit for Exigência JUCEB", async () => {
    const prisma = {
      process: {
        findUnique: vi.fn(async () => ({
          id: "p1", status: ProcessStatus.EM_ANDAMENTO, currentStep: "ETAPA_3", kanbanStage: "ANALISE_JUCEB", ownerId: "op-1",
          clientName: "Joana", clientEmail: "cliente@teste.com",
          steps: [
            { stepKey: "ETAPA_2", locked: true, status: ProcessStatus.AGUARDANDO_OPERADOR, data: { razaoSocial1: "Empresa", municipio: "Salvador", emailCnpj: "cliente@teste.com", telefoneCnpj: "+5571999999999", endereco: { escritorioVirtual: "Sim" }, quadroSocietario: [{ socioId: "s1", socioNome: "Joana", socioCpf: "000.000.000-00", socioEmail: "joana@teste.com", socioTelefone: "+5571999999999", socioPercentual: "100%", socioAdministrador: "Sim" }] } },
            { stepKey: "ETAPA_3", data: { tipoAtividade: "Servico", naturezaJuridica: "Ltda", capitalSocial: "100", cnae: "6201-5/01", tributacao: "Simples Nacional" } }
          ],
          documents: [{ itemKey: "IDENTIFICACAO_SOCIOS", socioId: "s1", status: "APROVADO" }, { itemKey: "COMPROVANTE_RESIDENCIA", socioId: "s1", status: "APROVADO" }]
        })),
        update: vi.fn(async () => ({ id: "p1", kanbanStage: "EXIGENCIA_JUCEB" }))
      }
    };
    const auditService = { record: vi.fn(async () => undefined) };
    const notificationService = { sendEmail: vi.fn(), sendWebhook: vi.fn() };
    const service = new ProcessService(prisma as any, {} as any, auditService as any, notificationService as any, {} as any, {} as any);
    (service as any).isKanbanEligible = vi.fn().mockReturnValue(true);
    const actor = { role: "OPERADOR", userId: "op-1", email: "op@teste.com" } as any;

    await service.updateKanbanStage("p1", actor, "EXIGENCIA_JUCEB" as any);

    expect(notificationService.sendEmail).not.toHaveBeenCalled();
    expect(notificationService.sendWebhook).not.toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(actor, "kanban_stage_email_suppressed", "Process", "p1", expect.objectContaining({ kanbanStage: "EXIGENCIA_JUCEB" }));
  });

  it("normalizes eligible VIABILIDADE cards to DOC_INICIAL_APROVADA in process list", async () => {
    const prisma = {
      process: {
        findMany: vi.fn(async () => [
          {
            id: "p1",
            status: ProcessStatus.EM_ANDAMENTO,
            currentStep: "ETAPA_3",
            kanbanStage: "VIABILIDADE",
            ownerId: "op-1",
            createdAt: new Date(),
            steps: [
              {
                stepKey: "ETAPA_2",
                locked: true,
                status: ProcessStatus.AGUARDANDO_OPERADOR,
                data: {
                  razaoSocial1: "Empresa Teste",
                  municipio: "Salvador - BA",
                  emailCnpj: "cliente@teste.com",
                  telefoneCnpj: "+5571999999999",
                  endereco: { escritorioVirtual: "Sim" },
                  quadroSocietario: [
                    {
                      socioId: "s1",
                      socioNome: "Joana",
                      socioCpf: "000.000.000-00",
                      socioEmail: "joana@teste.com",
                      socioTelefone: "+5571999999999",
                      socioPercentual: "100%",
                      socioAdministrador: "Sim",
                      socioEstadoCivil: "Solteiro(a)",
                      socioProfissao: "Analista"
                    }
                  ]
                }
              },
              {
                stepKey: "ETAPA_3",
                locked: false,
                status: ProcessStatus.AGUARDANDO_OPERADOR,
                data: {
                  tipoAtividade: "Servico",
                  naturezaJuridica: "Sociedade empresaria Ltda",
                  capitalSocial: "10000",
                  cnae: "6201-5/01",
                  tributacao: "Simples Nacional"
                }
              }
            ],
            documents: [
              { itemKey: "IDENTIFICACAO_SOCIOS", socioId: "s1", status: "APROVADO" },
              { itemKey: "COMPROVANTE_RESIDENCIA", socioId: "s1", status: "APROVADO" }
            ]
          }
        ])
      }
    };

    const service = new ProcessService(
      prisma as any,
      {} as any,
      { record: vi.fn(async () => undefined) } as any,
      { sendEmail: vi.fn(async () => undefined), sendWebhook: vi.fn(async () => undefined) } as any,
      {} as any
    );

    const list = await service.listProcesses({ role: "OPERADOR", userId: "op-1", email: "op@teste.com" }, { take: 20 });

    expect(list).toHaveLength(1);
    expect((list[0] as any).kanbanEligible).toBe(true);
    expect((list[0] as any).kanbanStage).toBe("DOC_INICIAL_APROVADA");
  });

  it("returns only eligible items in dedicated kanban list", async () => {
    const baseEligible = {
      status: ProcessStatus.EM_ANDAMENTO,
      currentStep: "ETAPA_3",
      kanbanStage: "VIABILIDADE",
      ownerId: "op-1",
      createdAt: new Date(),
      steps: [
        {
          stepKey: "ETAPA_2",
          locked: true,
          status: ProcessStatus.AGUARDANDO_OPERADOR,
          data: {
            razaoSocial1: "Empresa Teste",
            municipio: "Salvador - BA",
            emailCnpj: "cliente@teste.com",
            telefoneCnpj: "+5571999999999",
            endereco: { escritorioVirtual: "Sim" },
            quadroSocietario: [
              {
                socioId: "s1",
                socioNome: "Joana",
                socioCpf: "000.000.000-00",
                socioEmail: "joana@teste.com",
                socioTelefone: "+5571999999999",
                socioPercentual: "100%",
                socioAdministrador: "Sim",
                socioEstadoCivil: "Solteiro(a)",
                socioProfissao: "Analista"
              }
            ]
          }
        },
        {
          stepKey: "ETAPA_3",
          locked: false,
          status: ProcessStatus.AGUARDANDO_OPERADOR,
          data: {
            tipoAtividade: "Servico",
            naturezaJuridica: "Sociedade empresaria Ltda",
            capitalSocial: "10000",
            cnae: "6201-5/01",
            tributacao: "Simples Nacional"
          }
        }
      ],
      documents: [
        { itemKey: "IDENTIFICACAO_SOCIOS", socioId: "s1", status: "APROVADO" },
        { itemKey: "COMPROVANTE_RESIDENCIA", socioId: "s1", status: "APROVADO" }
      ]
    };

    const prisma = {
      process: {
        findMany: vi.fn(async () => [
          { id: "eligible", ...baseEligible },
          {
            id: "ineligible",
            ...baseEligible,
            steps: [
              {
                ...baseEligible.steps[0],
                data: { ...baseEligible.steps[0].data, razaoSocial1: "" }
              },
              baseEligible.steps[1]
            ]
          }
        ])
      }
    };

    const service = new ProcessService(
      prisma as any,
      {} as any,
      { record: vi.fn(async () => undefined) } as any,
      { sendEmail: vi.fn(async () => undefined), sendWebhook: vi.fn(async () => undefined) } as any,
      {} as any
    );

    const list = await service.listKanbanProcesses(
      { role: "OPERADOR", userId: "op-1", email: "op@teste.com" },
      { take: 20 }
    );

    expect(list).toHaveLength(1);
    expect((list[0] as any).id).toBe("eligible");
    expect((list[0] as any).kanbanEligible).toBe(true);
    expect((list[0] as any).kanbanStage).toBe("DOC_INICIAL_APROVADA");
  });
});


