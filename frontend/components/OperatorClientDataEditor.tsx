"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { Input } from "@/components/Input";
import { PhoneInput } from "@/components/PhoneInput";
import { Select } from "@/components/Select";
import { maskCep, maskCnpj, maskCpf, maskIptu, maskPercent } from "@/lib/masks";
import { ProcessRecord, ProcessStepData, toProcessRecords } from "@/lib/process-types";

type Props = {
  initialData: ProcessStepData;
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

const text = (value: unknown) => (value === null || value === undefined ? "" : String(value));
const cloneRecord = (value: ProcessRecord) => Object.fromEntries(Object.entries(value).map(([key, item]) => [key, text(item)]));

export function OperatorClientDataEditor({ initialData, saving, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<ProcessStepData>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const address = initialData.endereco && typeof initialData.endereco === "object" ? initialData.endereco : {};
    const socios = toProcessRecords(initialData.quadroSocietario).map(cloneRecord);
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
      quadroSocietario: socios.length ? socios : [{ tipoPessoa: "CPF" }]
    });
    setError(null);
  }, [initialData]);

  const address = (draft.endereco ?? {}) as Record<string, unknown>;
  const socios = toProcessRecords(draft.quadroSocietario);
  const setTop = (key: string, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const setAddress = (key: string, value: string) => setDraft((current) => ({ ...current, endereco: { ...(current.endereco ?? {}), [key]: value } }));
  const setSocio = (index: number, key: string, value: string) => setDraft((current) => ({
    ...current,
    quadroSocietario: toProcessRecords(current.quadroSocietario).map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item)
  }));

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

  async function submit() {
    setError(null);
    if (["razaoSocial1", "municipio", "emailCnpj", "telefoneCnpj"].some((key) => !text(draft[key]).trim())) return setError("Preencha os campos empresariais obrigatórios.");
    if (!text(address.escritorioVirtual)) return setError("Informe se o endereço é virtual.");
    if (text(address.escritorioVirtual) !== "Sim" && ["cep", "endereco", "numero", "bairro", "cidade", "uf", "iptu"].some((key) => !text(address[key]).trim())) return setError("Preencha todos os campos obrigatórios do endereço.");
    if (!socios.length) return setError("Inclua pelo menos um sócio.");
    for (const socio of socios) {
      const isCompany = text(socio.tipoPessoa) === "CNPJ";
      const required = isCompany
        ? ["socioRazaoSocial", "socioCnpj", "socioEmail", "socioTelefone", "socioPercentual", "socioAdministrador", "adminNomeCompleto", "adminCpf", "adminProfissao", "adminEstadoCivil"]
        : ["socioNome", "socioCpf", "socioEmail", "socioTelefone", "socioPercentual", "socioAdministrador", "socioEstadoCivil", "socioProfissao"];
      if (required.some((key) => !text(socio[key]).trim()) || (text(socio.socioEstadoCivil) === "Casado(a)" && !text(socio.socioRegimeCasamento).trim()) || (text(socio.adminEstadoCivil) === "Casado(a)" && !text(socio.adminRegimeCasamento).trim())) return setError("Preencha os campos obrigatórios de cada sócio.");
    }
    await onSave(draft);
  }

  return <div className="space-y-6">
    {error && <p role="alert" className="rounded-xl bg-clay/10 px-4 py-3 text-sm text-clay">{error}</p>}
    <section className="grid gap-4 md:grid-cols-2">
      <Field label="Razão social 1" required hint="Sugestão principal, sem pontuação desnecessária."><Input placeholder="Ex: Fundar MF Serviços Ltda" value={text(draft.razaoSocial1)} onChange={(event) => setTop("razaoSocial1", event.target.value)} /></Field>
      <Field label="Razão social 2" hint="Opção alternativa caso a principal já exista."><Input placeholder="Ex: Fundar MF Holdings Ltda" value={text(draft.razaoSocial2)} onChange={(event) => setTop("razaoSocial2", event.target.value)} /></Field>
      <Field label="Razão social 3" hint="Terceira opção de contingência."><Input placeholder="Ex: Fundar MF Soluções Empresariais" value={text(draft.razaoSocial3)} onChange={(event) => setTop("razaoSocial3", event.target.value)} /></Field>
      <Field label="Município" required hint="Digite o município informado pelo cliente."><Input placeholder="Digite o município" value={text(draft.municipio)} onChange={(event) => setTop("municipio", event.target.value)} /></Field>
      <Field label="E-mail do CNPJ" required hint="E-mail que receberá notificações oficiais."><Input type="email" placeholder="contato@empresa.com.br" value={text(draft.emailCnpj)} onChange={(event) => setTop("emailCnpj", event.target.value)} /></Field>
      <Field label="Telefone do CNPJ" required hint="Com DDD e WhatsApp se possível."><PhoneInput value={text(draft.telefoneCnpj)} onChange={(value) => setTop("telefoneCnpj", value)} /></Field>
    </section>
    <section><h3 className="text-lg font-semibold">Endereço da empresa</h3><div className="mt-3 grid gap-4 md:grid-cols-2">
      <Field label="Endereço é virtual?" required hint="Selecione para auto-preenchimento." className="md:col-span-2"><Select value={text(address.escritorioVirtual)} onChange={(event) => updateAddressType(event.target.value)}><option value="">Selecione</option><option value="Sim">Sim</option><option value="Não">Não</option></Select></Field>
      {([["cep", "CEP"], ["endereco", "Endereço"], ["numero", "Número"], ["complemento", "Complemento"], ["bairro", "Bairro"], ["cidade", "Cidade"], ["uf", "UF"], ["iptu", "IPTU"]] as const).map(([key, label]) => <Field key={key} label={label} required={key !== "complemento"}><Input placeholder={key === "cep" ? "00000-000" : undefined} value={text(address[key])} onChange={(event) => setAddress(key, key === "cep" ? maskCep(event.target.value) : key === "iptu" ? maskIptu(event.target.value) : key === "uf" ? event.target.value.toUpperCase() : event.target.value)} disabled={text(address.escritorioVirtual) === "Sim"} inputMode={key === "cep" || key === "iptu" ? "numeric" : undefined} maxLength={key === "cep" ? 9 : key === "uf" ? 2 : key === "iptu" ? 15 : undefined} /></Field>)}
    </div></section>
    <section><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-semibold">Quadro societário</h3><p className="mt-1 text-sm text-slate">Use os mesmos campos do formulário enviado ao cliente.</p></div><Button type="button" onClick={() => setDraft((current) => ({ ...current, quadroSocietario: [...toProcessRecords(current.quadroSocietario), { tipoPessoa: "CPF" }] }))}>Adicionar sócio</Button></div><div className="mt-3 space-y-4">
      {socios.map((socio, index) => { const isCompany = text(socio.tipoPessoa) === "CNPJ"; return <div key={index} className={`rounded-2xl border border-ink/10 p-4 ${isCompany ? "bg-emerald/5" : "bg-white/80"}`}><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold">Sócio {index + 1}</p>{index > 0 && <Button type="button" className="bg-clay" onClick={() => setDraft((current) => ({ ...current, quadroSocietario: toProcessRecords(current.quadroSocietario).filter((_, itemIndex) => itemIndex !== index) }))}>Remover sócio</Button>}</div><div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Tipo de sócio" required><button type="button" role="switch" aria-checked={isCompany} aria-label="Tipo de sócio" className="relative flex h-11 w-full items-center rounded-full border border-ink/10 bg-ink/5 p-1" onClick={() => updateSocioType(index, isCompany ? "CPF" : "CNPJ")}><span className={`relative z-10 flex-1 text-center text-[11px] font-semibold uppercase ${!isCompany ? "text-ink" : "text-slate"}`}>CPF</span><span className={`relative z-10 flex-1 text-center text-[11px] font-semibold uppercase ${isCompany ? "text-ink" : "text-slate"}`}>CNPJ</span><span className={`absolute left-1 top-1 h-9 w-[calc(50%-0.25rem)] rounded-full bg-white shadow-sm transition-transform ${isCompany ? "translate-x-full" : "translate-x-0"}`} /></button></Field>
        <Field label={isCompany ? "Razão social" : "Nome completo"} required><Input value={text(socio[isCompany ? "socioRazaoSocial" : "socioNome"])} onChange={(event) => setSocio(index, isCompany ? "socioRazaoSocial" : "socioNome", event.target.value)} /></Field>
        <Field label={isCompany ? "CNPJ" : "CPF"} required><Input value={text(socio[isCompany ? "socioCnpj" : "socioCpf"])} onChange={(event) => setSocio(index, isCompany ? "socioCnpj" : "socioCpf", isCompany ? maskCnpj(event.target.value) : maskCpf(event.target.value))} inputMode="numeric" maxLength={isCompany ? 18 : 14} /></Field>
        <Field label={isCompany ? "E-mail corporativo" : "E-mail do sócio"} required><Input type="email" value={text(socio.socioEmail)} onChange={(event) => setSocio(index, "socioEmail", event.target.value)} /></Field>
        <Field label="Telefone do sócio" required><PhoneInput value={text(socio.socioTelefone)} onChange={(value) => setSocio(index, "socioTelefone", value)} /></Field>
        <Field label="Percentual de participação" required><Input value={text(socio.socioPercentual)} onChange={(event) => setSocio(index, "socioPercentual", maskPercent(event.target.value))} inputMode="numeric" maxLength={4} /></Field>
        {!isCompany && <><Field label="Estado civil" required><Select value={text(socio.socioEstadoCivil)} onChange={(event) => setSocio(index, "socioEstadoCivil", event.target.value)}><option value="">Selecione</option>{ESTADOS_CIVIS.map((value) => <option key={value}>{value}</option>)}</Select></Field><Field label="Profissão" required><Input value={text(socio.socioProfissao)} onChange={(event) => setSocio(index, "socioProfissao", event.target.value)} /></Field>{text(socio.socioEstadoCivil) === "Casado(a)" && <Field label="Regime de casamento" required><Select value={text(socio.socioRegimeCasamento)} onChange={(event) => setSocio(index, "socioRegimeCasamento", event.target.value)}><option value="">Selecione</option>{REGIMES_CASAMENTO.map((value) => <option key={value}>{value}</option>)}</Select></Field>}</>}
        <Field label="Administrador" required><Select value={text(socio.socioAdministrador)} onChange={(event) => setSocio(index, "socioAdministrador", event.target.value)}><option value="">Selecione</option><option value="Sim">Sim</option><option value="Não">Não</option></Select></Field>
        {isCompany && <div className="md:col-span-2 rounded-2xl border border-ink/10 bg-white/70 p-4"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate">Dados do responsável pela empresa</p><div className="mt-3 grid gap-4 md:grid-cols-2"><Field label="Nome completo" required><Input value={text(socio.adminNomeCompleto)} onChange={(event) => setSocio(index, "adminNomeCompleto", event.target.value)} /></Field><Field label="CPF" required><Input value={text(socio.adminCpf)} onChange={(event) => setSocio(index, "adminCpf", maskCpf(event.target.value))} inputMode="numeric" maxLength={14} /></Field><Field label="Profissão" required><Input value={text(socio.adminProfissao)} onChange={(event) => setSocio(index, "adminProfissao", event.target.value)} /></Field><Field label="Estado civil" required><Select value={text(socio.adminEstadoCivil)} onChange={(event) => setSocio(index, "adminEstadoCivil", event.target.value)}><option value="">Selecione</option>{ESTADOS_CIVIS.map((value) => <option key={value}>{value}</option>)}</Select></Field>{text(socio.adminEstadoCivil) === "Casado(a)" && <Field label="Regime de casamento" required><Select value={text(socio.adminRegimeCasamento)} onChange={(event) => setSocio(index, "adminRegimeCasamento", event.target.value)}><option value="">Selecione</option>{REGIMES_CASAMENTO.map((value) => <option key={value}>{value}</option>)}</Select></Field>}</div></div>}
      </div></div>; })}
    </div></section>
    <div className="flex flex-wrap justify-end gap-3 border-t border-ink/10 pt-4"><Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>Cancelar</Button><Button type="button" variant="accent" onClick={() => void submit()} disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</Button></div>
  </div>;
}
