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

  it("prefills the company name and originating email when step data is empty", async () => {
    apiMock.mockImplementation((path: string) => {
      if (path === "/processes/process-123") {
        return Promise.resolve({
          id: "process-123",
          clientName: "Empresa iniciada pelo escritório Ltda",
          clientEmail: "origem@empresa.com.br",
          status: "EM_ANDAMENTO",
          currentStep: "ETAPA_2",
          steps: [{ stepKey: "ETAPA_2", locked: false, data: {} }]
        });
      }
      if (path === "/chats/process-123") return Promise.resolve({ messages: [] });
      if (path === "/documents/process-123/items") return Promise.resolve([]);
      return Promise.resolve({});
    });

    const { default: ClientProcess } = await import("@/app/client/process/[id]/page");
    render(<ClientProcess />);

    expect(await screen.findByDisplayValue("Empresa iniciada pelo escritório Ltda")).toBeInTheDocument();
    expect(screen.getByText("Empresa iniciada pelo escritório Ltda")).toBeInTheDocument();
    expect(screen.getByDisplayValue("origem@empresa.com.br")).toBeInTheDocument();
  });

  it("shows sending screen and then the submitted confirmation without crashing", async () => {
    const { default: ClientProcess } = await import("@/app/client/process/[id]/page");
    const user = userEvent.setup();
    render(<ClientProcess />);
    await screen.findByRole("heading", { name: /formul.rio do cliente/i });

    const continueSection = async (id: string) => {
      const panel = document.getElementById(`client-section-panel-${id}`);
      expect(panel).toBeTruthy();
      await user.click(within(panel as HTMLElement).getByRole("button", { name: /continuar|revisar tudo/i }));
    };
    await continueSection("company");
    await continueSection("partners");
    await continueSection("address");
    await continueSection("documents");
    await user.click(within(document.getElementById("client-section-panel-review") as HTMLElement).getByRole("button", { name: /enviar tudo para validação/i }));

    expect(await screen.findByRole("heading", { name: /recebendo seus dados/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /tudo certo.*recebemos suas informações/i })).toBeInTheDocument();
    });
  });

  it("blocks the remaining sections until partner participation totals 100%", async () => {
    apiMock.mockImplementation((path: string) => {
      if (path === "/processes/process-123") return Promise.resolve({
        id: "process-123",
        status: "EM_ANDAMENTO",
        currentStep: "ETAPA_2",
        steps: [{ stepKey: "ETAPA_2", locked: false, data: { quadroSocietario: [{ socioId: "s1", tipoPessoa: "CPF", socioNome: "Joao", socioCpf: "000.000.000-00", socioEmail: "joao@exemplo.com", socioTelefone: "+5571999999999", socioPercentual: "50%", socioAdministrador: "Sim", socioEstadoCivil: "Solteiro(a)", socioProfissao: "Dev", socioRegimeCasamento: "" }] } }]
      });
      if (path === "/chats/process-123") return Promise.resolve({ messages: [] });
      if (path === "/documents/process-123/items") return Promise.resolve([]);
      return Promise.resolve({});
    });
    const { default: ClientProcess } = await import("@/app/client/process/[id]/page");
    const user = userEvent.setup();
    render(<ClientProcess />);
    await user.click(await screen.findByRole("button", { name: /quadro societário/i }));
    expect(screen.getByText("Soma dos percentuais de participações dos socios é inferior a 100%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continuar/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /endereço/i })).toBeDisabled();
    const participationInput = screen.getByPlaceholderText("Ex.: 60%");
    await user.clear(participationInput);
    await user.type(participationInput, "100");
    expect(screen.queryByText("Soma dos percentuais de participações dos socios é inferior a 100%")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continuar/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /endereço/i })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: /adicionar sócio/i }));
    const participationInputs = screen.getAllByPlaceholderText("Ex.: 60%");
    await user.clear(participationInputs[1]);
    await user.type(participationInputs[1], "20");
    expect(screen.getByText("Soma dos percentuais de participações dos socioas é superior a 100%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continuar/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /endereço/i })).toBeDisabled();
  });

  it("does not show a participation error before the user enters a percentage", async () => {
    apiMock.mockImplementation((path: string) => {
      if (path === "/processes/process-123") return Promise.resolve({
        id: "process-123",
        status: "EM_ANDAMENTO",
        currentStep: "ETAPA_2",
        steps: [{ stepKey: "ETAPA_2", locked: false, data: { quadroSocietario: [{}] } }]
      });
      if (path === "/chats/process-123") return Promise.resolve({ messages: [] });
      if (path === "/documents/process-123/items") return Promise.resolve([]);
      return Promise.resolve({});
    });

    const { default: ClientProcess } = await import("@/app/client/process/[id]/page");
    const user = userEvent.setup();
    render(<ClientProcess />);

    await user.click(await screen.findByRole("button", { name: /quadro societário/i }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ex.: 60%")).toHaveValue("");
  });

  it("shows the socio type selector with CPF and CNPJ options", async () => {
    const { default: ClientProcess } = await import("@/app/client/process/[id]/page");
    const user = userEvent.setup();
    render(<ClientProcess />);

    await user.click(await screen.findByRole("button", { name: /quadro societário/i }));
    const tipoSocioCpf = screen.getByTestId("socio-type-toggle-0-cpf");
    const tipoSocioCnpj = screen.getByTestId("socio-type-toggle-0-cnpj");
    expect(tipoSocioCpf).toBeInTheDocument();
    expect(tipoSocioCpf).toHaveAttribute("aria-checked", "true");
    expect(tipoSocioCnpj).toHaveAttribute("aria-checked", "false");
    await user.click(tipoSocioCnpj);
    expect(tipoSocioCnpj).toHaveAttribute("aria-checked", "true");
  });

  it("uses clear visible labels for CPF and CNPJ partners", async () => {
    const { default: ClientProcess } = await import("@/app/client/process/[id]/page");
    const user = userEvent.setup();
    render(<ClientProcess />);

    await user.click(await screen.findByRole("button", { name: /quadro societário/i }));
    expect(screen.getByText("Tipo de pessoa")).toBeInTheDocument();
    expect(screen.getByText("Nome completo do sócio")).toBeInTheDocument();
    expect(screen.getByText("CPF do sócio")).toBeInTheDocument();
    expect(screen.getByText("E-mail do sócio")).toBeInTheDocument();
    expect(screen.getByText("Telefone do sócio")).toBeInTheDocument();
    expect(screen.getByText("Participação societária (%)")).toBeInTheDocument();
    expect(screen.getByText("O Sócio é administrador?")).toBeInTheDocument();
    const adminToggle = screen.getByRole("switch", { name: "O Sócio é administrador?" });
    expect(adminToggle).toHaveAttribute("aria-checked", "true");
    await user.click(adminToggle);
    expect(adminToggle).toHaveAttribute("aria-checked", "false");

    await user.click(screen.getByTestId("socio-type-toggle-0-cnpj"));
    expect(screen.getByText("Razão social da empresa sócia")).toBeInTheDocument();
    expect(screen.getByText("CNPJ da empresa sócia")).toBeInTheDocument();
    expect(screen.getByText("E-mail da empresa sócia")).toBeInTheDocument();
    expect(screen.getByText("Telefone da empresa sócia")).toBeInTheDocument();
    expect(screen.getByText("Dados do representante da empresa sócia")).toBeInTheDocument();
    expect(screen.getByText("Nome completo do representante")).toBeInTheDocument();
    expect(screen.getByText("CPF do representante")).toBeInTheDocument();
    expect(screen.getByText("Profissão do representante")).toBeInTheDocument();
    expect(screen.getByText("Estado civil do representante")).toBeInTheDocument();
    expect(screen.getByText("O Sócio é administrador?").parentElement).toHaveClass("md:col-span-2");
  });

  it("shows a human-readable status while the client is filling the process", async () => {
    apiMock.mockImplementation((path: string) => {
      if (path === "/processes/process-123") return Promise.resolve({ id: "process-123", status: "AGUARDANDO_CLIENTE", currentStep: "ETAPA_2", steps: [] });
      if (path === "/chats/process-123") return Promise.resolve({ messages: [] });
      if (path === "/documents/process-123/items") return Promise.resolve([]);
      return Promise.resolve({});
    });

    const { default: ClientProcess } = await import("@/app/client/process/[id]/page");
    render(<ClientProcess />);

    expect(await screen.findByText("Aguardando o preenchimento")).toBeInTheDocument();
    expect(screen.queryByText("AGUARDANDO_CLIENTE")).not.toBeInTheDocument();
  });

  it("does not show responsavel CNPJ or responsavel email/telefone fields in quadro societario", async () => {
    const { default: ClientProcess } = await import("@/app/client/process/[id]/page");
    render(<ClientProcess />);

    await screen.findByRole("heading", { name: /formul.rio do cliente/i });
    expect(screen.queryByText(/responsavel pelo cnpj/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/e-mail do responsavel/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/telefone do responsavel/i)).not.toBeInTheDocument();
  });

  it("mostra o atalho de alteração contratual quando o processo já está concluído", async () => {
    apiMock.mockImplementation((path: string) => {
      if (path === "/processes/process-123") {
        return Promise.resolve({
          id: "process-123",
          status: "CONCLUIDO",
          currentStep: "ETAPA_6",
          steps: [
            {
              stepKey: "ETAPA_2",
              locked: true,
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
                    socioEstadoCivil: "Solteiro(a)",
                    socioProfissao: "Dev",
                    socioRegimeCasamento: ""
                  }
                ]
              }
            }
          ],
          documents: []
        });
      }
      if (path === "/chats/process-123") return Promise.resolve({ messages: [] });
      return Promise.resolve({ ok: true });
    });

    const { default: ClientProcess } = await import("@/app/client/process/[id]/page");
    render(<ClientProcess />);

    expect(await screen.findByRole("link", { name: /abrir alteração/i })).toHaveAttribute(
      "href",
      "/client/process/process-123/alteracao-contratual"
    );
  });
});
