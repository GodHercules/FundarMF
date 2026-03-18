import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "process-123" })
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>
}));

vi.mock("next/image", () => ({
  default: ({ alt, priority, ...props }: any) => <img alt={alt} {...props} />
}));

const apiMock = vi.fn();
vi.mock("@/lib/api", () => ({
  API_BASE: "/api",
  DOCS_API_BASE: "/apix",
  api: (...args: any[]) => apiMock(...args)
}));

describe("ClientProcess submit flow", () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockImplementation((path: string) => {
      if (path === "/processes/process-123") {
        return Promise.resolve({
          id: "process-123",
          status: "EM_ANDAMENTO",
          currentStep: "ETAPA_2",
          steps: [
            {
              stepKey: "ETAPA_2",
              locked: false,
              data: {
                razaoSocial1: "Empresa Teste",
                municipio: "Salvador - BA",
                emailCnpj: "cliente@exemplo.com",
                telefoneCnpj: "+5571999999999",
                endereco: { escritorioVirtual: "Sim" },
                quadroSocietario: [
                  {
                    socioId: "s1",
                    tipoPessoa: "CPF",
                    socioNome: "Joao",
                    socioCpf: "000.000.000-00",
                    socioEmail: "joao@exemplo.com",
                    socioTelefone: "+5571999999999",
                    socioPercentual: "100%",
                    socioAdministrador: "Sim",
                    responsavelCnpj: "Joao",
                    socioEstadoCivil: "Solteiro(a)",
                    socioProfissao: "Dev",
                    socioRegimeCasamento: ""
                  }
                ]
              }
            }
          ],
          documents: [
            {
              id: "d1",
              itemKey: "IDENTIFICACAO_SOCIOS",
              socioId: "s1",
              status: "AGUARDANDO_VALIDACAO",
              files: [{ id: "f1", fileName: "id.pdf", mimeType: "application/pdf", size: 10 }]
            },
            {
              id: "d2",
              itemKey: "COMPROVANTE_RESIDENCIA",
              socioId: "s1",
              status: "AGUARDANDO_VALIDACAO",
              files: [{ id: "f2", fileName: "comp.pdf", mimeType: "application/pdf", size: 10 }]
            }
          ]
        });
      }
      if (path === "/chats/process-123") return Promise.resolve({ messages: [] });
      if (path === "/processes/process-123/steps") return Promise.resolve({ ok: true });
      if (path === "/processes/process-123/submit-step") return Promise.resolve({ ok: true });
      return Promise.resolve({ ok: true });
    });
  });

  it("shows sending screen and then the submitted confirmation without crashing", async () => {
    const { default: ClientProcess } = await import("@/app/client/process/[id]/page");
    const user = userEvent.setup();
    render(<ClientProcess />);

    const btn = await screen.findByRole("button", { name: /enviar tudo para validação/i });
    await user.click(btn);

    expect(await screen.findByRole("heading", { name: /recebendo seus dados/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /recebemos os seus dados/i })).toBeInTheDocument();
    });
  });

  it("shows the socio type selector with CPF and CNPJ options", async () => {
    const { default: ClientProcess } = await import("@/app/client/process/[id]/page");
    render(<ClientProcess />);

    const comboboxes = await screen.findAllByRole("combobox");
    const tipoSocioSelect = comboboxes.find((element) => within(element).queryByRole("option", { name: "CNPJ" }));
    expect(tipoSocioSelect).toBeTruthy();
    const optionValues = Array.from((tipoSocioSelect as HTMLSelectElement).options).map((option) => option.value);
    expect(optionValues).toContain("CPF");
    expect(optionValues).toContain("CNPJ");
  });
});
