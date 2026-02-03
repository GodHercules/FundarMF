"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { API_BASE, api } from "@/lib/api";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/Stepper";
import { Input } from "@/components/Input";
import { Logo } from "@/components/Logo";
import { Select } from "@/components/Select";
import { Field } from "@/components/Field";
import { notifySuccess } from "@/lib/notify";
import { maskCnae, maskCurrency } from "@/lib/masks";

const defaultStep3 = {
  tipoAtividade: "",
  naturezaJuridica: "",
  capitalSocial: "",
  cnae: "",
  tributacao: ""
};

const TRIBUTACAO_OPTIONS = ["Simples Nacional", "Lucro Presumido", "Lucro Real", "Outro"];

function buildDocumentKey(itemKey: string, socioId?: string | null) {
  return socioId ? `${itemKey}:${socioId}` : itemKey;
}

function getStepData(process: any, stepKey: string) {
  return (process?.steps ?? []).find((step: any) => step.stepKey === stepKey)?.data ?? {};
}

function normalizeStep<T extends Record<string, string>>(defaults: T, data: Record<string, unknown>) {
  const normalized = { ...defaults };
  Object.keys(defaults).forEach((key) => {
    const value = data[key];
    if (typeof value === "string") normalized[key] = value;
    if (typeof value === "number") normalized[key] = String(value);
  });
  return normalized;
}

