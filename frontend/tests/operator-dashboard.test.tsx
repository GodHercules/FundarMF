import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const apiMock = vi.fn();
const openMock = vi.fn();

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>
}));

vi.mock("@/components/Logo", () => ({ Logo: () => <div>Logo</div> }));
vi.mock("@/components/WorkspaceNav", () => ({ WorkspaceNav: () => <nav>Menu</nav> }));
vi.mock("@/components/OperatorKanbanBoard", () => ({ OperatorKanbanBoard: () => <div>Kanban</div> }));
vi.mock("@/lib/notify", () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: (...args: unknown[]) => apiMock(...args) }));

describe("OperatorDashboard new process modal", () => {
  beforeEach(() => {
    apiMock.mockReset();
    openMock.mockReset();
    window.open = openMock as unknown as typeof window.open;
    apiMock.mockImplementation((path: string, options?: RequestInit) => {
      if (path.startsWith("/processes?") || path.startsWith("/notifications?")) return Promise.resolve([]);
      if (path === "/notifications/unread-count") return Promise.resolve({ count: 0 });
      if (path === "/processes" && options?.method === "POST") return Promise.resolve({ id: "process-interno-1" });
      return Promise.resolve({ ok: true });
    });
    openMock.mockReturnValue({
      document: { open: vi.fn(), write: vi.fn(), close: vi.fn() },
      location: { href: "" },
      focus: vi.fn(),
      close: vi.fn()
    });
  });

  it("abre o formulário interno em nova aba sem enviar link", async () => {
    const { default: OperatorDashboard } = await import("@/app/operator/dashboard/page");
    const user = userEvent.setup();
    render(<OperatorDashboard />);

    await user.click(await screen.findByRole("button", { name: /novo processo/i }));
    await user.click(screen.getByRole("button", { name: /iniciar processo interno/i }));
    await user.type(screen.getByPlaceholderText("Nome da empresa"), "Empresa interna");
    await user.type(screen.getByPlaceholderText("E-mail do cliente"), "interno@example.com");
    const submitButtons = screen.getAllByRole("button", { name: /iniciar processo interno/i });
    await user.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => expect(apiMock).toHaveBeenCalledWith(
      "/processes",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"sendEmail":false')
      })
    ));

    const openedWindow = openMock.mock.results[0].value;
    expect(openedWindow.location.href).toBe("http://localhost:3000/client/process/process-interno-1?modo=interno");
    expect(openedWindow.document.write).toHaveBeenCalledWith(expect.stringContaining("Preparando o preenchimento"));
  });

  it("substitui códigos internos por linguagem de atendimento nos processos recentes", async () => {
    apiMock.mockImplementation((path: string) => {
      if (path.startsWith("/processes?")) return Promise.resolve([{ id: "process-2", clientName: "Cliente teste", status: "IN_PROGRESS", currentStep: "ETAPA_2", kanbanStage: "VIABILIDADE", createdAt: "2026-10-21T10:00:00.000Z" }]);
      if (path.startsWith("/notifications?")) return Promise.resolve([]);
      if (path === "/notifications/unread-count") return Promise.resolve({ count: 0 });
      if (path === "/completed-processes?limit=1&offset=0") return Promise.resolve({ total: 0 });
      if (path.startsWith("/processes/kanban")) return Promise.resolve([]);
      return Promise.resolve({ ok: true });
    });

    const { default: OperatorDashboard } = await import("@/app/operator/dashboard/page");
    render(<OperatorDashboard />);
    const recentHeading = await screen.findByRole("heading", { name: "Processos recentes" });
    const recentPanel = recentHeading.closest(".card");

    expect(recentPanel).not.toBeNull();
    expect(await within(recentPanel as HTMLElement).findByText("Aguardando dados cliente")).toBeInTheDocument();
    expect(within(recentPanel as HTMLElement).queryByText("ETAPA_2")).not.toBeInTheDocument();
  });

  it("não exibe dados parciais quando uma carga inicial falha", async () => {
    apiMock.mockImplementation((path: string) => {
      if (path.startsWith("/processes?")) return Promise.reject(new Error("Você não tem permissão para acessar este recurso."));
      if (path.startsWith("/notifications?")) return Promise.resolve([]);
      if (path === "/notifications/unread-count") return Promise.resolve({ count: 0 });
      if (path === "/completed-processes?limit=1&offset=0") return Promise.resolve({ total: 1 });
      if (path.startsWith("/processes/kanban")) return Promise.resolve([]);
      return Promise.resolve({ ok: true });
    });

    const { default: OperatorDashboard } = await import("@/app/operator/dashboard/page");
    render(<OperatorDashboard />);

    expect(await screen.findByRole("alert")).toHaveTextContent("O painel não carregou.");
    expect(screen.queryByRole("heading", { name: "Processos recentes" })).not.toBeInTheDocument();
    expect(screen.queryByText("Finalizados")).not.toBeInTheDocument();
  });
});
