import { describe, expect, it } from "vitest";
import { buildProcessEmailDrafts } from "../src/modules/notification/process-email-drafts";

describe("buildProcessEmailDrafts", () => {
  it("includes client name in client email draft", () => {
    process.env.FRONTEND_URL = "http://localhost:3000";

    const drafts = buildProcessEmailDrafts({
      event: "correction_requested",
      process: {
        id: "proc-123",
        clientName: "Maria Silva",
        clientEmail: "maria@example.com",
        clientPhone: "+5511999999999",
        status: "CORRECAO_SOLICITADA" as any,
        currentStep: "ETAPA_2" as any,
        ownerEmail: "op@example.com"
      },
      details: {
        correction: { stepKey: "ETAPA_2" as any, fields: ["emailCnpj"], reason: "Dados inconsistentes" }
      }
    });

    expect(drafts.client?.text).toContain("Ola, Maria Silva");
    expect(drafts.client?.html).toContain("<html");
    expect(drafts.operator?.text).toContain("Processo: proc-123");
  });

  it("builds operator draft for process_started", () => {
    const drafts = buildProcessEmailDrafts({
      event: "process_started",
      process: {
        id: "proc-999",
        clientName: "Cliente Teste",
        clientEmail: "cliente@teste.com",
        status: "AGUARDANDO_CLIENTE" as any,
        currentStep: "ETAPA_2" as any,
        ownerEmail: "op@teste.com"
      }
    });

    expect(drafts.operator?.subject).toContain("proc-999");
    expect(drafts.operator?.html).toContain("<html");
  });
});

