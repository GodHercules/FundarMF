import { ForbiddenException, BadRequestException } from "@nestjs/common";
import { ProcessStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { ProcessService } from "../src/modules/process/process.service";

function makeService() {
  const process = {
    id: "p1", ownerId: "op-1", currentStep: "ETAPA_2", status: ProcessStatus.AGUARDANDO_OPERADOR,
    clientEmail: "client@example.com", clientPhone: "+5571999999999", companyKey: "old-company", steps: [], checklists: [], slaEvents: []
  };
  const prisma = {
    process: { findUnique: vi.fn().mockResolvedValue(process), findFirst: vi.fn().mockResolvedValue(null), update: vi.fn().mockResolvedValue(process) },
    processStep: {
      findUnique: vi.fn().mockResolvedValue({ id: "step-1", data: { razaoSocial1: "Old" }, locked: true }),
      upsert: vi.fn().mockResolvedValue({ id: "step-1", data: { razaoSocial1: "New" } })
    },
    documentItem: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue({ id: "fachada" }), create: vi.fn(), createMany: vi.fn() }
  };
  const service = new ProcessService(
    prisma as any, {} as any, { record: vi.fn() } as any, {} as any, {} as any, {} as any
  );
  return { service, prisma };
}

describe("operator client data editing", () => {
  it("allows the assigned operator to persist structured client data during validation", async () => {
    const { service, prisma } = makeService();
    const data = {
      razaoSocial1: "New Company", municipio: "Salvador", emailCnpj: "new@example.com", telefoneCnpj: "+5571999999999",
      endereco: { escritorioVirtual: "Sim" },
      quadroSocietario: [{ socioId: "s1", tipoPessoa: "CPF", socioNome: "New Person", socioCpf: "000.000.000-00", socioEmail: "socio@example.com", socioTelefone: "+5571999999999", socioPercentual: "100%", socioAdministrador: "Sim" }]
    };
    await expect(service.updateStep("p1", { role: "OPERADOR", userId: "op-1" } as any, "ETAPA_2" as any, data)).resolves.toBeTruthy();
    expect(prisma.processStep.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ data: expect.objectContaining({ razaoSocial1: "New Company" }) }) }));
  });

  it("rejects protected or unknown fields instead of mass assigning them", async () => {
    const { service } = makeService();
    await expect(service.updateStep("p1", { role: "OPERADOR", userId: "op-1" } as any, "ETAPA_2" as any, { ownerId: "attacker" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("does not grant this editing permission to another operator", async () => {
    const { service } = makeService();
    await expect(service.updateStep("p1", { role: "OPERADOR", userId: "op-2" } as any, "ETAPA_2" as any, { razaoSocial1: "Nope" })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
