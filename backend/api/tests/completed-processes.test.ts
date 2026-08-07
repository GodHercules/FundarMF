import { describe, expect, it, vi } from "vitest";

import { CompletedService } from "../src/modules/completed/completed.service";

const actor = { role: "MASTER" as const, userId: "master-1", email: "master@example.com" };

function serviceWith(prisma: Record<string, unknown>) {
  return new CompletedService(prisma as never, { record: vi.fn() } as never);
}

describe("CompletedService", () => {
  it("normaliza CPF/CNPJ e rejeita duplicidade e nome ausente", async () => {
    const create = vi.fn().mockResolvedValue({ id: "legacy-1" });
    const prisma = { legacyClient: { findUnique: vi.fn().mockResolvedValue(null), create } };
    const service = serviceWith(prisma);
    await expect(service.createLegacyClient({ documentNumber: "123.456.789-01", name: "Cliente" }, actor)).resolves.toEqual({ id: "legacy-1" });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ normalizedDocument: "12345678901" }) }));
    await expect(service.createLegacyClient({ documentNumber: "12345678901" }, actor)).rejects.toThrow("Nome");
  });

  it("rejeita arquivo que não corresponde à assinatura declarada", async () => {
    const prisma = { process: { findFirst: vi.fn().mockResolvedValue({ id: "p1", status: "CONCLUIDO", ownerId: actor.userId }) } };
    const service = serviceWith(prisma);
    await expect(service.uploadContract("p1", { buffer: Buffer.from("not-pdf"), size: 7, mimetype: "application/pdf", originalname: "contrato.pdf" } as never, {}, actor)).rejects.toThrow("assinatura");
  });

  it("rejeita conteúdo de editor fora do schema canônico", async () => {
    const prisma = { contract: { findFirst: vi.fn().mockResolvedValue({ id: "c1", currentVersion: 1, status: "RASCUNHO", process: { ownerId: actor.userId } }) } };
    const service = serviceWith(prisma);
    await expect(service.updateContract("c1", { content: { html: "<script>alert(1)</script>" } }, actor)).rejects.toThrow("estruturado");
  });
});
