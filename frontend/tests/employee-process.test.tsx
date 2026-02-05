import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "process-123" })
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
}));

const apiMock = vi.fn();
vi.mock("@/lib/api", () => ({
  API_BASE: "/api",
  api: (...args: any[]) => apiMock(...args)
}));

const processPayload = {
  id: "process-123",
  status: "EM_ANDAMENTO",
  currentStep: "ETAPA_2",
  steps: [
    {
      stepKey: "ETAPA_2",
      data: {
        razaoSocial1: "Empresa Teste",
        municipio: "Salvador - BA",
        emailCnpj: "cnpj@teste.com",
        telefoneCnpj: "(71) 99999-9999",
        tributacao: "Simples Nacional",
        cnae: "6201-5/01",
        endereco: {
          cep: "40000-000",
          endereco: "Rua A",
          numero: "123",
          complemento: "Sala 1",
          bairro: "Centro",
          iptu: "123",
          escritorioVirtual: "Não"
        },
        quadroSocietario: [
          {
            socioNome: "João",
            socioCpf: "000.000.000-00",
            socioEmail: "joao@teste.com",
            socioTelefone: "(71) 90000-0000",
            socioPercentual: "60%",
            socioAdministrador: "Sim",
            responsavelCnpj: "João"
          }
        ]
      }
    },
    { stepKey: "ETAPA_3", data: {} }
  ],
  documents: [
    {
      id: "doc-1",
      itemKey: "IDENTIFICACAO_SOCIOS",
      status: "AGUARDANDO_VALIDACAO",
      files: [
        { id: "file-1", fileName: "doc.pdf", mimeType: "application/pdf", size: 1000 }
      ]
    }
  ]
};

describe("OperatorProcess", () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockImplementation((path: string) => {
      if (path === "/processes/process-123") return Promise.resolve(processPayload);
      if (path === "/documents/process-123/items") return Promise.resolve(processPayload.documents);
      if (path === "/chats/process-123") return Promise.resolve({ messages: [] });
      return Promise.resolve({ ok: true });
    });
  });

  it("abre o modal e mostra dados do cliente", async () => {
    const { default: EmployeeProcess } = await import("@/app/operator/process/[id]/page");
    const user = userEvent.setup();
    render(<EmployeeProcess />);

    const btn = await screen.findByRole("button", { name: /ver dados do cliente/i });
    await user.click(btn);

    await screen.findByRole("heading", { name: /dados do cliente/i });
    expect(screen.getByText(/razão social 1:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/empresa teste/i).length).toBeGreaterThan(0);
  });

  it("abre visualizador de documento PDF sem erro", async () => {
    const { default: EmployeeProcess } = await import("@/app/operator/process/[id]/page");
    const user = userEvent.setup();
    render(<EmployeeProcess />);

    const btn = await screen.findByRole("button", { name: /ver dados do cliente/i });
    await user.click(btn);

    const view = await screen.findByRole("button", { name: /visualizar/i });
    await user.click(view);

    await waitFor(() => {
      const iframe = document.querySelector("iframe");
      expect(iframe).toBeTruthy();
      expect(iframe?.getAttribute("src")).toContain(
        "/api/documents/process-123/items/IDENTIFICACAO_SOCIOS/preview/file-1"
      );
    });
  });

  it("reprova campo e exige motivo", async () => {
    const { default: EmployeeProcess } = await import("@/app/operator/process/[id]/page");
    const user = userEvent.setup();
    render(<EmployeeProcess />);

    const btn = await screen.findByRole("button", { name: /ver dados do cliente/i });
    await user.click(btn);

    const dislikes = await screen.findAllByRole("button", { name: /reprovar campo/i });
    await user.click(dislikes[0]);

    expect(await screen.findByText(/motivo da reprovao/i)).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(/descreva o motivo/i), "Documento incorreto");
    await user.click(screen.getByRole("button", { name: /enviar reprovao/i }));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith("/processes/process-123/request-correction", expect.any(Object));
    });
  });

  it("aprova documento com like", async () => {
    const { default: EmployeeProcess } = await import("@/app/operator/process/[id]/page");
    const user = userEvent.setup();
    render(<EmployeeProcess />);

    const btn = await screen.findByRole("button", { name: /ver dados do cliente/i });
    await user.click(btn);

    const likeDoc = screen.getAllByRole("button", { name: /aprovar documento/i })[0];
    await user.click(likeDoc);

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(
        "/documents/process-123/items/IDENTIFICACAO_SOCIOS/validate",
        expect.any(Object)
      );
    });
  });
});
