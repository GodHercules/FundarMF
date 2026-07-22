import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const pushMock = vi.fn();
const apiMock = vi.fn();
let tipo = "nome";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "process-123" }),
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => ({ get: (key: string) => (key === "tipo" ? tipo : null) })
}));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("@/lib/api", () => ({ api: (...args: unknown[]) => apiMock(...args) }));

describe("Alteração contratual flow", () => {
  beforeEach(() => {
    tipo = "nome";
    pushMock.mockReset();
    apiMock.mockReset();
    apiMock.mockResolvedValue({ id: "process-123", clientName: "Empresa Teste", status: "CONCLUIDO" });
  });

  it("permite selecionar um tipo e seguir para o Kanban", async () => {
    const { default: SelectionPage } = await import("@/app/client/process/[id]/alteracao-contratual/page");
    const user = userEvent.setup();
    render(<SelectionPage />);
    await screen.findByRole("heading", { name: /escolha o tipo de alteração/i });
    const option = screen.getByRole("button", { name: /nome/i });
    await user.click(option);
    expect(option).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: /continuar/i }));
    expect(pushMock).toHaveBeenCalledWith("/client/process/process-123/alteracao-contratual/kanban?tipo=nome");
  });

  it("exibe o Kanban quando o processo já está concluído", async () => {
    const { default: KanbanPage } = await import("@/app/client/process/[id]/alteracao-contratual/kanban/page");
    render(<KanbanPage />);
    await screen.findByRole("heading", { name: /acompanhamento da alteração contratual/i });
    expect(screen.getAllByText("Nome").length).toBeGreaterThan(0);
    expect(screen.getByText(/kanban da alteração/i)).toBeInTheDocument();
  });

  it("recusa um tipo de alteração inválido", async () => {
    tipo = "invalido";
    const { default: KanbanPage } = await import("@/app/client/process/[id]/alteracao-contratual/kanban/page");
    render(<KanbanPage />);
    expect(await screen.findByText(/tipo de alteração inválido/i)).toBeInTheDocument();
    expect(screen.queryByText(/solicitação recebida/i)).not.toBeInTheDocument();
  });

  it("mostra erro amigável quando a API falha", async () => {
    apiMock.mockRejectedValue(new Error("Serviço indisponível"));
    const { default: KanbanPage } = await import("@/app/client/process/[id]/alteracao-contratual/kanban/page");
    render(<KanbanPage />);
    expect(await screen.findByText("Serviço indisponível")).toBeInTheDocument();
  });
});
