"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { API_BASE, api } from "@/lib/api";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { PhoneInput } from "@/components/PhoneInput";
import { Select } from "@/components/Select";
import { Field } from "@/components/Field";
import { Stepper, StatusBadge } from "@/components/Stepper";
import { Logo } from "@/components/Logo";
import { notifySuccess } from "@/lib/notify";
import { maskCep, maskCpf, maskIptu, maskPercent } from "@/lib/masks";

const steps = ["ETAPA_1", "ETAPA_2", "ETAPA_3", "ETAPA_4", "ETAPA_5", "ETAPA_6"];
const ESTADOS_CIVIS = ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União estável"];
const REGIMES_CASAMENTO = [
  "Comunhão parcial de bens",
  "Comunhão universal de bens",
  "Separação total de bens",
  "Participação final nos aquestos",
  "Separação obrigatória de bens"
];

const documentTypes = [
  {
    key: "IDENTIFICACAO_SOCIOS",
    title: "Documento de identificação",
    description:
      "RG, CNH ou Documento Profissional. Se o sócio for pessoa jurídica, anexar contrato social/alteração + documento do representante."
  },
  {
    key: "COMPROVANTE_RESIDENCIA",
    title: "Comprovante de residência",
    description: "Comprovante de residência do sócio."
  }
];

const defaultStep2 = {
  razaoSocial1: "",
  razaoSocial2: "",
  razaoSocial3: "",
  municipio: "",
  emailCnpj: "",
  telefoneCnpj: ""
};

const defaultSocio = {
  socioId: "",
  socioNome: "",
  socioCpf: "",
  socioEmail: "",
  socioTelefone: "",
  socioPercentual: "",
  socioAdministrador: "",
  responsavelCnpj: "",
  socioEstadoCivil: "",
  socioProfissao: "",
  socioRegimeCasamento: ""
};

const defaultEndereco = {
  cep: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  iptu: "",
  escritorioVirtual: ""
};

const VIRTUAL_ADDRESS = {
  endereco: "Av. Luís Viana",
  numero: "13223",
  complemento: "Hangar Business Park Torre 04 / Sala 12",
  bairro: "São Cristóvão",
  cidade: "Salvador",
  uf: "BA",
  cep: "41500-300"
};

const EMPTY_ADDRESS = {
  cep: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  iptu: ""
};

function getStepData(process: any, stepKey: string) {
  return (process?.steps ?? []).find((step: any) => step.stepKey === stepKey)?.data ?? {};
}

function normalizeStep<T extends Record<string, string>>(defaults: T, data: Record<string, unknown>) {
  const normalized: Record<string, string> = { ...defaults };
  Object.keys(defaults).forEach((key) => {
    const value = data[key];
    if (typeof value === "string") normalized[key] = value;
    if (typeof value === "number") normalized[key] = String(value);
  });
  return normalized as T;
}

function normalizeSocios(input: unknown, legacy?: Record<string, unknown>) {
  const list: Record<string, unknown>[] = [];
  if (Array.isArray(input)) {
    input.forEach((item) => {
      if (item && typeof item === "object") list.push(item as Record<string, unknown>);
    });
  } else if (input && typeof input === "object") {
    list.push(input as Record<string, unknown>);
  } else if (legacy && Object.keys(legacy).length > 0) {
    list.push(legacy);
  }

  if (list.length === 0) list.push({});

  return list.map((item) => {
    const normalized = normalizeStep(defaultSocio, item);
    if (!normalized.socioId) {
      normalized.socioId = createSocioId();
    }
    return normalized;
  });
}

function createEmptySocio() {
  return { ...defaultSocio, socioId: createSocioId() };
}

