import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const apiMock = vi.fn();

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
}));

vi.mock("@/components/WorkspaceNav", () => ({
  WorkspaceNav: () => <nav aria-label="Menu de teste" />
}));

vi.mock("@/lib/api", () => ({
  api: (...args: unknown[]) => apiMock(...args)
}));

describe("OperatorProcessList", () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockResolvedValue({
      items: [{
        id: "process-1",
        clientName: "Empresa Horizonte",
        clientEmail: "contato@horizonte.test",
        status: "AGUARDANDO_OPERADOR",
        currentStep: "ETAPA_2",
        kanbanStage: "VIABILIDADE",
        createdAt: "2026-10-21T10:00:00.000Z",
        updatedAt: "2026-10-21T12:00:00.000Z",
        fillStatus: "Aguardando conferência",
        situation: "Dados recebidos",
        pending: ["Conferir dados enviados pelo cliente"],
        nextAction: "Conferir dados enviados pelo cliente",
        pendingDocuments: 0,
        kanbanEligible: false
      }],
      total: 1,
      hasMore: false,
      summary: { active: 1, awaitingOperator: 1, awaitingClient: 0, inProgress: 0 }
    });
  });

  it("carrega a fila e aponta o processo para a nova rota operacional", async () => {
    const { OperatorProcessList } = await import("@/components/OperatorProcessList");

    render(<OperatorProcessList />);

    expect(await screen.findByRole("heading", { name: "Processos em andamento" })).toBeInTheDocument();
    expect(await screen.findByText("Empresa Horizonte")).toBeInTheDocument();
    expect(apiMock).toHaveBeenCalledWith(expect.stringContaining("/processes/operations?"));
    expect(screen.getByRole("link", { name: /Abrir processo/ })).toHaveAttribute(
      "href",
      "/operator/processos/process-1"
    );
  });
});
