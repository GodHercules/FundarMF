"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { maskCep, maskCnpj, maskCpf, maskIptu, maskPercent, maskPhone } from "@/lib/masks";
import { toProcessRecords, ProcessRecord, ProcessStepData } from "@/lib/process-types";

type Props = { initialData: ProcessStepData; saving?: boolean; onSave: (data: ProcessStepData) => Promise<void>; onCancel: () => void };
const socioFields = [
  ["socioEmail", "E-mail", "email"], ["socioTelefone", "Telefone", "text"], ["socioPercentual", "Participação", "text"],
  ["socioProfissao", "Profissão", "text"], ["responsavelCnpj", "Responsável CNPJ", "text"], ["adminNomeCompleto", "Nome do responsável", "text"],
  ["adminCpf", "CPF do responsável", "text"]
] as const;

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
      razaoSocial1: text(initialData.razaoSocial1), razaoSocial2: text(initialData.razaoSocial2), razaoSocial3: text(initialData.razaoSocial3),
      municipio: text(initialData.municipio), emailCnpj: text(initialData.emailCnpj), telefoneCnpj: text(initialData.telefoneCnpj),
      endereco: Object.fromEntries(["cep", "endereco", "numero", "complemento", "bairro", "cidade", "uf", "iptu", "escritorioVirtual"].map((key) => [key, text(address[key])])),
      quadroSocietario: socios.length ? socios : [{ tipoPessoa: "CPF" }]
    });
  }, [initialData]);

  const address = (draft.endereco ?? {}) as Record<string, unknown>;
  const socios = toProcessRecords(draft.quadroSocietario);
  const setTop = (key: string, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const setAddress = (key: string, value: string) => setDraft((current) => ({ ...current, endereco: { ...(current.endereco ?? {}), [key]: value } }));
  const setSocio = (index: number, key: string, value: string) => setDraft((current) => ({
    ...current, quadroSocietario: toProcessRecords(current.quadroSocietario).map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item)
  }));

  async function submit() {
    setError(null);
    const required = ["razaoSocial1", "municipio", "emailCnpj", "telefoneCnpj"];
    if (required.some((key) => !text(draft[key]).trim())) return setError("Preencha os campos empresariais obrigatórios.");
    if (!text(address.escritorioVirtual)) return setError("Informe se o endereço é virtual.");
    if (text(address.escritorioVirtual) !== "Sim" && ["cep", "endereco", "numero", "bairro", "cidade", "uf", "iptu"].some((key) => !text(address[key]).trim())) {
      return setError("Preencha todos os campos obrigatórios do endereço.");
    }
    if (!socios.length) return setError("Inclua pelo menos um sócio.");
    for (const socio of socios) {
      const isCompany = text(socio.tipoPessoa) === "CNPJ";
      const requiredSocio = [isCompany ? "socioRazaoSocial" : "socioNome", isCompany ? "socioCnpj" : "socioCpf", "socioEmail", "socioTelefone", "socioPercentual", "socioAdministrador"];
      if (requiredSocio.some((key) => !text(socio[key]).trim())) return setError("Preencha os campos obrigatórios de cada sócio.");
    }
    await onSave(draft);
  }

  return <div className="space-y-6">
    {error && <p role="alert" className="rounded-xl bg-clay/10 px-4 py-3 text-sm text-clay">{error}</p>}
    <section className="grid gap-4 md:grid-cols-2">
      {[["razaoSocial1", "Razão social 1", true], ["razaoSocial2", "Razão social 2", false], ["razaoSocial3", "Razão social 3", false], ["municipio", "Município", true], ["emailCnpj", "E-mail CNPJ", true], ["telefoneCnpj", "Telefone CNPJ", true]].map(([key, label, required]) => <Field key={String(key)} label={String(label)} required={Boolean(required)}><Input type={key === "emailCnpj" ? "email" : "text"} value={text(draft[String(key)])} onChange={(event) => setTop(String(key), event.target.value)} /></Field>)}
    </section>
    <section><h3 className="text-lg font-semibold">Endereço</h3><div className="mt-3 grid gap-4 md:grid-cols-2">
      <Field label="Endereço virtual" required><Select value={text(address.escritorioVirtual)} onChange={(event) => setAddress("escritorioVirtual", event.target.value)}><option value="">Selecione</option><option>Sim</option><option>Não</option></Select></Field>
      {[["cep", "CEP"], ["endereco", "Logradouro"], ["numero", "Número"], ["complemento", "Complemento"], ["bairro", "Bairro"], ["cidade", "Cidade"], ["uf", "UF"], ["iptu", "IPTU"]].map(([key, label]) => <Field key={key} label={label} required={!['complemento'].includes(key)}><Input value={text(address[key])} onChange={(event) => setAddress(key, key === "cep" ? maskCep(event.target.value) : key === "iptu" ? maskIptu(event.target.value) : key === "uf" ? event.target.value.toUpperCase() : event.target.value)} disabled={text(address.escritorioVirtual) === "Sim"} /></Field>)}
    </div></section>
    <section><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold">Quadro societário</h3><Button type="button" onClick={() => setDraft((current) => ({ ...current, quadroSocietario: [...toProcessRecords(current.quadroSocietario), { tipoPessoa: "CPF" }] }))}>Adicionar sócio</Button></div><div className="mt-3 space-y-4">
      {socios.map((socio, index) => { const isCompany = text(socio.tipoPessoa) === "CNPJ"; return <div key={index} className="rounded-2xl border border-ink/10 p-4"><div className="grid gap-4 md:grid-cols-2">
        <Field label="Tipo de sócio" required><Select value={text(socio.tipoPessoa) || "CPF"} onChange={(event) => setSocio(index, "tipoPessoa", event.target.value)}><option>CPF</option><option>CNPJ</option></Select></Field>
        <Field label={isCompany ? "Razão social" : "Nome completo"} required><Input value={text(socio[isCompany ? "socioRazaoSocial" : "socioNome"])} onChange={(event) => setSocio(index, isCompany ? "socioRazaoSocial" : "socioNome", event.target.value)} /></Field>
        <Field label={isCompany ? "CNPJ" : "CPF"} required><Input value={text(socio[isCompany ? "socioCnpj" : "socioCpf"])} onChange={(event) => setSocio(index, isCompany ? "socioCnpj" : "socioCpf", isCompany ? maskCnpj(event.target.value) : maskCpf(event.target.value))} /></Field>
        {socioFields.map(([key, label, type]) => <Field key={key} label={label} required={key !== "responsavelCnpj" && key !== "socioProfissao"}><Input type={type} value={text(socio[key])} onChange={(event) => setSocio(index, key, key === "socioTelefone" ? maskPhone(event.target.value) : key === "socioPercentual" ? maskPercent(event.target.value) : event.target.value)} /></Field>)}
        <Field label="Administrador" required><Select value={text(socio.socioAdministrador)} onChange={(event) => setSocio(index, "socioAdministrador", event.target.value)}><option value="">Selecione</option><option>Sim</option><option>Não</option></Select></Field>
        {!isCompany && <><Field label="Estado civil"><Input value={text(socio.socioEstadoCivil)} onChange={(event) => setSocio(index, "socioEstadoCivil", event.target.value)} /></Field><Field label="Regime de casamento"><Input value={text(socio.socioRegimeCasamento)} onChange={(event) => setSocio(index, "socioRegimeCasamento", event.target.value)} /></Field></>}
        {isCompany && <><Field label="Estado civil do responsável"><Input value={text(socio.adminEstadoCivil)} onChange={(event) => setSocio(index, "adminEstadoCivil", event.target.value)} /></Field><Field label="Profissão do responsável"><Input value={text(socio.adminProfissao)} onChange={(event) => setSocio(index, "adminProfissao", event.target.value)} /></Field><Field label="Regime do responsável"><Input value={text(socio.adminRegimeCasamento)} onChange={(event) => setSocio(index, "adminRegimeCasamento", event.target.value)} /></Field></>}
      </div>{index > 0 && <Button type="button" className="mt-3 bg-clay" onClick={() => setDraft((current) => ({ ...current, quadroSocietario: toProcessRecords(current.quadroSocietario).filter((_, itemIndex) => itemIndex !== index) }))}>Remover sócio</Button>}</div>; })}
    </div></section>
    <div className="flex flex-wrap justify-end gap-3 border-t border-ink/10 pt-4"><Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>Cancelar</Button><Button type="button" variant="accent" onClick={() => void submit()} disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</Button></div>
  </div>;
}