function createSocioId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `socio-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildDocumentKey(itemKey: string, socioId?: string) {
  return socioId ? `${itemKey}:${socioId}` : itemKey;
}

function findDocumentItem(process: any, itemKey: string, socioId?: string) {
  return (process?.documents ?? []).find(
    (doc: any) => doc.itemKey === itemKey && (doc.socioId ?? null) === (socioId ?? null)
  );
}

export default function ClientProcess() {
  const params = useParams();
  const processId = params?.id as string;
  const [process, setProcess] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [step2, setStep2] = useState(defaultStep2);
  const [socios, setSocios] = useState([createEmptySocio()]);
  const [endereco, setEndereco] = useState(defaultEndereco);
  const [municipalities, setMunicipalities] = useState<string[]>([]);
  const [municipalityNote, setMunicipalityNote] = useState<string | null>(null);
  const [documentFiles, setDocumentFiles] = useState<Record<string, File[]>>({});
  const [uploadingItem, setUploadingItem] = useState<string | null>(null);
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  async function load() {
    const [processData, chatData] = await Promise.all([
      api(`/processes/${processId}`),
      api(`/chats/${processId}`)
    ]);
    setProcess(processData);
    setChatMessages(chatData?.messages ?? []);
  }

  useEffect(() => {
    if (processId) {
      load();
    }
  }, [processId]);

  useEffect(() => {
    if (!process) return;
    const step2Data = getStepData(process, "ETAPA_2");
    const legacySocios = getStepData(process, "ETAPA_4");
    const legacyEndereco = getStepData(process, "ETAPA_5");
    const enderecoData =
      typeof step2Data.endereco === "object" && step2Data.endereco ? (step2Data.endereco as Record<string, unknown>) : {};

    const enderecoSource = Object.keys(enderecoData).length > 0 ? enderecoData : legacyEndereco;

    setStep2(normalizeStep(defaultStep2, step2Data));
    setSocios(normalizeSocios(step2Data.quadroSocietario, legacySocios));
    setEndereco(normalizeStep(defaultEndereco, enderecoSource));
  }, [process]);

  useEffect(() => {
    if (endereco.escritorioVirtual === "Sim") {
      setEndereco((prev) => ({
        ...prev,
        ...VIRTUAL_ADDRESS,
        escritorioVirtual: "Sim"
      }));
    }
  }, [endereco.escritorioVirtual]);

  useEffect(() => {
    let active = true;

    async function loadMunicipalities() {
      setMunicipalityNote("Carregando municípios...");
      try {
        const response = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios");
        if (!response.ok) throw new Error("Falha ao carregar municípios.");
        const data = await response.json();
        const list = (data ?? [])
          .map((municipio: any) => {
            const uf = municipio?.microrregiao?.mesorregiao?.UF?.sigla ?? municipio?.UF?.sigla ?? "";
            return uf ? `${municipio.nome} - ${uf}` : municipio.nome;
          })
          .filter(Boolean);
        list.sort((a: string, b: string) => a.localeCompare(b, "pt-BR"));
        if (active) {
          setMunicipalities(list);
          setMunicipalityNote("Digite para filtrar e selecione a opção desejada.");
        }
      } catch (error) {
        if (active) setMunicipalityNote("Não foi possível carregar a lista completa. Você pode digitar manualmente.");
      }
    }

    loadMunicipalities();
    return () => {
      active = false;
    };
  }, []);

  function buildPayload(correctionFields?: string[], correctionActive?: boolean) {
    const payload = {
      ...step2,
      quadroSocietario: socios,
      endereco
    };
    if (!correctionActive || !correctionFields?.length) return payload;
    const filtered: Record<string, unknown> = {};
    correctionFields.forEach((field) => {
      if (field in payload) {
        filtered[field] = (payload as any)[field];
      }
    });
    return filtered;
  }

  function validateClientForm() {
    const missing: string[] = [];
    if (!step2.razaoSocial1.trim()) missing.push("Razão social 1");
    if (!step2.municipio.trim()) missing.push("Município");
    if (!step2.emailCnpj.trim()) missing.push("E-mail CNPJ");
    if (!step2.telefoneCnpj.trim()) missing.push("Telefone CNPJ");

    if (!endereco.escritorioVirtual) {
      missing.push("Endereço virtual");
    }

    const addressRequired = endereco.escritorioVirtual !== "Sim";
    if (addressRequired) {
      if (!endereco.cep.trim()) missing.push("CEP");
      if (!endereco.endereco.trim()) missing.push("Endereço");
      if (!endereco.numero.trim()) missing.push("Número");
      if (!endereco.bairro.trim()) missing.push("Bairro");
      if (!endereco.cidade.trim()) missing.push("Cidade");
      if (!endereco.uf.trim()) missing.push("UF");
      if (!endereco.iptu.trim()) missing.push("IPTU");
    }

    socios.forEach((socio, index) => {
      const prefix = `Sócio ${index + 1}`;
      if (!socio.socioNome.trim()) missing.push(`${prefix}: nome`);
      if (!socio.socioCpf.trim()) missing.push(`${prefix}: CPF`);
      if (!socio.socioEmail.trim()) missing.push(`${prefix}: e-mail`);
      if (!socio.socioTelefone.trim()) missing.push(`${prefix}: telefone`);
      if (!socio.socioPercentual.trim()) missing.push(`${prefix}: participação`);
      if (!socio.socioAdministrador.trim()) missing.push(`${prefix}: administrador`);
      if (!socio.responsavelCnpj.trim()) missing.push(`${prefix}: responsável CNPJ`);
      if (!socio.socioEstadoCivil.trim()) missing.push(`${prefix}: estado civil`);
      if (!socio.socioProfissao.trim()) missing.push(`${prefix}: profissão`);
      if (socio.socioEstadoCivil === "Casado(a)" && !socio.socioRegimeCasamento.trim()) {
        missing.push(`${prefix}: regime de casamento`);
      }
    });

    if (missing.length > 0) {
      setMessage(`Preencha os campos obrigatórios: ${missing.slice(0, 6).join(", ")}${missing.length > 6 ? "..." : ""}`);
      return false;
    }
    return true;
  }

  async function saveAll() {
    if (!formEditable) return;
    setMessage(null);
    await api(`/processes/${processId}/steps`, {
      method: "PUT",
      body: JSON.stringify({ stepKey: "ETAPA_2", data: buildPayload(correctionFields, correctionActive) })
    });
    setMessage("Dados salvos.");
    notifySuccess("Dados salvos com sucesso.");
    load();
  }

  async function submitAll() {
    if (!formEditable) return;
    if (!validateClientForm()) return;
    setMessage(null);
    await api(`/processes/${processId}/steps`, {
      method: "PUT",
      body: JSON.stringify({ stepKey: "ETAPA_2", data: buildPayload(correctionFields, correctionActive) })
    });
    await api(`/processes/${processId}/submit-step`, {
      method: "POST",
      body: JSON.stringify({ stepKey: "ETAPA_2" })
    });
    setMessage("Dados enviados para validação.");
    notifySuccess("Dados enviados para validação.");
    load();
  }

  async function cancelProcess() {
    setMessage(null);
    await api(`/processes/${processId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: "Cancelado pelo cliente" })
    });
    setMessage("Processo cancelado.");
    load();
  }

  async function sendChatMessage() {
    if (!chatInput.trim()) return;
    setChatLoading(true);
    try {
      await api(`/chats/${processId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: chatInput })
      });
      setChatInput("");
      notifySuccess("Mensagem enviada.");
      load();
    } finally {
      setChatLoading(false);
    }
  }

  function updateSocio(index: number, field: keyof typeof defaultSocio, value: string) {
    setSocios((prev) =>
      prev.map((socio, i) => {
        if (i !== index) return socio;
        const updated = { ...socio, [field]: value };
        if (field === "socioEstadoCivil" && value !== "Casado(a)") {
          updated.socioRegimeCasamento = "";
        }
        return updated;
      })
    );
  }

  function updateEnderecoVirtual(value: string) {
    setEndereco((prev) => {
      if (value === "Não" && prev.escritorioVirtual === "Sim") {
        return { ...prev, ...EMPTY_ADDRESS, escritorioVirtual: value };
      }
      return { ...prev, escritorioVirtual: value };
    });
  }

  function addSocio() {
    setSocios((prev) => [...prev, createEmptySocio()]);
  }

  function removeSocio(index: number) {
    setSocios((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadDocuments(itemKey: string, socioId?: string) {
    const key = buildDocumentKey(itemKey, socioId);
    const files = documentFiles[key] ?? [];
    if (files.length === 0) {
      setUploadErrors((prev) => ({ ...prev, [key]: "Selecione ao menos um arquivo." }));
      return;
    }

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    setUploadingItem(key);
    setUploadErrors((prev) => ({ ...prev, [key]: "" }));

    try {
      const query = socioId ? `?socioId=${encodeURIComponent(socioId)}` : "";
      const response = await fetch(`${API_BASE}/documents/${processId}/items/${itemKey}/upload${query}`, {
        method: "POST",
        credentials: "include",
        body: formData
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Erro ao enviar documentos.");
      }

      setMessage("Arquivos enviados com sucesso.");
      notifySuccess("Arquivos enviados com sucesso.");
      setDocumentFiles((prev) => ({ ...prev, [key]: [] }));
      load();
    } catch (error) {
      setUploadErrors((prev) => ({
        ...prev,
        [key]: error instanceof Error ? error.message : "Erro ao enviar documentos."
      }));
    } finally {
      setUploadingItem(null);
    }
  }

  if (!process) {
    return <div className="p-8">Carregando...</div>;
  }

  const step2Record = (process.steps ?? []).find((step: any) => step.stepKey === "ETAPA_2");
  const correctionFields = (step2Record?.data as any)?.correction?.fields ?? [];
  const correctionActive = Boolean(step2Record?.locked && correctionFields.length > 0);
  const formUnlocked = !step2Record?.locked || correctionActive;
  const formEditable = process.currentStep === "ETAPA_2" && formUnlocked;
  const showClientForm = process.currentStep === "ETAPA_2";
  const isVirtual = endereco.escritorioVirtual === "Sim";
  const addressLocked = isVirtual;
  const currentIndex = steps.indexOf(process.currentStep);
  const stepTag = (stepKey: string) => {
    const index = steps.indexOf(stepKey);
    if (index < currentIndex) return { label: "Concluída", className: "bg-emerald/15 text-emerald" };
    if (index > currentIndex) return { label: "Aguardando liberação", className: "bg-slate/10 text-slate" };
    return null;
  };
  const step2Tag = stepTag("ETAPA_2");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-screen-2xl flex-col gap-8 px-4 py-12 sm:px-6 lg:px-10 2xl:px-16">
      <Link href="/client/dashboard" className="text-sm font-semibold text-slate">
        {"<- Voltar"}
      </Link>
      <header className="flex flex-col gap-3">
        <Logo withText />
        <span className="badge bg-brass/15 text-ink">Acompanhamento</span>
        <h1 className="text-3xl font-semibold">Processo {process.id}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={process.status} />
        </div>
        <div>
          <Button className="bg-clay" onClick={cancelProcess}>
            Cancelar processo
          </Button>
        </div>
      </header>

      {message && <p className="text-sm text-slate">{message}</p>}

      <section className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Etapas</h2>
          <div className="mt-4">
            <Stepper steps={steps} current={process.currentStep} />
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          {!showClientForm && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold">Formulário enviado</h3>
              <p className="mt-2 text-sm text-slate">
                Seus dados foram enviados. Nesta etapa o operador está validando e preenchendo as informações jurídicas.
                Acompanhe o status pelo painel.
              </p>
            </Card>
          )}
          {showClientForm && (
            <>
              <Card className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">Etapa única · Formulário do cliente</h3>
                    <p className="mt-2 text-sm text-slate">
                      Esta etapa reúne todos os dados necessários. A próxima etapa será a abertura junto à Receita Federal.
                    </p>
                  </div>
                  {step2Tag && (
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${step2Tag.className}`}>
                      {step2Tag.label}
                    </span>
                  )}
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field label="Razão social 1" required hint="Sugestão principal, sem pontuação desnecessária.">
                    <Input
                      placeholder="Ex: Fundar MF Serviços Ltda"
                      value={step2.razaoSocial1}
                      onChange={(event) => setStep2((prev) => ({ ...prev, razaoSocial1: event.target.value }))}
                      disabled={!formEditable}
                    />
                  </Field>
                  <Field label="Razão social 2" hint="Opção alternativa caso a principal já exista.">
                    <Input
                      placeholder="Ex: Fundar MF Holdings Ltda"
                      value={step2.razaoSocial2}
                      onChange={(event) => setStep2((prev) => ({ ...prev, razaoSocial2: event.target.value }))}
                      disabled={!formEditable}
                    />
                  </Field>
                  <Field label="Razão social 3" hint="Terceira opção de contingência.">
                    <Input
                      placeholder="Ex: Fundar MF Soluções Empresariais"
                      value={step2.razaoSocial3}
                      onChange={(event) => setStep2((prev) => ({ ...prev, razaoSocial3: event.target.value }))}
                      disabled={!formEditable}
                    />
                  </Field>
                  <Field label="Município" required hint={municipalityNote ?? "Digite para filtrar e selecione."}>
                    <Input
                      list="municipios-list"
                      placeholder="Digite o município"
                      value={step2.municipio}
                      onChange={(event) => setStep2((prev) => ({ ...prev, municipio: event.target.value }))}
                      disabled={!formEditable}
                    />
                    <datalist id="municipios-list">
                      {municipalities.map((municipio) => (
                        <option key={municipio} value={municipio} />
                      ))}
                    </datalist>
                  </Field>
                  <Field label="E-mail do CNPJ" required hint="E-mail que receberá notificações oficiais.">
                    <Input
                      type="email"
                      placeholder="contato@empresa.com.br"
                      value={step2.emailCnpj}
                      onChange={(event) => setStep2((prev) => ({ ...prev, emailCnpj: event.target.value }))}
                      disabled={!formEditable}
                    />
                  </Field>
                  <Field label="Telefone do CNPJ" required hint="Com DDD e WhatsApp se possível.">
                    <PhoneInput
                      value={step2.telefoneCnpj}
                      onChange={(value) => setStep2((prev) => ({ ...prev, telefoneCnpj: value }))}
                      disabled={!formEditable}
                    />
                  </Field>
                </div>
                <p className="mt-4 text-sm text-slate">
                  Este formulário é uma única etapa. Preencha tudo e envie no final.
                </p>
                {!formUnlocked && (
                  <p className="mt-2 text-xs text-slate">
                    Etapa enviada. Aguarde a validação do responsável para liberar novas edições.
                  </p>
                )}
                {correctionActive && (
                  <p className="mt-2 text-xs text-slate">
                    Correção solicitada: apenas os campos liberados serão salvos.
                  </p>
                )}
              </Card>

              <Card className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">Quadro societário</h3>
                    <p className="mt-2 text-sm text-slate">
                      Preencha os dados do(s) sócio(s). Use "Adicionar sócio" para incluir mais de um no formulário.
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-6">
                  {socios.map((socio, index) => (
                    <div key={socio.socioId ?? index} className="rounded-2xl border border-ink/10 bg-white/80 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-ink">Sócio {index + 1}</p>
                        {index > 0 && (
                          <Button className="bg-clay" onClick={() => removeSocio(index)} disabled={!formEditable}>
                            Remover sócio
                          </Button>
                        )}
                      </div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <Field label="Nome completo" required hint="Como consta no documento oficial.">
                          <Input
                            placeholder="Nome do sócio"
                            value={socio.socioNome}
                            onChange={(event) => updateSocio(index, "socioNome", event.target.value)}
                            disabled={!formEditable}
                          />
                        </Field>
                    <Field label="CPF" required hint="Somente números.">
                      <Input
                        placeholder="000.000.000-00"
                        value={socio.socioCpf}
                        onChange={(event) => updateSocio(index, "socioCpf", maskCpf(event.target.value))}
                        disabled={!formEditable}
                        inputMode="numeric"
                        maxLength={14}
                      />
                    </Field>
                        <Field label="E-mail do sócio" required hint="Usado para autenticações futuras.">
                          <Input
                            type="email"
                            placeholder="socio@empresa.com.br"
                            value={socio.socioEmail}
                            onChange={(event) => updateSocio(index, "socioEmail", event.target.value)}
                            disabled={!formEditable}
                          />
                        </Field>
                        <Field label="Telefone do sócio" required hint="Com DDD e WhatsApp se possível.">
                          <PhoneInput
                            value={socio.socioTelefone}
                            onChange={(value) => updateSocio(index, "socioTelefone", value)}
                            disabled={!formEditable}
                          />
                        </Field>
                        <Field label="Percentual de participação" required hint="Informe o percentual exato.">
                          <Input
                            placeholder="Ex: 60%"
                            value={socio.socioPercentual}
                            onChange={(event) => updateSocio(index, "socioPercentual", maskPercent(event.target.value))}
                            disabled={!formEditable}
                            inputMode="numeric"
                            maxLength={4}
                          />
                        </Field>
                        <Field label="Estado civil" required>
                          <Select
                            value={socio.socioEstadoCivil}
                            onChange={(event) => updateSocio(index, "socioEstadoCivil", event.target.value)}
                            disabled={!formEditable}
                          >
                            <option value="">Selecione</option>
                            {ESTADOS_CIVIS.map((estado) => (
                              <option key={estado} value={estado}>
                                {estado}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <Field label="Profissão" required>
                          <Input
                            placeholder="Ex: Administrador"
                            value={socio.socioProfissao}
                            onChange={(event) => updateSocio(index, "socioProfissao", event.target.value)}
                            disabled={!formEditable}
                          />
                        </Field>
                        {socio.socioEstadoCivil === "Casado(a)" && (
                          <Field label="Regime de casamento" required>
                            <Select
                              value={socio.socioRegimeCasamento}
                              onChange={(event) => updateSocio(index, "socioRegimeCasamento", event.target.value)}
                              disabled={!formEditable}
                            >
                              <option value="">Selecione</option>
                              {REGIMES_CASAMENTO.map((regime) => (
                                <option key={regime} value={regime}>
                                  {regime}
                                </option>
                              ))}
                            </Select>
                          </Field>
                        )}
                        <Field label="Administrador" required hint="Defina se o sócio será administrador.">
                          <Select
                            value={socio.socioAdministrador}
                            onChange={(event) => updateSocio(index, "socioAdministrador", event.target.value)}
                            disabled={!formEditable}
                          >
                            <option value="">Selecione</option>
                            <option value="Sim">Sim</option>
                            <option value="Não">Não</option>
                          </Select>
                        </Field>
                        <Field label="Responsável pelo CNPJ" required hint="Nome do responsável legal.">
                          <Input
                            placeholder="Nome do responsável"
                            value={socio.responsavelCnpj}
                            onChange={(event) => updateSocio(index, "responsavelCnpj", event.target.value)}
                            disabled={!formEditable}
                          />
                        </Field>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <Button onClick={addSocio} disabled={!formEditable}>
                    Adicionar sócio
                  </Button>
                </div>

                <div className="mt-6 rounded-2xl border border-ink/10 bg-white/90 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-ink">Precisa de ajuda?</h4>
                      <p className="mt-1 text-xs text-slate">
                        Abra o chat para tirar dúvidas sobre documentos, dados e prazos.
                      </p>
                    </div>
                    <Button className="bg-ink" onClick={() => setChatOpen(true)}>
                      Abrir chat
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">Endereço da empresa</h3>
                    <p className="mt-2 text-sm text-slate">
                      Informe o endereço completo. Se for endereço virtual, o sistema preenche automaticamente.
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field
                    label="Endereço é virtual?"
                    required
                    hint="Selecione para auto-preenchimento."
                    className="md:col-span-2 rounded-2xl border border-brass/30 bg-brass/10 p-3"
                  >
                    <Select
                      value={endereco.escritorioVirtual}
                      onChange={(event) => updateEnderecoVirtual(event.target.value)}
                      disabled={!formEditable}
                    >
                      <option value="">Selecione</option>
                      <option value="Sim">Sim</option>
                      <option value="Não">Não</option>
                    </Select>
                  </Field>
                  <Field label="CEP" required hint="Informe sem espaços.">
                    <Input
                      placeholder="00000-000"
                      value={endereco.cep}
                      onChange={(event) => setEndereco((prev) => ({ ...prev, cep: maskCep(event.target.value) }))}
                      disabled={!formEditable || addressLocked}
                      inputMode="numeric"
                      maxLength={9}
                    />
                  </Field>
                  <Field label="Endereço" required hint="Rua, avenida ou logradouro.">
                    <Input
                      placeholder="Ex: Rua Exemplo"
                      value={endereco.endereco}
                      onChange={(event) => setEndereco((prev) => ({ ...prev, endereco: event.target.value }))}
                      disabled={!formEditable || addressLocked}
                    />
                  </Field>
                  <Field label="Número" required>
                    <Input
                      placeholder="Ex: 123"
                      value={endereco.numero}
                      onChange={(event) => setEndereco((prev) => ({ ...prev, numero: event.target.value }))}
                      disabled={!formEditable || addressLocked}
                    />
                  </Field>
                  <Field label="Complemento" hint="Apto, sala ou referência.">
                    <Input
                      placeholder="Ex: Sala 12"
                      value={endereco.complemento}
                      onChange={(event) => setEndereco((prev) => ({ ...prev, complemento: event.target.value }))}
                      disabled={!formEditable || addressLocked}
                    />
                  </Field>
                  <Field label="Bairro" required>
                    <Input
                      placeholder="Ex: Centro"
                      value={endereco.bairro}
                      onChange={(event) => setEndereco((prev) => ({ ...prev, bairro: event.target.value }))}
                      disabled={!formEditable || addressLocked}
                    />
                  </Field>
                  <Field label="Cidade" required>
                    <Input
                      placeholder="Ex: Salvador"
                      value={endereco.cidade}
                      onChange={(event) => setEndereco((prev) => ({ ...prev, cidade: event.target.value }))}
                      disabled={!formEditable || addressLocked}
                    />
                  </Field>
                  <Field label="UF" required>
                    <Input
                      placeholder="Ex: BA"
                      value={endereco.uf}
                      onChange={(event) => setEndereco((prev) => ({ ...prev, uf: event.target.value.toUpperCase() }))}
                      disabled={!formEditable || addressLocked}
                      maxLength={2}
                    />
                  </Field>
                  <Field label="IPTU" required hint="Número de inscrição do imóvel.">
                    <Input
                      placeholder="Ex: 123.456.789.000"
                      value={endereco.iptu}
                      onChange={(event) => setEndereco((prev) => ({ ...prev, iptu: maskIptu(event.target.value) }))}
                      disabled={!formEditable || addressLocked}
                      inputMode="numeric"
                      maxLength={15}
                    />
                  </Field>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">Documentos</h3>
                    <p className="text-sm text-slate">
                      Faça upload dos documentos exigidos. O operador irá validar cada item.
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-brass/20 bg-brass/5 p-4 text-sm text-slate">
                  <p className="font-semibold text-ink">Documentos necessários</p>
                  <ul className="mt-2 list-disc space-y-2 pl-5">
                    <li>
                      Documentos de identificação dos sócios (RG, CNH ou Documento Profissional). Se o sócio for pessoa
                      jurídica, enviar cópia do contrato social/alteração contratual + identificação do representante.
                    </li>
                    <li>Comprovante de residência de cada sócio.</li>
                    <li>Foto da fachada do imóvel (em caso de empresa com endereço fixo).</li>
                  </ul>
                  <p className="mt-3 text-xs text-slate">
                    Você pode enviar mais de um arquivo por item.
                  </p>
                </div>

                <div className="mt-6 space-y-6">
                  {socios.map((socio, index) => (
                    <div key={socio.socioId || index} className="rounded-2xl border border-ink/10 bg-white/90 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-ink">Documentos do sócio {index + 1}</p>
                          <p className="text-xs text-slate">{socio.socioNome || socio.socioEmail || "Sem nome"}</p>
                        </div>
                        <span className="rounded-full bg-brass/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink">
                          Obrigatório
                        </span>
                      </div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        {documentTypes.map((item) => {
                          const key = buildDocumentKey(item.key, socio.socioId);
                          const doc = findDocumentItem(process, item.key, socio.socioId);
                          return (
                            <div key={key} className="rounded-2xl border border-ink/10 bg-white/80 p-4 shadow-soft">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-ink">{item.title}</p>
                                  <p className="mt-1 text-xs text-slate">{item.description}</p>
                                  {doc?.status && <p className="mt-1 text-xs text-slate">Status: {doc.status}</p>}
                                </div>
                              </div>
                              <div className="mt-4 flex flex-col gap-3">
                                <Input
                                  type="file"
                                  multiple
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  disabled={!formEditable}
                                  onChange={(event) => {
                                    const files = event.target.files ? Array.from(event.target.files) : [];
                                    setDocumentFiles((prev) => ({ ...prev, [key]: files }));
                                  }}
                                />
                                {documentFiles[key]?.length ? (
                                  <p className="text-xs text-slate">{documentFiles[key].length} arquivo(s) selecionado(s)</p>
                                ) : (
                                  <p className="text-xs text-slate">Nenhum arquivo selecionado</p>
                                )}
                                {uploadErrors[key] && <p className="text-xs text-clay">{uploadErrors[key]}</p>}
                                <Button
                                  className="bg-emerald"
                                  onClick={() => uploadDocuments(item.key, socio.socioId)}
                                  disabled={!formEditable || uploadingItem === key}
                                >
                                  {uploadingItem === key ? "Enviando..." : "Enviar arquivos"}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {!isVirtual && (
                    <div className="rounded-2xl border border-ink/10 bg-white/90 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-ink">Foto da fachada</p>
                          <p className="mt-1 text-xs text-slate">Obrigatória para endereço físico.</p>
                        </div>
                        <span className="rounded-full bg-brass/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink">
                          Obrigatório
                        </span>
                      </div>
                      <div className="mt-4 flex flex-col gap-3">
                        <Input
                          type="file"
                          multiple
                          accept=".jpg,.jpeg,.png,.pdf"
                          disabled={!formEditable}
                          onChange={(event) => {
                            const files = event.target.files ? Array.from(event.target.files) : [];
                            setDocumentFiles((prev) => ({ ...prev, ["FOTO_FACHADA"]: files }));
                          }}
                        />
                        {documentFiles["FOTO_FACHADA"]?.length ? (
                          <p className="text-xs text-slate">
                            {documentFiles["FOTO_FACHADA"].length} arquivo(s) selecionado(s)
                          </p>
                        ) : (
                          <p className="text-xs text-slate">Nenhum arquivo selecionado</p>
                        )}
                        {uploadErrors["FOTO_FACHADA"] && (
                          <p className="text-xs text-clay">{uploadErrors["FOTO_FACHADA"]}</p>
                        )}
                        <Button
                          className="bg-emerald"
                          onClick={() => uploadDocuments("FOTO_FACHADA")}
                          disabled={!formEditable || uploadingItem === "FOTO_FACHADA"}
                        >
                          {uploadingItem === "FOTO_FACHADA" ? "Enviando..." : "Enviar foto da fachada"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {isVirtual && (
                    <div className="rounded-2xl border border-emerald/30 bg-emerald/5 p-4 text-sm text-slate">
                      A foto da fachada será anexada pelo operador após o envio do formulário.
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold">Enviar tudo</h3>
                <p className="mt-2 text-sm text-slate">
                  Revise todas as informações e documentos antes de enviar. Você pode salvar como rascunho ou enviar para
                  validação.
                </p>
                {!formEditable && (
                  <p className="mt-3 text-xs text-slate">
                    Esta etapa já foi enviada ou está aguardando análise. Para ajustes, aguarde a liberação do responsável.
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button onClick={saveAll} disabled={!formEditable}>
                    Salvar rascunho
                  </Button>
                  <Button className="bg-emerald" onClick={submitAll} disabled={!formEditable}>
                    Enviar tudo para validação
                  </Button>
                </div>
              </Card>
            </>
          )}
        </div>
      </section>

      <button
        type="button"
        onClick={() => setChatOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-ink text-white shadow-soft hover:opacity-90"
        aria-label="Abrir chat de dúvidas"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9.09 9a3 3 0 0 1 5.82 1c0 2-3 2-3 4" />
          <circle cx="12" cy="12" r="9" />
          <path d="M12 17h.01" />
        </svg>
      </button>

      {chatOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center lg:justify-end">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-soft sm:max-w-2xl lg:h-[calc(100vh-64px)] lg:max-w-[420px] lg:rounded-2xl lg:mr-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-ink">Chat com o operador</h4>
                <p className="mt-1 text-xs text-slate">Tire dúvidas sobre documentos, dados e prazos.</p>
              </div>
              <button
                type="button"
                className="rounded-full bg-slate/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate"
                onClick={() => setChatOpen(false)}
              >
                Fechar
              </button>
            </div>
            <div className="mt-4 flex h-[60vh] flex-col lg:h-[calc(100%-88px)]">
              <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-ink/5 bg-white/70 p-3">
                {chatMessages.length === 0 && (
                  <p className="text-xs text-slate">Nenhuma mensagem ainda. Envie sua primeira dúvida.</p>
                )}
                {chatMessages.map((msg) => {
                  const isClient = msg.authorRole === "CLIENTE";
                  const isBot = msg.authorRole === "BOT";
                  return (
                    <div key={msg.id} className={`flex ${isClient ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                          isClient ? "bg-emerald/15 text-ink" : isBot ? "bg-brass/15 text-ink" : "bg-ink/10 text-ink"
                        }`}
                      >
                        <p className="text-[10px] uppercase tracking-[0.2em] text-slate">
                          {isClient ? "Você" : isBot ? "Bot" : "Operador"}
                        </p>
                        <p className="mt-1">{msg.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Input
                  placeholder="Escreva sua mensagem"
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  disabled={chatLoading || ["CANCELADO", "CONCLUIDO"].includes(process.status)}
                />
                <Button
                  onClick={sendChatMessage}
                  className="bg-ink"
                  disabled={chatLoading || ["CANCELADO", "CONCLUIDO"].includes(process.status)}
                >
                  {chatLoading ? "Enviando..." : "Enviar"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

