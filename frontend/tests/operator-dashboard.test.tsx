import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

describe("OperatorDashboard internal process start", () => {
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

  it("abre o formulário do cliente em uma nova aba sem enviar link", async () => {
    const { default: OperatorDashboard } = await import("@/app/operator/dashboard/page");
    const user = userEvent.setup();
    render(<OperatorDashboard />);

    const internalOptions = await screen.findAllByRole("button", { name: /iniciar processo interno/i });
    await user.click(internalOptions[0]);
    await user.type(screen.getByPlaceholderText("Nome da empresa"), "Empresa Interna");
    await user.type(screen.getByPlaceholderText("E-mail do cliente"), "interno@example.com");
    await user.click(screen.getByRole("button", { name: /^iniciar processo interno$/i }));

    await waitFor(() => expect(apiMock).toHaveBeenCalledWith(
      "/processes",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"sendEmail":false')
      })
    ));
    expect(openMock).toHaveBeenCalledWith("about:blank", "_blank");
    const openedWindow = openMock.mock.results[0].value as { location: { href: string } };
    expect(openedWindow.location.href).toBe("http://localhost:3000/client/process/process-interno-1?modo=interno");
    expect(openedWindow.document.write).toHaveBeenCalledWith(expect.stringContaining("Preparando o preenchimento"));
  });
});
