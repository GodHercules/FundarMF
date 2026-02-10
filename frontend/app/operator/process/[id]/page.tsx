"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { FiCheck, FiCheckCircle, FiX, FiXCircle } from "react-icons/fi";

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
  const normalized = { ...defaults } as Record<string, string>;
  (Object.keys(defaults) as Array<keyof T>).forEach((key) => {
    const value = data[key as string];
    if (typeof value === "string") normalized[key as string] = value;
    if (typeof value === "number") normalized[key as string] = String(value);
  });
  return normalized as T;
}

export default function OperatorProcess() {
  const params = useParams();
  const router = useRouter();
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
    const [processData, chatData, documentsData] = await Promise.all([
      api<any>(`/processes/${processId}`),
      api<{ messages?: any[] }>(`/chats/${processId}`),
      api<any[]>(`/documents/${processId}/items`)
    ]);
    setProcess({ ...processData, documents: documentsData });
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
        ...Object.fromEntries(
          items.map((item: { itemKey: string; socioId?: string }) => [
            buildDocumentKey(item.itemKey, item.socioId),
            "APROVADO"
          ])
        )
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
    setMessage("Estrutura jurdica salva.");
    notifySuccess("Estrutura jurdica salva.");
    load();
  }

  function goToReceitaReview() {
    setMessage(null);
    router.push(`/operator/process/${processId}/review`);
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
      setMessage("Correes s podem ser enviadas quando a etapa atual  ETAPA_2.");
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
    notifySuccess("Correo solicitada.");
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
  const fieldsApprovedCount = approvalFields.filter((field) => fieldDecisions[field.key] === "approved").length;
  const fieldsRejectedCount = approvalFields.filter((field) => fieldDecisions[field.key] === "rejected").length;
  const docsApprovedCount = documentos.filter((doc: any) => resolveDocStatus(doc) === "APROVADO").length;
  const docsRejectedCount = documentos.filter((doc: any) => resolveDocStatus(doc) === "REPROVADO").length;
  const step3Enabled = process.currentStep === "ETAPA_3" || (step2Enabled && approvalsComplete);
  const canReviewForReceita = approvalsComplete && step3Saved;
  const chatDisabled = ["CANCELADO", "CONCLUIDO"].includes(process.status);

  return (
    <main className="app-container flex min-h-screen flex-col gap-8 py-10">
      <Link href="/operator/dashboard" className="text-sm font-semibold text-slate">
         Voltar
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
            <Button variant="primary" onClick={resendLink} disabled={sendingLink}>
              {sendingLink ? "Enviando link..." : "Enviar link ao cliente"}
            </Button>
            <Button variant="danger" onClick={cancelProcess}>
              Cancelar processo
            </Button>
          </div>
        </div>
      </header>

      {message && <p className="text-sm text-slate">{message}</p>}

      <section className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Checklist</h2>
          <p className="text-sm text-slate">Aprove campos e documentos. Envie para Receita quando tudo estiver OK.</p>
          <div className="mt-4 grid gap-3 rounded-2xl border border-ink/10 bg-white/70 p-4 text-sm text-slate sm:grid-cols-2">
            <div className="flex items-start gap-3">
              {fieldsRejectedCount > 0 ? (
                <FiXCircle className="mt-0.5 h-5 w-5 text-clay" />
              ) : fieldsApprovedCount === approvalFields.length ? (
                <FiCheckCircle className="mt-0.5 h-5 w-5 text-emerald" />
              ) : (
                <FiCheckCircle className="mt-0.5 h-5 w-5 text-slate/50" />
              )}
              <div>
                <p className="text-sm font-semibold text-ink">Campos do cliente</p>
                <p className="text-xs text-slate">
                  {fieldsApprovedCount}/{approvalFields.length} aprovados
                  {fieldsRejectedCount > 0 ? ` · ${fieldsRejectedCount} reprovados` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              {docsRejectedCount > 0 ? (
                <FiXCircle className="mt-0.5 h-5 w-5 text-clay" />
              ) : documentos.length > 0 && docsApprovedCount === documentos.length ? (
                <FiCheckCircle className="mt-0.5 h-5 w-5 text-emerald" />
              ) : (
                <FiCheckCircle className="mt-0.5 h-5 w-5 text-slate/50" />
              )}
              <div>
                <p className="text-sm font-semibold text-ink">Documentos</p>
                <p className="text-xs text-slate">
                  {docsApprovedCount}/{documentos.length} aprovados
                  {docsRejectedCount > 0 ? ` · ${docsRejectedCount} reprovados` : ""}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="primary" onClick={() => setShowDetails(true)}>
              Ver dados do cliente
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Solicitar correção</h2>
          <p className="text-sm text-slate">A reprovação acontece dentro de Ver dados do cliente.</p>
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
              <option value="Comrcio">Comrcio</option>
              <option value="Servio">Servio</option>
              <option value="Comrcio e Servio">Comrcio e Servio</option>
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
              <option value="Sociedade empresaria Ltda">Sociedade empresria Ltda</option>
              <option value="Empresario individual">Empresrio individual</option>
              <option value="Sociedade individual de Advocacia">Sociedade individual de Advocacia</option>
              <option value="Sociedade Propsito Especfico - SPE">Sociedade Propsito Especfico - SPE</option>
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
          <Field label="Tributao" required>
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
          {canReviewForReceita && (
            <Button variant="accent" onClick={goToReceitaReview}>
              Revisar e enviar para Receita
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
          <Button variant="primary" onClick={sendChatMessage} disabled={chatLoading || chatDisabled}>
            {chatLoading ? "Enviando..." : "Enviar"}
          </Button>
        </div>
      </Card>

      {showDetails && (
        <div className="fixed inset-0 z-50 bg-ink/40 px-4 py-6">
          <div className="mx-auto flex h-[calc(100vh-48px)] w-full max-w-screen-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-soft">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-ink/10 bg-white/95 px-6 py-4 backdrop-blur">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold">Dados do cliente</h2>
                <p className="mt-0.5 text-xs text-slate">Processo {process.id} ? Etapa {process.currentStep}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="primary" onClick={resendLink} disabled={sendingLink}>
                  {sendingLink ? "Enviando..." : "Reenviar link"}
                </Button>
                <button
                  type="button"
                  className="rounded-full bg-slate/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate"
                  onClick={() => setShowDetails(false)}
                >
                  Fechar
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
                <aside className="space-y-4">
                  <div className="rounded-2xl border border-ink/10 bg-white/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">Resumo</p>
                    <div className="mt-3 grid gap-3">
                      <div className="rounded-xl border border-ink/10 bg-white/80 p-3">
                        <p className="text-xs text-slate">Campos do cliente</p>
                        <p className="mt-0.5 text-sm font-semibold text-ink">
                          {fieldsApprovedCount}/{approvalFields.length} aprovados
                        </p>
                        {fieldsRejectedCount > 0 && <p className="text-xs text-clay">{fieldsRejectedCount} reprovados</p>}
                      </div>
                      <div className="rounded-xl border border-ink/10 bg-white/80 p-3">
                        <p className="text-xs text-slate">Documentos</p>
                        <p className="mt-0.5 text-sm font-semibold text-ink">
                          {docsApprovedCount}/{documentos.length} aprovados
                        </p>
                        {docsRejectedCount > 0 && <p className="text-xs text-clay">{docsRejectedCount} reprovados</p>}
                      </div>
                    </div>
                    {!approvalsComplete && (
                      <p className="mt-3 text-xs text-slate">
                        Para avan?ar, aprove todos os campos e documentos (ou solicite corre??o quando necess?rio).
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-ink/10 bg-white/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">A??es r?pidas</p>
                    <div className="mt-3 flex flex-col gap-2">
                      <Button
                        className="bg-emerald"
                        onClick={() =>
                          setFieldDecisions(Object.fromEntries(approvalFields.map((f) => [f.key, "approved"])))
                        }
                        disabled={!step2Enabled}
                      >
                        Aprovar campos
                      </Button>
                      <Button variant="accent" onClick={approveAllDocs} disabled={docLoading === "ALL"}>
                        Aprovar documentos
                      </Button>
                      <Button className="bg-ink" onClick={() => setShowDetails(false)}>
                        Voltar ao processo
                      </Button>
                    </div>
                  </div>
                </aside>

                <div className="space-y-8">
                  <section className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-ink/10 bg-white/80 p-4">
                      <h3 className="text-sm font-semibold text-ink">Dados empresariais</h3>
                      <dl className="mt-3 grid gap-3 text-sm text-slate">
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">Raz?o social 1</dt>
                          <dd className="mt-1 text-ink">{formatValue(step2.razaoSocial1)}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">Raz?o social 2</dt>
                          <dd className="mt-1 text-ink">{formatValue(step2.razaoSocial2)}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">Raz?o social 3</dt>
                          <dd className="mt-1 text-ink">{formatValue(step2.razaoSocial3)}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">Munic?pio</dt>
                          <dd className="mt-1 text-ink">{formatValue(step2.municipio)}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">E-mail CNPJ</dt>
                          <dd className="mt-1 break-all text-ink">{formatValue(step2.emailCnpj)}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">Telefone CNPJ</dt>
                          <dd className="mt-1 text-ink">{formatValue(step2.telefoneCnpj)}</dd>
                        </div>
                      </dl>
                    </div>

                    <div className="rounded-2xl border border-ink/10 bg-white/80 p-4">
                      <h3 className="text-sm font-semibold text-ink">Endere?o</h3>
                      <dl className="mt-3 grid gap-3 text-sm text-slate">
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">CEP</dt>
                          <dd className="mt-1 text-ink">{formatValue(step2.endereco?.cep)}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">Logradouro</dt>
                          <dd className="mt-1 text-ink">{formatValue(step2.endereco?.endereco)}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">N?mero</dt>
                          <dd className="mt-1 text-ink">{formatValue(step2.endereco?.numero)}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">Complemento</dt>
                          <dd className="mt-1 text-ink">{formatValue(step2.endereco?.complemento)}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">Bairro</dt>
                          <dd className="mt-1 text-ink">{formatValue(step2.endereco?.bairro)}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">Cidade/UF</dt>
                          <dd className="mt-1 text-ink">
                            {formatValue(step2.endereco?.cidade)} / {formatValue(step2.endereco?.uf)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">IPTU</dt>
                          <dd className="mt-1 text-ink">{formatValue(step2.endereco?.iptu)}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">Endere?o virtual</dt>
                          <dd className="mt-1 text-ink">{formatValue(step2.endereco?.escritorioVirtual)}</dd>
                        </div>
                      </dl>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold text-ink">Quadro societ?rio</h3>
                    <p className="mt-1 text-xs text-slate">Confer?ncia r?pida dos dados informados.</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {sociosList.map((socio: any, index: number) => (
                        <div key={index} className="rounded-2xl border border-ink/10 bg-white/80 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-ink">S?cio {index + 1}</p>
                            <span className="rounded-full bg-brass/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink">
                              {formatValue(socio?.socioPercentual)}
                            </span>
                          </div>
                          <dl className="mt-3 grid gap-3 text-sm text-slate sm:grid-cols-2">
                            <div className="sm:col-span-2">
                              <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">Nome</dt>
                              <dd className="mt-1 text-ink">{formatValue(socio?.socioNome)}</dd>
                            </div>
                            <div>
                              <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">CPF</dt>
                              <dd className="mt-1 text-ink">{formatValue(socio?.socioCpf)}</dd>
                            </div>
                            <div>
                              <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">Administrador</dt>
                              <dd className="mt-1 text-ink">{formatValue(socio?.socioAdministrador)}</dd>
                            </div>
                            <div>
                              <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">E-mail</dt>
                              <dd className="mt-1 break-all text-ink">{formatValue(socio?.socioEmail)}</dd>
                            </div>
                            <div>
                              <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">Telefone</dt>
                              <dd className="mt-1 text-ink">{formatValue(socio?.socioTelefone)}</dd>
                            </div>
                            <div>
                              <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">Estado civil</dt>
                              <dd className="mt-1 text-ink">{formatValue(socio?.socioEstadoCivil)}</dd>
                            </div>
                            <div>
                              <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">Profiss?o</dt>
                              <dd className="mt-1 text-ink">{formatValue(socio?.socioProfissao)}</dd>
                            </div>
                            <div className="sm:col-span-2">
                              <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">Regime de casamento</dt>
                              <dd className="mt-1 text-ink">{formatValue(socio?.socioRegimeCasamento)}</dd>
                            </div>
                            <div className="sm:col-span-2">
                              <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">Respons?vel CNPJ</dt>
                              <dd className="mt-1 text-ink">{formatValue(socio?.responsavelCnpj)}</dd>
                            </div>
                          </dl>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold text-ink">Aprova??o dos campos do cliente</h3>
                    <p className="mt-1 text-xs text-slate">
                      Use <FiCheck className="inline h-4 w-4 align-[-2px]" /> para aprovar e{" "}
                      <FiX className="inline h-4 w-4 align-[-2px]" /> para reprovar.
                    </p>

                    <div className="mt-3 space-y-3">
                      {approvalFields.map((field) => (
                        <div
                          key={field.key}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white/80 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-ink">{field.label}</p>
                            <p className="truncate text-xs text-slate">{formatValue(field.value)}</p>
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
                              <FiCheck />
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
                              <FiX />
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
                        Enviar reprova??es
                      </Button>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold text-ink">Documentos anexados</h3>
                    <p className="mt-1 text-xs text-slate">
                      Aprove com <FiCheck className="inline h-4 w-4 align-[-2px]" /> e reprove com{" "}
                      <FiX className="inline h-4 w-4 align-[-2px]" />. Se reprovar, informe o motivo.
                    </p>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {documentos.map((doc: any) => {
                        const status = resolveDocStatus(doc);
                        const badge =
                          status === "APROVADO"
                            ? "bg-emerald/15 text-emerald"
                            : status === "REPROVADO"
                              ? "bg-clay/15 text-clay"
                              : status === "AGUARDANDO_VALIDACAO"
                                ? "bg-brass/15 text-ink"
                                : "bg-slate/10 text-slate";

                        return (
                          <div key={doc.id} className="rounded-2xl border border-ink/10 bg-white/80 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-ink">
                                  {doc.itemKey}
                                  {doc.socioId ? ` ? ${socioMap.get(doc.socioId) ?? "S?cio"}` : ""}
                                </p>
                                <span
                                  className={clsx(
                                    "mt-2 inline-flex w-fit rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
                                    badge
                                  )}
                                >
                                  {status || "PENDENTE"}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className={clsx(
                                    "inline-flex h-9 w-9 items-center justify-center rounded-full text-lg",
                                    status === "APROVADO" ? "bg-emerald text-white" : "bg-emerald/10 text-emerald"
                                  )}
                                  onClick={() => validateDocument(doc.itemKey, doc.socioId, "APROVADO")}
                                  disabled={docLoading === buildDocumentKey(doc.itemKey, doc.socioId)}
                                  aria-label="Aprovar documento"
                                >
                                  <FiCheck />
                                </button>
                                <button
                                  type="button"
                                  className={clsx(
                                    "inline-flex h-9 w-9 items-center justify-center rounded-full text-lg",
                                    status === "REPROVADO" ? "bg-clay text-white" : "bg-clay/10 text-clay"
                                  )}
                                  onClick={() => {
                                    setRejectReason("");
                                    setRejectModal({ type: "document", documentKey: doc.itemKey, documentSocioId: doc.socioId });
                                  }}
                                  disabled={docLoading === buildDocumentKey(doc.itemKey, doc.socioId)}
                                  aria-label="Reprovar documento"
                                >
                                  <FiX />
                                </button>
                              </div>
                            </div>

                            <div className="mt-4 space-y-2">
                              {(doc.files ?? []).length === 0 && (
                                <div className="rounded-xl border border-ink/10 bg-slate/5 p-3 text-xs text-slate">
                                  <p className="font-semibold text-ink">Nenhum anexo encontrado</p>
                                  <p className="mt-1">
                                    Se o cliente disse que enviou, pe?a para atualizar a p?gina e reenviar. Se persistir,
                                    verifique se a sess?o do cliente expirou (cookie em HTTP) ou se o PDF foi enviado como
                                    tipo gen?rico.
                                  </p>
                                </div>
                              )}
                              {(doc.files ?? []).map((file: any) => (
                                <div key={file.id} className="flex items-center justify-between gap-3">
                                  <span className="truncate text-xs text-slate">{file.fileName}</span>
                                  <Button variant="primary" onClick={() => setSelectedFile({ itemKey: doc.itemKey, file })}>
                                    Visualizar
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {isVirtual && (
                      <div className="mt-4 rounded-2xl border border-emerald/30 bg-emerald/5 p-4">
                        <p className="text-sm font-semibold text-ink">Foto da fachada (endere?o virtual)</p>
                        <p className="mt-1 text-xs text-slate">Anexe a fachada ap?s a submiss?o do cliente.</p>
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
                          <Button className="bg-emerald" onClick={uploadFachada} disabled={docLoading === "FOTO_FACHADA_UPLOAD"}>
                            {docLoading === "FOTO_FACHADA_UPLOAD" ? "Enviando..." : "Enviar foto"}
                          </Button>
                        </div>
                        {fachadaError && <p className="mt-2 text-xs text-clay">{fachadaError}</p>}
                      </div>
                    )}

                    <div className="mt-4">
                      <Button variant="accent" onClick={approveAllDocs} disabled={docLoading === "ALL"}>
                        Aprovar todos os documentos
                      </Button>
                    </div>
                  </section>
                </div>
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
            <p className="mt-2 text-sm text-slate">Esse motivo ser enviado ao cliente.</p>
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
