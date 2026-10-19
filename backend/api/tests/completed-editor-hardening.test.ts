import { describe, expect, it, vi } from "vitest";

import { CompletedService } from "../src/modules/completed/completed.service";

const actor = { role: "MASTER" as const, userId: "master-1" };

function makeService() {
  const prisma = {
    contract: {
      findFirst: vi.fn().mockResolvedValue({
        id: "contract-1",
        currentVersion: 1,
        status: "RASCUNHO",
        process: null
      })
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({
      contract: { update: vi.fn() },
      contractVersion: { create: vi.fn() }
    }))
  };

  return new CompletedService(prisma as never, { record: vi.fn() } as never);
}

describe("CompletedService editor validation", () => {
  it("rejects malformed mark collections instead of throwing a server error", async () => {
    const service = makeService();
    const content = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "texto", marks: {} }] }]
    };

    await expect(service.updateContract("contract-1", { content }, actor)).rejects.toThrow("Formatação inválida");
  });

  it("rejects executable link protocols", async () => {
    const service = makeService();
    const content = {
      type: "doc",
      content: [{
        type: "paragraph",
        content: [{ type: "text", text: "clique", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }]
      }]
    };

    await expect(service.updateContract("contract-1", { content }, actor)).rejects.toThrow("Link inválido");
  });
});
