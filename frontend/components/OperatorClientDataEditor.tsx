"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { Input } from "@/components/Input";
import { PhoneInput } from "@/components/PhoneInput";
import { Select } from "@/components/Select";
import { DOCS_API_BASE } from "@/lib/api";
import { maskCep, maskCnpj, maskCpf, maskIptu, maskPercent } from "@/lib/masks";
import { notifyError } from "@/lib/notify";
import { MunicipalityData, ProcessDocument, ProcessRecord, ProcessStepData, toProcessRecords } from "@/lib/process-types";

type Props = {
  initialData: ProcessStepData;
  processId: string;
  documents: ProcessDocument[];
  onDocumentsChanged?: () => Promise<void>;
  saving?: boolean;
  onSave: (data: ProcessStepData) => Promise<void>;
  onCancel: () => void;
};

const ESTADOS_CIVIS = ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União estável"];
const REGIMES_CASAMENTO = [
  "Comunhão parcial de bens",
  "Comunhão universal de bens",
  "Separação total de bens",
  "Participação final nos aquestos",
  "Separação obrigatória de bens"
];
const VIRTUAL_ADDRESS = {
  endereco: "Av. Luís Viana",
  numero: "13223",
  complemento: "Hangar Business Park Torre 04 / Sala 12",
  bairro: "São Cristóvão",
  cidade: "Salvador",
  uf: "BA",
  cep: "41500-300"
};
const EMPTY_ADDRESS = { cep: "", endereco: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", iptu: "" };
const documentTypes = [
  { key: "IDENTIFICACAO_SOCIOS", title: "Documento de identificação", description: "RG, CNH ou Documento Profissional. Para pessoa jurídica, inclua contrato social/alteração e documento do representante." },
  { key: "COMPROVANTE_RESIDENCIA", title: "Comprovante de residência", description: "Comprovante de residência do sócio." }
];
const MAX_UPLOAD_FILE_MB = 8;
const MAX_UPLOAD_TOTAL_MB = 60;

const text = (value: unknown) => (value === null || value === undefined ? "" : String(value));
const cloneRecord = (value: ProcessRecord): ProcessRecord => Object.fromEntries(Object.entries(value).map(([key, item]) => [key, text(item)])) as ProcessRecord;
const createSocioId = () => `socio-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const documentKey = (itemKey: string, socioId?: string) => socioId ? `${itemKey}:${socioId}` : itemKey;

export function OperatorClientDataEditor({ initialData, processId, documents, onDocumentsChanged, saving, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<ProcessStepData>({});
  const [error, setError] = useState<string | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [selectedFileNames, setSelectedFileNames] = useState<Record<string, string[]>>({});
  const generatedSocioIds = useRef<Record<string, string>>({});
  const [municipalities, setMunicipalities] = useState<string[]>([]);
  const [municipalityNote, setMunicipalityNote] = useState<string | null>(null);

  function stableSocioId(socio: ProcessRecord, index: number) {
    const persistedId = text(socio.socioId).trim();
    if (persistedId) return persistedId;

    const identity = [
      text(socio.socioCpf),
      text(socio.socioCnpj),
      text(socio.socioNome),
      text(socio.socioRazaoSocial)
    ].map((value) => value.trim().toLowerCase()).join("|");
    const key = `${identity}|index:${index}`;
    if (!generatedSocioIds.current[key]) generatedSocioIds.current[key] = createSocioId();
    return generatedSocioIds.current[key];
  }

  useEffect(() => {
    const address = initialData.endereco && typeof initialData.endereco === "object" ? initialData.endereco : {};
    const socios = toProcessRecords(initialData.quadroSocietario).map((socio, index) => ({ ...cloneRecord(socio), socioId: stableSocioId(socio, index) }));
    setDraft({
      ...initialData,
      razaoSocial1: text(initialData.razaoSocial1),
      razaoSocial2: text(initialData.razaoSocial2),
      razaoSocial3: text(initialData.razaoSocial3),
      municipio: text(initialData.municipio),
      emailCnpj: text(initialData.emailCnpj),
      telefoneCnpj: text(initialData.telefoneCnpj),
      endereco: Object.fromEntries(
        ["cep", "endereco", "numero", "complemento", "bairro", "cidade", "uf", "iptu", "escritorioVirtual"].map((key) => [key, text(address[key])])
      ),
      quadroSocietario: socios.length ? socios : [{ tipoPessoa: "CPF", socioId: createSocioId() }]
    });
    setError(null);
    setMissingFields([]);
  }, [initialData]);

  useEffect(() => {
    let active = true;
    async function loadMunicipalities() {
      setMunicipalityNote("Carregando municípios...");
      try {
        const response = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios");
        if (!response.ok) throw new Error("Falha ao carregar municípios.");
        const data = await response.json();
        const list = (data ?? [])
          .map((municipio: MunicipalityData) => {
            const uf = municipio?.microrregiao?.mesorregiao?.UF?.sigla ?? municipio?.UF?.sigla ?? "";
            return uf ? `${municipio.nome} - ${uf}` : municipio.nome;
          })
          .filter(Boolean)
          .sort((a: string, b: string) => a.localeCompare(b, "pt-BR"));
        if (active) {
          setMunicipalities(list);
          setMunicipalityNote("Digite para filtrar e selecione a opção desejada.");
        }
      } catch {
        if (active) setMunicipalityNote("Não foi possível carregar a lista completa. Você pode digitar manualmente.");
      }
    }
    void loadMunicipalities();
    return () => {
      active = false;
    };
  }, []);

  const address = (draft.endereco ?? {}) as Record<string, unknown>;
  const socios: ProcessRecord[] = toProcessRecords(draft.quadroSocietario).map((socio, index): ProcessRecord => ({
    ...socio,
    socioId: text(socio.socioId) || `operator-${processId}-socio-${index + 1}`
  }));
  const setTop = (key: string, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const setAddress = (key: string, value: string) => setDraft((current) => ({ ...current, endereco: { ...(current.endereco ?? {}), [key]: value } }));
  const setSocio = (index: number, key: string, value: string) => setDraft((current) => ({
    ...current,
    quadroSocietario: toProcessRecords(current.quadroSocietario).map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item)
  }));
  const isMissing = (key: string) => missingFields.includes(key);
  const fieldId = (key: string) => `required-field-${key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const socioFieldKey = (index: number, key: string) => `socio:${index}:${key}`;
  const clearMissing = (key: string) => setMissingFields((current) => current.filter((item) => item !== key));
  const requiredProps = (key: string) => ({
    id: fieldId(key),
    "aria-invalid": isMissing(key) || undefined,
    className: isMissing(key) ? "border-clay ring-2 ring-clay/15" : undefined
  });

  function updateSocioType(index: number, value: string) {
    setDraft((current) => ({
      ...current,
      quadroSocietario: toProcessRecords(current.quadroSocietario).map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const updated: ProcessRecord = { ...item, tipoPessoa: value };
        if (value === "CNPJ") {
          ["socioNome", "socioCpf", "socioEstadoCivil", "socioProfissao", "socioRegimeCasamento"].forEach((key) => { updated[key] = ""; });
        } else {
          ["socioRazaoSocial", "socioCnpj", "adminNomeCompleto", "adminCpf", "adminEmail", "adminTelefone", "adminProfissao", "adminEstadoCivil", "adminRegimeCasamento"].forEach((key) => { updated[key] = ""; });
        }
        return updated;
      })
    }));
  }

  function updateAddressType(value: string) {
    if (value === "Sim") setDraft((current) => ({ ...current, endereco: { ...(current.endereco ?? {}), ...VIRTUAL_ADDRESS, escritorioVirtual: value } }));
    else if (value === "Não" && text(address.escritorioVirtual) === "Sim") setDraft((current) => ({ ...current, endereco: { ...EMPTY_ADDRESS, escritorioVirtual: value } }));
    else setAddress("escritorioVirtual", value);
  }

  async function uploadFiles(itemKey: string, socioId: string | undefined, files: File[]) {
    if (!files.length) return;
    const key = documentKey(itemKey, socioId);
    setSelectedFileNames((current) => ({ ...current, [key]: files.map((file) => file.name) }));
    const oversized = files.find((file) => file.size > MAX_UPLOAD_FILE_MB * 1024 * 1024);
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (oversized) {
      setUploadErrors((current) => ({ ...current, [key]: `Arquivo muito grande. Limite por arquivo: ${MAX_UPLOAD_FILE_MB}MB.` }));
      return;
    }
    if (totalBytes > MAX_UPLOAD_TOTAL_MB * 1024 * 1024) {
      setUploadErrors((current) => ({ ...current, [key]: `Total de arquivos excede ${MAX_UPLOAD_TOTAL_MB}MB.` }));
      return;
    }
    setUploadErrors((current) => ({ ...current, [key]: "" }));
    setUploadingKey(key);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      const query = socioId ? `?socioId=${encodeURIComponent(socioId)}` : "";
      const response = await fetch(`${DOCS_API_BASE}/documents/${processId}/items/${itemKey}/upload${query}`, {
        method: "POST",
        credentials: "include",
        body: formData
      });
      if (!response.ok) throw new Error((await response.text()) || "Erro ao enviar documentos.");
      await onDocumentsChanged?.();
    } catch (uploadError) {
      setUploadErrors((current) => ({ ...current, [key]: uploadError instanceof Error ? uploadError.message : "Erro ao enviar documentos." }));
    } finally {
      setUploadingKey(null);
    }
  }

  function findDocument(itemKey: string, socioId?: string) {
    return documents.find((document) => document.itemKey === itemKey && (document.socioId ?? undefined) === socioId);
  }

  function renderUploadControl(itemKey: string, socioId: string | undefined, document: ProcessDocument | undefined) {
    const key = documentKey(itemKey, socioId);
    const inputId = `document-upload-${key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    const fileNames = selectedFileNames[key] ?? document?.files?.map((file) => file.fileName) ?? [];

    return <div className="mt-3 space-y-2">
      <label htmlFor={inputId} className="inline-flex cursor-pointer items-center rounded-lg bg-brass/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink transition hover:bg-brass/20 focus-within:ring-2 focus-within:ring-brass/40">
        Escolher ficheiros
      </label>
      <Input id={inputId} className="sr-only" type="file" multiple accept=".pdf,.jpg,.jpeg,.png" disabled={uploadingKey === key} onChange={(event) => void uploadFiles(itemKey, socioId, event.target.files ? Array.from(event.target.files) : [])} />
      {fileNames.length > 0 ? <p className="text-xs text-slate" aria-live="polite">{fileNames.join(", ")}</p> : <p className="text-xs text-slate" aria-live="polite">Nenhum ficheiro selecionado</p>}
    </div>;
  }

  async function submit() {
    setError(null);
    const missing: Array<{ key: string; label: string }> = [];
    const addMissing = (key: string, label: string, value: unknown) => { if (!text(value).trim()) missing.push({ key, label }); };
    addMissing("razaoSocial1", "Razão social 1", draft.razaoSocial1);
    addMissing("municipio", "Município", draft.municipio);
    addMissing("emailCnpj", "E-mail do CNPJ", draft.emailCnpj);
    addMissing("telefoneCnpj", "Telefone do CNPJ", draft.telefoneCnpj);
    addMissing("escritorioVirtual", "Endereço é virtual?", address.escritorioVirtual);
    if (text(address.escritorioVirtual) !== "Sim") {
      (["cep", "endereco", "numero", "bairro", "cidade", "uf", "iptu"] as const).forEach((key) => addMissing(`address:${key}`, key === "cep" ? "CEP" : key[0].toUpperCase() + key.slice(1), address[key]));
    }
    if (!socios.length) {
      const message = "Inclua pelo menos um sócio.";
      setMissingFields([]);
      setError(message);
      notifyError(message);
      return;
    }
    for (const socio of socios) {
      const index = socios.indexOf(socio);
      const socioPrefix = `socio:${index}`;
      const isCompany = text(socio.tipoPessoa) === "CNPJ";
      const required = isCompany
        ? [["socioRazaoSocial", "Razão social"], ["socioCnpj", "CNPJ"], ["socioEmail", "E-mail corporativo"], ["socioTelefone", "Telefone do sócio"], ["socioPercentual", "Percentual de participação"], ["socioAdministrador", "Administrador"], ["adminNomeCompleto", "Nome do responsável"], ["adminCpf", "CPF do responsável"], ["adminProfissao", "Profissão do responsável"], ["adminEstadoCivil", "Estado civil do responsável"]]
        : [["socioNome", "Nome completo"], ["socioCpf", "CPF"], ["socioEmail", "E-mail do sócio"], ["socioTelefone", "Telefone do sócio"], ["socioPercentual", "Percentual de participação"], ["socioAdministrador", "Administrador"], ["socioEstadoCivil", "Estado civil"], ["socioProfissao", "Profissão"]];
      required.forEach(([key, label]) => addMissing(`${socioPrefix}:${key}`, `Sócio ${index + 1} — ${label}`, socio[key]));
      if (text(socio.socioEstadoCivil) === "Casado(a)") addMissing(`${socioPrefix}:socioRegimeCasamento`, `Sócio ${index + 1} — Regime de casamento`, socio.socioRegimeCasamento);
      if (text(socio.adminEstadoCivil) === "Casado(a)") addMissing(`${socioPrefix}:adminRegimeCasamento`, `Sócio ${index + 1} — Regime do responsável`, socio.adminRegimeCasamento);
    }
    if (missing.length) {
      const labels = missing.map(({ label }) => label);
      const message = `Preencha os campos obrigatórios: ${labels.slice(0, 4).join(", ")}${labels.length > 4 ? ` e mais ${labels.length - 4}.` : "."}`;
      setMissingFields(missing.map(({ key }) => key));
      setError(message);
      notifyError(message);
      window.setTimeout(() => {
        const first = document.getElementById(fieldId(missing[0].key));
        first?.scrollIntoView({ behavior: "smooth", block: "center" });
        if (first instanceof HTMLElement) first.focus({ preventScroll: true });
      }, 0);
      return;
    }
    await onSave({ ...draft, quadroSocietario: socios });
  }

  return <div className="flex flex-col space-y-6">
    {error && <p role="alert" className="rounded-xl bg-clay/10 px-4 py-3 text-sm text-clay">{error}</p>}
    <section className="grid gap-4 md:grid-cols-2">
      <Field label="Razão social 1" required error={isMissing("razaoSocial1")} hint="Sugestão principal, sem pontuação desnecessária."><Input {...requiredProps("razaoSocial1")} placeholder="Ex: Fundar MF Serviços Ltda" value={text(draft.razaoSocial1)} onChange={(event) => { clearMissing("razaoSocial1"); setTop("razaoSocial1", event.target.value); }} /></Field>
      <Field label="Razão social 2" hint="Opção alternativa caso a principal já exista."><Input placeholder="Ex: Fundar MF Holdings Ltda" value={text(draft.razaoSocial2)} onChange={(event) => setTop("razaoSocial2", event.target.value)} /></Field>
      <Field label="Razão social 3" hint="Terceira opção de contingência."><Input placeholder="Ex: Fundar MF Soluções Empresariais" value={text(draft.razaoSocial3)} onChange={(event) => setTop("razaoSocial3", event.target.value)} /></Field>
      <Field label="Município" required error={isMissing("municipio")} hint={municipalityNote ?? "Digite para filtrar e selecione."}><Input {...requiredProps("municipio")} list="operator-municipios-list" placeholder="Digite o município" value={text(draft.municipio)} onChange={(event) => { clearMissing("municipio"); setTop("municipio", event.target.value); }} /><datalist id="operator-municipios-list">{municipalities.map((municipio) => <option key={municipio} value={municipio} />)}</datalist></Field>
      <Field label="E-mail do CNPJ" required error={isMissing("emailCnpj")} hint="E-mail que receberá notificações oficiais."><Input {...requiredProps("emailCnpj")} type="email" placeholder="contato@empresa.com.br" value={text(draft.emailCnpj)} onChange={(event) => { clearMissing("emailCnpj"); setTop("emailCnpj", event.target.value); }} /></Field>
      <Field label="Telefone do CNPJ" required error={isMissing("telefoneCnpj")} hint="Com DDD e WhatsApp se possível."><PhoneInput value={text(draft.telefoneCnpj)} invalid={isMissing("telefoneCnpj")} onChange={(value) => { clearMissing("telefoneCnpj"); setTop("telefoneCnpj", value); }} /></Field>
    </section>
    <section><h3 className="text-lg font-semibold">Endereço da empresa</h3><div className="mt-3 grid gap-4 md:grid-cols-2">
      <Field label="Endereço é virtual?" required error={isMissing("escritorioVirtual")} hint="Selecione para auto-preenchimento." className="md:col-span-2"><Select {...requiredProps("escritorioVirtual")} value={text(address.escritorioVirtual)} onChange={(event) => { clearMissing("escritorioVirtual"); updateAddressType(event.target.value); }}><option value="">Selecione</option><option value="Sim">Sim</option><option value="Não">Não</option></Select></Field>
      {([["cep", "CEP"], ["endereco", "Endereço"], ["numero", "Número"], ["complemento", "Complemento"], ["bairro", "Bairro"], ["cidade", "Cidade"], ["uf", "UF"], ["iptu", "IPTU"]] as const).map(([key, label]) => { const missingKey = `address:${key}`; return <Field key={key} label={label} required={key !== "complemento"} error={key !== "complemento" && isMissing(missingKey)}><Input {...(key !== "complemento" ? requiredProps(missingKey) : {})} placeholder={key === "cep" ? "00000-000" : undefined} value={text(address[key])} onChange={(event) => { clearMissing(missingKey); setAddress(key, key === "cep" ? maskCep(event.target.value) : key === "iptu" ? maskIptu(event.target.value) : key === "uf" ? event.target.value.toUpperCase() : event.target.value); }} disabled={text(address.escritorioVirtual) === "Sim"} inputMode={key === "cep" || key === "iptu" ? "numeric" : undefined} maxLength={key === "cep" ? 9 : key === "uf" ? 2 : key === "iptu" ? 15 : undefined} /></Field>; })}
    </div></section>
    <section><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-semibold">Quadro societário</h3><p className="mt-1 text-sm text-slate">Use os mesmos campos do formulário enviado ao cliente.</p></div><Button type="button" onClick={() => setDraft((current) => ({ ...current, quadroSocietario: [...toProcessRecords(current.quadroSocietario), { tipoPessoa: "CPF", socioId: createSocioId() }] }))}>Adicionar sócio</Button></div><div className="mt-3 space-y-4">
      {socios.map((socio, index) => { const isCompany = text(socio.tipoPessoa) === "CNPJ"; return <div key={index} className={`rounded-2xl border border-ink/10 p-4 ${isCompany ? "bg-emerald/5" : "bg-white/80"}`}><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold">Sócio {index + 1}</p>{index > 0 && <Button type="button" className="bg-clay" onClick={() => setDraft((current) => ({ ...current, quadroSocietario: toProcessRecords(current.quadroSocietario).filter((_, itemIndex) => itemIndex !== index) }))}>Remover sócio</Button>}</div><div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Tipo de sócio" required><button type="button" role="switch" aria-checked={isCompany} aria-label="Tipo de sócio" className="relative flex h-11 w-full items-center rounded-full border border-ink/10 bg-ink/5 p-1" onClick={() => updateSocioType(index, isCompany ? "CPF" : "CNPJ")}><span className={`relative z-10 flex-1 text-center text-[11px] font-semibold uppercase ${!isCompany ? "text-ink" : "text-slate"}`}>CPF</span><span className={`relative z-10 flex-1 text-center text-[11px] font-semibold uppercase ${isCompany ? "text-ink" : "text-slate"}`}>CNPJ</span><span className={`absolute left-1 top-1 h-9 w-[calc(50%-0.25rem)] rounded-full bg-white shadow-sm transition-transform ${isCompany ? "translate-x-full" : "translate-x-0"}`} /></button></Field>
        <Field label={isCompany ? "Razão social" : "Nome completo"} required error={isMissing(socioFieldKey(index, isCompany ? "socioRazaoSocial" : "socioNome"))}><Input {...requiredProps(socioFieldKey(index, isCompany ? "socioRazaoSocial" : "socioNome"))} value={text(socio[isCompany ? "socioRazaoSocial" : "socioNome"])} onChange={(event) => { clearMissing(socioFieldKey(index, isCompany ? "socioRazaoSocial" : "socioNome")); setSocio(index, isCompany ? "socioRazaoSocial" : "socioNome", event.target.value); }} /></Field>
        <Field label={isCompany ? "CNPJ" : "CPF"} required error={isMissing(socioFieldKey(index, isCompany ? "socioCnpj" : "socioCpf"))}><Input {...requiredProps(socioFieldKey(index, isCompany ? "socioCnpj" : "socioCpf"))} value={text(socio[isCompany ? "socioCnpj" : "socioCpf"])} onChange={(event) => { clearMissing(socioFieldKey(index, isCompany ? "socioCnpj" : "socioCpf")); setSocio(index, isCompany ? "socioCnpj" : "socioCpf", isCompany ? maskCnpj(event.target.value) : maskCpf(event.target.value)); }} inputMode="numeric" maxLength={isCompany ? 18 : 14} /></Field>
        <Field label={isCompany ? "E-mail corporativo" : "E-mail do sócio"} required error={isMissing(socioFieldKey(index, "socioEmail"))}><Input {...requiredProps(socioFieldKey(index, "socioEmail"))} type="email" value={text(socio.socioEmail)} onChange={(event) => { clearMissing(socioFieldKey(index, "socioEmail")); setSocio(index, "socioEmail", event.target.value); }} /></Field>
        <Field label="Telefone do sócio" required error={isMissing(socioFieldKey(index, "socioTelefone"))}><PhoneInput value={text(socio.socioTelefone)} invalid={isMissing(socioFieldKey(index, "socioTelefone"))} onChange={(value) => { clearMissing(socioFieldKey(index, "socioTelefone")); setSocio(index, "socioTelefone", value); }} /></Field>
        <Field label="Percentual de participação" required error={isMissing(socioFieldKey(index, "socioPercentual"))}><Input {...requiredProps(socioFieldKey(index, "socioPercentual"))} value={text(socio.socioPercentual)} onChange={(event) => { clearMissing(socioFieldKey(index, "socioPercentual")); setSocio(index, "socioPercentual", maskPercent(event.target.value)); }} inputMode="numeric" maxLength={4} /></Field>
        {!isCompany && <><Field label="Estado civil" required error={isMissing(socioFieldKey(index, "socioEstadoCivil"))}><Select {...requiredProps(socioFieldKey(index, "socioEstadoCivil"))} value={text(socio.socioEstadoCivil)} onChange={(event) => { clearMissing(socioFieldKey(index, "socioEstadoCivil")); setSocio(index, "socioEstadoCivil", event.target.value); }}><option value="">Selecione</option>{ESTADOS_CIVIS.map((value) => <option key={value}>{value}</option>)}</Select></Field><Field label="Profissão" required error={isMissing(socioFieldKey(index, "socioProfissao"))}><Input {...requiredProps(socioFieldKey(index, "socioProfissao"))} value={text(socio.socioProfissao)} onChange={(event) => { clearMissing(socioFieldKey(index, "socioProfissao")); setSocio(index, "socioProfissao", event.target.value); }} /></Field>{text(socio.socioEstadoCivil) === "Casado(a)" && <Field label="Regime de casamento" required error={isMissing(socioFieldKey(index, "socioRegimeCasamento"))}><Select {...requiredProps(socioFieldKey(index, "socioRegimeCasamento"))} value={text(socio.socioRegimeCasamento)} onChange={(event) => { clearMissing(socioFieldKey(index, "socioRegimeCasamento")); setSocio(index, "socioRegimeCasamento", event.target.value); }}><option value="">Selecione</option>{REGIMES_CASAMENTO.map((value) => <option key={value}>{value}</option>)}</Select></Field>}</>}
        <Field label="Administrador" required error={isMissing(socioFieldKey(index, "socioAdministrador"))}><Select {...requiredProps(socioFieldKey(index, "socioAdministrador"))} value={text(socio.socioAdministrador)} onChange={(event) => { clearMissing(socioFieldKey(index, "socioAdministrador")); setSocio(index, "socioAdministrador", event.target.value); }}><option value="">Selecione</option><option value="Sim">Sim</option><option value="Não">Não</option></Select></Field>
        {isCompany && <div className="md:col-span-2 rounded-2xl border border-ink/10 bg-white/70 p-4"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate">Dados do responsável pela empresa</p><div className="mt-3 grid gap-4 md:grid-cols-2"><Field label="Nome completo" required error={isMissing(socioFieldKey(index, "adminNomeCompleto"))}><Input {...requiredProps(socioFieldKey(index, "adminNomeCompleto"))} value={text(socio.adminNomeCompleto)} onChange={(event) => { clearMissing(socioFieldKey(index, "adminNomeCompleto")); setSocio(index, "adminNomeCompleto", event.target.value); }} /></Field><Field label="CPF" required error={isMissing(socioFieldKey(index, "adminCpf"))}><Input {...requiredProps(socioFieldKey(index, "adminCpf"))} value={text(socio.adminCpf)} onChange={(event) => { clearMissing(socioFieldKey(index, "adminCpf")); setSocio(index, "adminCpf", maskCpf(event.target.value)); }} inputMode="numeric" maxLength={14} /></Field><Field label="Profissão" required error={isMissing(socioFieldKey(index, "adminProfissao"))}><Input {...requiredProps(socioFieldKey(index, "adminProfissao"))} value={text(socio.adminProfissao)} onChange={(event) => { clearMissing(socioFieldKey(index, "adminProfissao")); setSocio(index, "adminProfissao", event.target.value); }} /></Field><Field label="Estado civil" required error={isMissing(socioFieldKey(index, "adminEstadoCivil"))}><Select {...requiredProps(socioFieldKey(index, "adminEstadoCivil"))} value={text(socio.adminEstadoCivil)} onChange={(event) => { clearMissing(socioFieldKey(index, "adminEstadoCivil")); setSocio(index, "adminEstadoCivil", event.target.value); }}><option value="">Selecione</option>{ESTADOS_CIVIS.map((value) => <option key={value}>{value}</option>)}</Select></Field>{text(socio.adminEstadoCivil) === "Casado(a)" && <Field label="Regime de casamento" required error={isMissing(socioFieldKey(index, "adminRegimeCasamento"))}><Select {...requiredProps(socioFieldKey(index, "adminRegimeCasamento"))} value={text(socio.adminRegimeCasamento)} onChange={(event) => { clearMissing(socioFieldKey(index, "adminRegimeCasamento")); setSocio(index, "adminRegimeCasamento", event.target.value); }}><option value="">Selecione</option>{REGIMES_CASAMENTO.map((value) => <option key={value}>{value}</option>)}</Select></Field>}</div></div>}
      </div></div>; })}
    </div></section>
    <div className="order-3 flex flex-wrap justify-end gap-3 border-t border-ink/10 pt-4"><Button type="button" variant="ghost" onClick={onCancel} disabled={saving || Boolean(uploadingKey)}>Cancelar</Button><Button type="button" variant="accent" onClick={() => void submit()} disabled={saving || Boolean(uploadingKey)}>{saving ? "Salvando..." : "Salvar alterações"}</Button></div>
    <section className="space-y-5"><div><h3 className="text-lg font-semibold">Documentos do cliente</h3><p className="mt-1 text-sm text-slate">Os mesmos uploads disponíveis no link do cliente também podem ser enviados pelo operador.</p></div>
      {socios.map((socio, index) => <div key={text(socio.socioId) || index} className="rounded-2xl border border-ink/10 bg-white/80 p-4"><p className="text-sm font-semibold">Documentos do sócio {index + 1}</p><div className="mt-3 grid gap-4 md:grid-cols-2">{documentTypes.map((item) => { const key = documentKey(item.key, text(socio.socioId)); const document = findDocument(item.key, text(socio.socioId)); return <div key={key} className="rounded-2xl border border-ink/10 bg-white/70 p-4"><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-slate">{item.description}</p>{document?.status && <p className="mt-2 text-xs text-slate">Status: {document.status}</p>}{renderUploadControl(item.key, text(socio.socioId), document)}{uploadErrors[key] && <p role="alert" className="mt-2 text-xs text-clay">{uploadErrors[key]}</p>}{uploadingKey === key && <p className="mt-2 text-xs text-slate">Enviando...</p>}</div>; })}</div></div>)}
      {text(address.escritorioVirtual) !== "Sim" && <div className="rounded-2xl border border-ink/10 bg-white/80 p-4"><p className="text-sm font-semibold">Foto da fachada</p><p className="mt-1 text-xs text-slate">Obrigatória para endereço físico, como no formulário do cliente.</p>{findDocument("FOTO_FACHADA")?.status && <p className="mt-2 text-xs text-slate">Status: {findDocument("FOTO_FACHADA")?.status}</p>}{renderUploadControl("FOTO_FACHADA", undefined, findDocument("FOTO_FACHADA"))}{uploadErrors.FOTO_FACHADA && <p role="alert" className="mt-2 text-xs text-clay">{uploadErrors.FOTO_FACHADA}</p>}{uploadingKey === "FOTO_FACHADA" && <p className="mt-2 text-xs text-slate">Enviando...</p>}</div>}
    </section>
  </div>;
}