export default function OperatorProcess() {
  const params = useParams();
  const processId = params?.id as string;
  const [process, setProcess] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [step3, setStep3] = useState(defaultStep3);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ itemKey: string; file: any } | null>(null);
  const [docLoading, setDocLoading] = useState<string | null>(null);
  const [fieldDecisions, setFieldDecisions] = useState<Record<string, "approved" | "rejected" | undefined>>({});
  const [docDecisions, setDocDecisions] = useState<Record<string, "APROVADO" | "REPROVADO" | undefined>>({});
  const [step3Saved, setStep3Saved] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [fachadaFiles, setFachadaFiles] = useState<File[]>([]);
  const [fachadaError, setFachadaError] = useState<string | null>(null);
  const [sendingLink, setSendingLink] = useState(false);
  const [rejectModal, setRejectModal] = useState<{
    type: "fields" | "document";
    fields?: string[];
    documentKey?: string;
    documentSocioId?: string;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  async function load() {
    const [processData, chatData] = await Promise.all([api(`/processes/${processId}`), api(`/chats/${processId}`)]);
    setProcess(processData);
    setChatMessages(chatData?.messages ?? []);
  }

  useEffect(() => {
    if (processId) load();
  }, [processId]);

  useEffect(() => {
    if (!process) return;
    const step3Data = getStepData(process, "ETAPA_3");
    setStep3(normalizeStep(defaultStep3, step3Data));
    const hasStep3Data = Object.values(step3Data ?? {}).some((value) => String(value ?? "").trim().length > 0);
    setStep3Saved(hasStep3Data);
    setDocDecisions(
      Object.fromEntries(
        (process.documents ?? [])
          .filter((doc: any) => doc.status === "APROVADO" || doc.status === "REPROVADO")
          .map((doc: any) => [buildDocumentKey(doc.itemKey, doc.socioId), doc.status])
      )
    );
  }, [process]);

  async function validateDocument(itemKey: string, socioId: string | undefined, status: "APROVADO" | "REPROVADO", reason = "") {
    if (status === "REPROVADO" && !reason.trim()) {
      setMessage("Informe o motivo da reprovação.");
      return;
    }
    const key = buildDocumentKey(itemKey, socioId);
    setDocLoading(key);
    try {
      await api(`/documents/${processId}/items/${itemKey}/validate`, {
        method: "POST",
        body: JSON.stringify({ status, reason, socioId })
      });
      setDocDecisions((prev) => ({ ...prev, [key]: status }));
      notifySuccess(status === "APROVADO" ? "Documento aprovado." : "Documento reprovado.");
      load();
    } finally {
      setDocLoading(null);
    }
  }

  async function approveAllDocs() {
    const items = (process?.documents ?? []).map((doc: any) => ({ itemKey: doc.itemKey, socioId: doc.socioId }));
    if (items.length === 0) return;
    setDocLoading("ALL");
    try {
      await Promise.all(
        items.map((item: { itemKey: string; socioId?: string }) =>
          api(`/documents/${processId}/items/${item.itemKey}/validate`, {
            method: "POST",
            body: JSON.stringify({ status: "APROVADO", reason: "", socioId: item.socioId })
          })
        )
      );
      setDocDecisions((prev) => ({
        ...prev,
        ...Object.fromEntries(items.map((item) => [buildDocumentKey(item.itemKey, item.socioId), "APROVADO"]))
      }));
      notifySuccess("Todos os documentos foram aprovados.");
      load();
    } finally {
      setDocLoading(null);
    }
  }

  async function updateStep3() {
    setMessage(null);
    if (!step3.tipoAtividade || !step3.naturezaJuridica || !step3.capitalSocial || !step3.cnae || !step3.tributacao) {
      setMessage("Preencha todos os campos obrigatórios da estrutura jurídica.");
      return;
    }
    await api(`/processes/${processId}/steps`, {
      method: "PUT",
      body: JSON.stringify({ stepKey: "ETAPA_3", data: step3 })
    });
    setStep3Saved(true);
    setMessage("Estrutura jurídica salva.");
    notifySuccess("Estrutura jurídica salva.");
    load();
  }

  async function markInProgress() {
    setMessage(null);
    await api(`/processes/${processId}/mark-in-progress`, {
      method: "POST"
    });
    setMessage("Processo enviado para Receita.");
    notifySuccess("Processo enviado para Receita.");
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

  async function resendLink() {
    setSendingLink(true);
    try {
      await api(`/processes/${processId}/send-link`, {
        method: "POST",
        body: JSON.stringify({ sendEmail: true, sendWhatsapp: true })
      });
      notifySuccess("Link reenviado ao cliente.");
    } finally {
      setSendingLink(false);
    }
  }

  async function uploadFachada() {
    if (fachadaFiles.length === 0) {
      setFachadaError("Selecione ao menos um arquivo.");
      return;
    }
    setFachadaError(null);
    const formData = new FormData();
    fachadaFiles.forEach((file) => formData.append("files", file));
    setDocLoading("FOTO_FACHADA_UPLOAD");
    try {
      const response = await fetch(`${API_BASE}/documents/${processId}/items/FOTO_FACHADA/upload`, {
        method: "POST",
        credentials: "include",
        body: formData
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Erro ao enviar foto da fachada.");
      }
      notifySuccess("Foto da fachada enviada.");
      setFachadaFiles([]);
      load();
    } catch (error: any) {
      setFachadaError(error.message ?? "Erro ao enviar foto da fachada.");
    } finally {
      setDocLoading(null);
    }
  }

  function setDecision(field: string, decision: "approved" | "rejected") {
    setFieldDecisions((prev) => ({ ...prev, [field]: decision }));
  }

  function getRejectedFields(keys: string[]) {
    return keys.filter((key) => fieldDecisions[key] === "rejected");
  }

  async function sendCorrection(fields: string[], reason: string) {
    if (!step2Enabled) {
      setMessage("Correções só podem ser enviadas quando a etapa atual é ETAPA_2.");
      return;
    }
    if (!reason.trim()) {
      setMessage("Informe o motivo da reprovação.");
      return;
    }
    await api(`/processes/${processId}/request-correction`, {
      method: "POST",
      body: JSON.stringify({ stepKey: "ETAPA_2", fields, reason })
    });
    notifySuccess("Correção solicitada.");
    load();
  }

  async function cancelProcess() {
    setMessage(null);
    await api(`/processes/${processId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: "Cancelado pelo operador" })
    });
    setMessage("Processo cancelado.");
    notifySuccess("Processo cancelado.");
    load();
  }

  if (!process) return <div className="p-8">Carregando...</div>;

  const step2 = getStepData(process, "ETAPA_2");
  const endereco = step2.endereco ?? {};
  const sociosList = Array.isArray(step2.quadroSocietario)
    ? step2.quadroSocietario
    : step2.quadroSocietario
      ? [step2.quadroSocietario]
      : [];
  const socioMap = new Map(
    sociosList.map((socio: any, index: number) => [
      socio?.socioId ?? `index-${index}`,
      socio?.socioNome || socio?.socioEmail || `Sócio ${index + 1}`
    ])
  );
  const isVirtual = endereco?.escritorioVirtual === "Sim";
  const step2Enabled = process.currentStep === "ETAPA_2";
  const approvalFields = [
    { key: "razaoSocial1", label: "Razão social 1", value: step2.razaoSocial1 },
    { key: "razaoSocial2", label: "Razão social 2", value: step2.razaoSocial2 },
    { key: "razaoSocial3", label: "Razão social 3", value: step2.razaoSocial3 },
    { key: "municipio", label: "Município", value: step2.municipio },
    { key: "emailCnpj", label: "E-mail CNPJ", value: step2.emailCnpj },
    { key: "telefoneCnpj", label: "Telefone CNPJ", value: step2.telefoneCnpj },
    { key: "endereco", label: "Endereço", value: step2.endereco ? "Endereço informado" : "Não informado" },
    { key: "quadroSocietario", label: "Quadro societário", value: sociosList.length ? `${sociosList.length} sócio(s)` : "Não informado" }
  ];
  const documentos = process.documents ?? [];
  const formatValue = (value: any) => (value ? String(value) : "Não informado");
  const resolveDocStatus = (doc: any) =>
    String(docDecisions[buildDocumentKey(doc.itemKey, doc.socioId)] ?? doc.status ?? "")
      .trim()
      .toUpperCase();
  const approvalsComplete =
    approvalFields.every((field) => fieldDecisions[field.key] === "approved") &&
    documentos.every((doc: any) => resolveDocStatus(doc) === "APROVADO");
  const step3Enabled = process.currentStep === "ETAPA_3" || (step2Enabled && approvalsComplete);
  const chatDisabled = ["CANCELADO", "CONCLUIDO"].includes(process.status);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-screen-2xl flex-col gap-8 px-4 py-12 sm:px-6 lg:px-10 2xl:px-16">
      <Link href="/operator/dashboard" className="text-sm font-semibold text-slate">
        ← Voltar
      </Link>
      <header className="flex flex-col gap-2">
        <Logo withText />
        <span className="badge bg-emerald/15 text-ink">Caso em análise</span>
        <h1 className="text-3xl font-semibold">Caso {process.id}</h1>
        <div className="flex items-center gap-3">
          <StatusBadge status={process.status} />
          <span className="text-sm text-slate">Etapa atual: {process.currentStep}</span>
        </div>
        <div>
          <div className="flex flex-wrap gap-3">
            <Button className="bg-ink" onClick={resendLink} disabled={sendingLink}>
              {sendingLink ? "Enviando link..." : "Enviar link ao cliente"}
            </Button>
            <Button className="bg-clay" onClick={cancelProcess}>
              Cancelar processo
            </Button>
          </div>
        </div>
      </header>

      {message && <p className="text-sm text-slate">{message}</p>}

      <section className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Checklist</h2>
          <p className="text-sm text-slate">Marque itens e aprove quando tudo estiver completo.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button className="bg-ink" onClick={() => setShowDetails(true)}>
              Ver dados do cliente
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Solicitar correção</h2>
          <p className="text-sm text-slate">A reprovação acontece dentro de “Ver dados do cliente”.</p>
        </Card>
      </section>

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Estrutura Jurídica e Financeira</h2>
        <p className="text-sm text-slate">Campos exclusivos do operador para alinhamento com o cliente.</p>
        {!step3Enabled && (
          <p className="mt-2 text-xs text-slate">
            Aprove todos os itens do checklist para liberar esta etapa.
          </p>
        )}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Tipo de Atividade" required>
            <Select
              value={step3.tipoAtividade}
              onChange={(event) => setStep3((prev) => ({ ...prev, tipoAtividade: event.target.value }))}
              disabled={!step3Enabled}
            >
              <option value="">Selecione</option>
              <option value="Comércio">Comércio</option>
              <option value="Serviço">Serviço</option>
              <option value="Comércio e Serviço">Comércio e Serviço</option>
            </Select>
          </Field>
          <Field label="Natureza Jurídica" required>
            <Select
              value={step3.naturezaJuridica}
              onChange={(event) => setStep3((prev) => ({ ...prev, naturezaJuridica: event.target.value }))}
              disabled={!step3Enabled}
            >
              <option value="">Selecione</option>
              <option value="Sociedade Unipessoal">Sociedade Unipessoal</option>
              <option value="Sociedade empresaria Ltda">Sociedade empresária Ltda</option>
              <option value="Empresario individual">Empresário individual</option>
              <option value="Sociedade individual de Advocacia">Sociedade individual de Advocacia</option>
              <option value="Sociedade Propósito Específico - SPE">Sociedade Propósito Específico - SPE</option>
              <option value="Sociedade por Conta de Participação - SCP">Sociedade por Conta de Participação - SCP</option>
            </Select>
          </Field>
          <Field label="Capital Social" required hint="Informe o valor em reais.">
            <Input
              placeholder="R$ 0,00"
              value={step3.capitalSocial}
              onChange={(event) =>
                setStep3((prev) => ({ ...prev, capitalSocial: maskCurrency(event.target.value) }))
              }
              disabled={!step3Enabled}
              inputMode="numeric"
              maxLength={18}
            />
          </Field>
          <Field label="CNAE" required>
            <Input
              placeholder="Ex: 6201-5/01"
              value={step3.cnae}
              onChange={(event) => setStep3((prev) => ({ ...prev, cnae: maskCnae(event.target.value) }))}
              disabled={!step3Enabled}
              inputMode="numeric"
              maxLength={9}
            />
          </Field>
          <Field label="Tributação" required>
            <Select
              value={step3.tributacao}
              onChange={(event) => setStep3((prev) => ({ ...prev, tributacao: event.target.value }))}
              disabled={!step3Enabled}
            >
              <option value="">Selecione</option>
              {TRIBUTACAO_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={updateStep3} disabled={!step3Enabled}>
            Salvar
          </Button>
          {step3Saved && (
            <Button className="bg-emerald" onClick={markInProgress}>
              Enviar para Receita
            </Button>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Chat com o cliente</h2>
        <p className="text-sm text-slate">Responda dúvidas e acompanhe as interações com o bot.</p>
        <div className="mt-4 max-h-72 space-y-3 overflow-y-auto rounded-xl border border-ink/10 bg-white/70 p-3">
          {chatMessages.length === 0 && <p className="text-xs text-slate">Nenhuma mensagem ainda.</p>}
          {chatMessages.map((msg) => {
            const isOperator = msg.authorRole === "OPERADOR";
            const isBot = msg.authorRole === "BOT";
            return (
              <div key={msg.id} className={`flex ${isOperator ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                    isOperator ? "bg-emerald/15 text-ink" : isBot ? "bg-brass/15 text-ink" : "bg-ink/10 text-ink"
                  }`}
                >
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate">
                    {isOperator ? "Operador" : isBot ? "Bot" : "Cliente"}
                  </p>
                  <p className="mt-1">{msg.body}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-col gap-3 md:flex-row">
          <Input
            placeholder="Responder ao cliente"
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            disabled={chatLoading || chatDisabled}
          />
          <Button className="bg-ink" onClick={sendChatMessage} disabled={chatLoading || chatDisabled}>
            {chatLoading ? "Enviando..." : "Enviar"}
          </Button>
        </div>
      </Card>

      {showDetails && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-6">
          <div className="w-full max-w-screen-2xl rounded-2xl bg-white p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Dados do cliente</h2>
              <button
                type="button"
                className="rounded-full bg-slate/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate"
                onClick={() => setShowDetails(false)}
              >
                Fechar
              </button>
            </div>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-ink">Dados empresariais</h3>
                <ul className="mt-2 space-y-2 text-sm text-slate">
                  <li>Razão social 1: {formatValue(step2.razaoSocial1)}</li>
                  <li>Razão social 2: {formatValue(step2.razaoSocial2)}</li>
                  <li>Razão social 3: {formatValue(step2.razaoSocial3)}</li>
                  <li>Município: {formatValue(step2.municipio)}</li>
                  <li>E-mail CNPJ: {formatValue(step2.emailCnpj)}</li>
                  <li>Telefone CNPJ: {formatValue(step2.telefoneCnpj)}</li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink">Endereço</h3>
                <ul className="mt-2 space-y-2 text-sm text-slate">
                  <li>CEP: {formatValue(step2.endereco?.cep)}</li>
                  <li>Endereço: {formatValue(step2.endereco?.endereco)}</li>
                  <li>Número: {formatValue(step2.endereco?.numero)}</li>
                  <li>Complemento: {formatValue(step2.endereco?.complemento)}</li>
                  <li>Bairro: {formatValue(step2.endereco?.bairro)}</li>
                  <li>Cidade: {formatValue(step2.endereco?.cidade)}</li>
                  <li>UF: {formatValue(step2.endereco?.uf)}</li>
                  <li>IPTU: {formatValue(step2.endereco?.iptu)}</li>
                  <li>Endereço virtual: {formatValue(step2.endereco?.escritorioVirtual)}</li>
                </ul>
              </div>
            </div>
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-ink">Quadro societário</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {sociosList.map((socio: any, index: number) => (
                  <div key={index} className="rounded-xl border border-ink/10 bg-white/80 p-3 text-sm text-slate">
                    <p className="text-sm font-semibold text-ink">Sócio {index + 1}</p>
                    <p>Nome: {formatValue(socio?.socioNome)}</p>
                    <p>CPF: {formatValue(socio?.socioCpf)}</p>
                    <p>E-mail: {formatValue(socio?.socioEmail)}</p>
                    <p>Telefone: {formatValue(socio?.socioTelefone)}</p>
                    <p>Participação: {formatValue(socio?.socioPercentual)}</p>
                    <p>Estado civil: {formatValue(socio?.socioEstadoCivil)}</p>
                    <p>Profissão: {formatValue(socio?.socioProfissao)}</p>
                    <p>Regime de casamento: {formatValue(socio?.socioRegimeCasamento)}</p>
                    <p>Administrador: {formatValue(socio?.socioAdministrador)}</p>
                    <p>Resp. CNPJ: {formatValue(socio?.responsavelCnpj)}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-ink">Aprovação dos campos do cliente</h3>
              <p className="mt-1 text-xs text-slate">Use 👍 para aprovar e 👎 para reprovar.</p>
              <div className="mt-3 space-y-3">
                {approvalFields.map((field) => (
                  <div key={field.key} className="flex items-center justify-between rounded-xl border border-ink/10 bg-white/80 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{field.label}</p>
                      <p className="text-xs text-slate">{formatValue(field.value)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className={clsx(
                          "inline-flex h-9 w-9 items-center justify-center rounded-full text-lg",
                          fieldDecisions[field.key] === "approved" ? "bg-emerald text-white" : "bg-emerald/10 text-emerald"
                        )}
                        onClick={() => setDecision(field.key, "approved")}
                        disabled={!step2Enabled}
                        aria-label="Aprovar campo"
                      >
                        👍
                      </button>
                      <button
                        type="button"
                        className={clsx(
                          "inline-flex h-9 w-9 items-center justify-center rounded-full text-lg",
                          fieldDecisions[field.key] === "rejected" ? "bg-clay text-white" : "bg-clay/10 text-clay"
                        )}
                        onClick={() => {
                          setDecision(field.key, "rejected");
                          setRejectReason("");
                          setRejectModal({ type: "fields", fields: [field.key] });
                        }}
                        disabled={!step2Enabled}
                        aria-label="Reprovar campo"
                      >
                        👎
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  className="bg-emerald"
                  onClick={() => setFieldDecisions(Object.fromEntries(approvalFields.map((f) => [f.key, "approved"])))}
                  disabled={!step2Enabled}
                >
                  Aprovar todos
                </Button>
                <Button
                  className="bg-clay"
                  onClick={() => {
                    setFieldDecisions(Object.fromEntries(approvalFields.map((f) => [f.key, "rejected"])));
                    setRejectReason("");
                    setRejectModal({ type: "fields", fields: approvalFields.map((f) => f.key) });
                  }}
                  disabled={!step2Enabled}
                >
                  Reprovar todos
                </Button>
                <Button
                  className="bg-ink"
                  onClick={() => {
                    const rejected = getRejectedFields(approvalFields.map((f) => f.key));
                    if (rejected.length === 0) {
                      notifySuccess("Nenhum campo reprovado.");
                      return;
                    }
                    setRejectReason("");
                    setRejectModal({ type: "fields", fields: rejected });
                  }}
                  disabled={!step2Enabled}
                >
                  Enviar reprovações
                </Button>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold text-ink">Documentos anexados</h3>
              <p className="mt-1 text-xs text-slate">Aprove/reprove com 👍/👎 e informe o motivo.</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {documentos.map((doc: any) => (
                  <div key={doc.id} className="rounded-xl border border-ink/10 bg-white/80 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">
                          {doc.itemKey}
                          {doc.socioId ? ` · ${socioMap.get(doc.socioId) ?? "Sócio"}` : ""}
                        </p>
                        <p className="text-xs text-slate">Status: {doc.status}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className={clsx(
                            "inline-flex h-9 w-9 items-center justify-center rounded-full text-lg",
                            resolveDocStatus(doc) === "APROVADO"
                              ? "bg-emerald text-white"
                              : "bg-emerald/10 text-emerald"
                          )}
                          onClick={() => validateDocument(doc.itemKey, doc.socioId, "APROVADO")}
                          disabled={docLoading === buildDocumentKey(doc.itemKey, doc.socioId)}
                          aria-label="Aprovar documento"
                        >
                          👍
                        </button>
                        <button
                          type="button"
                          className={clsx(
                            "inline-flex h-9 w-9 items-center justify-center rounded-full text-lg",
                            resolveDocStatus(doc) === "REPROVADO"
                              ? "bg-clay text-white"
                              : "bg-clay/10 text-clay"
                          )}
                          onClick={() => {
                            setRejectReason("");
                            setRejectModal({ type: "document", documentKey: doc.itemKey, documentSocioId: doc.socioId });
                          }}
                          disabled={docLoading === buildDocumentKey(doc.itemKey, doc.socioId)}
                          aria-label="Reprovar documento"
                        >
                          👎
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      {(doc.files ?? []).length === 0 && <p className="text-xs text-slate">Sem anexos</p>}
                      {(doc.files ?? []).map((file: any) => (
                        <div key={file.id} className="flex items-center justify-between gap-3">
                          <span className="text-xs text-slate">{file.fileName}</span>
                          <Button className="bg-ink" onClick={() => setSelectedFile({ itemKey: doc.itemKey, file })}>
                            Visualizar
                          </Button>
                        </div>
                      ))}
                    </div>

                  </div>
                ))}
              </div>
              {isVirtual && (
                <div className="mt-4 rounded-xl border border-emerald/30 bg-emerald/5 p-3">
                  <p className="text-sm font-semibold text-ink">Foto da fachada (endereço virtual)</p>
                  <p className="text-xs text-slate">Anexe a fachada após a submissão do cliente.</p>
                  <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
                    <Input
                      type="file"
                      multiple
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={(event) => {
                        const files = event.target.files ? Array.from(event.target.files) : [];
                        setFachadaFiles(files);
                      }}
                    />
                    <Button
                      className="bg-emerald"
                      onClick={uploadFachada}
                      disabled={docLoading === "FOTO_FACHADA_UPLOAD"}
                    >
                      {docLoading === "FOTO_FACHADA_UPLOAD" ? "Enviando..." : "Enviar foto"}
                    </Button>
                  </div>
                  {fachadaError && <p className="mt-2 text-xs text-clay">{fachadaError}</p>}
                </div>
              )}
              <div className="mt-4">
                <Button className="bg-emerald" onClick={approveAllDocs} disabled={docLoading === "ALL"}>
                  Aprovar todos os documentos
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 py-6">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Motivo da reprovação</h2>
              <button
                type="button"
                className="rounded-full bg-slate/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate"
                onClick={() => setRejectModal(null)}
              >
                Fechar
              </button>
            </div>
            <p className="mt-2 text-sm text-slate">Esse motivo será enviado ao cliente.</p>
            <div className="mt-4">
              <Input
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                placeholder="Descreva o motivo"
              />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <Button
                className="bg-clay"
                onClick={async () => {
                  if (rejectModal.type === "document" && rejectModal.documentKey) {
                    await validateDocument(
                      rejectModal.documentKey,
                      rejectModal.documentSocioId,
                      "REPROVADO",
                      rejectReason
                    );
                  }
                  if (rejectModal.type === "fields" && rejectModal.fields?.length) {
                    await sendCorrection(rejectModal.fields, rejectReason);
                  }
                  setRejectReason("");
                  setRejectModal(null);
                }}
              >
                Enviar reprovação
              </Button>
              <button
                type="button"
                className="rounded-full bg-slate/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate"
                onClick={() => setRejectModal(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 py-6">
          <div className="w-full max-w-6xl rounded-2xl bg-white p-4 shadow-soft xl:max-w-[1100px] 2xl:max-w-[1280px]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Visualizador de documento</h2>
              <button
                type="button"
                className="rounded-full bg-slate/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate"
                onClick={() => setSelectedFile(null)}
              >
                Fechar
              </button>
            </div>
            <div className="mt-4 h-[72vh] w-full overflow-hidden rounded-xl border border-ink/10 bg-white xl:h-[78vh] 2xl:h-[82vh]">
              {selectedFile.file.mimeType === "application/pdf" ? (
                <iframe
                  className="h-full w-full"
                  src={`${API_BASE}/documents/${processId}/items/${selectedFile.itemKey}/preview/${selectedFile.file.id}`}
                />
              ) : (
                <img
                  alt={selectedFile.file.fileName}
                  className="h-full w-full object-contain"
                  src={`${API_BASE}/documents/${processId}/items/${selectedFile.itemKey}/preview/${selectedFile.file.id}`}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
