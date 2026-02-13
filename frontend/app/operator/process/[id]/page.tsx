"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { DOCS_API_BASE, api } from "@/lib/api";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/Stepper";
import { Input } from "@/components/Input";
import { Logo } from "@/components/Logo";
import { Select } from "@/components/Select";
import { Field } from "@/components/Field";
import { notifyError, notifySuccess } from "@/lib/notify";
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [docLoading, setDocLoading] = useState<string | null>(null);
  const [fieldDecisions, setFieldDecisions] = useState<Record<string, "approved" | "rejected" | undefined>>({});
  const [docDecisions, setDocDecisions] = useState<Record<string, "APROVADO" | "REPROVADO" | undefined>>({});
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [fachadaFiles, setFachadaFiles] = useState<File[]>([]);
  const [fachadaError, setFachadaError] = useState<string | null>(null);
  const [sendingLink, setSendingLink] = useState(false);
  const [sendingOtpOnly, setSendingOtpOnly] = useState(false);
  const [validatingProcess, setValidatingProcess] = useState(false);
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
    setDocDecisions(
      Object.fromEntries(
        (process.documents ?? [])
          .filter((doc: any) => doc.status === "APROVADO" || doc.status === "REPROVADO")
          .map((doc: any) => [buildDocumentKey(doc.itemKey, doc.socioId), doc.status])
      )
    );
  }, [process]);

  // Fetch preview as a blob with credentials. This avoids iframe auth edge cases in some browsers/environments.
  useEffect(() => {
    let active = true;
    let objectUrlToRevoke: string | null = null;

    async function loadPreview() {
      if (!selectedFile) return;
      setPreviewLoading(true);
      setPreviewError(null);
      setPreviewUrl(null);
      try {
        const endpoint = `${DOCS_API_BASE}/documents/${processId}/items/${selectedFile.itemKey}/preview/${selectedFile.file.id}`;
        const response = await fetch(endpoint, { credentials: "include" });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || `Erro ao carregar documento (${response.status}).`);
        }
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        objectUrlToRevoke = objectUrl;
        if (!active) return;
        setPreviewUrl(objectUrl);
      } catch (err: any) {
        if (!active) return;
        const msg = err?.message || "Erro ao carregar documento.";
        setPreviewError(msg);
        notifyError(msg);
      } finally {
        if (active) setPreviewLoading(false);
      }
    }

    if (!selectedFile) {
      setPreviewLoading(false);
      setPreviewError(null);
      setPreviewUrl(null);
      return () => {};
    }

    void loadPreview();
    return () => {
      active = false;
      if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
    };
  }, [DOCS_API_BASE, processId, selectedFile?.itemKey, selectedFile?.file?.id]);

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
    const items = docsForChecklist.map((doc: any) => ({ itemKey: doc.itemKey, socioId: doc.socioId }));
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

  function step3IsComplete() {
    return Boolean(step3.tipoAtividade && step3.naturezaJuridica && step3.capitalSocial && step3.cnae && step3.tributacao);
  }

  async function updateStep3() {
    setMessage(null);
    if (!step3IsComplete()) {
      setMessage("Preencha todos os campos obrigatórios da estrutura jurídica.");
      return;
    }
    await api(`/processes/${processId}/steps`, {
      method: "PUT",
      body: JSON.stringify({ stepKey: "ETAPA_3", data: step3 })
    });
    setMessage("Estrutura jurídica salva.");
    notifySuccess("Estrutura jurídica salva.");
    load();
  }

  async function markAsValidated() {
    setMessage(null);
    if (!step3IsComplete()) {
      setMessage("Preencha todos os campos obrigatórios da estrutura jurídica antes de validar.");
      return;
    }
    if (!approvalsComplete) {
      setMessage("Aprove todos os campos e documentos do cliente antes de validar.");
      return;
    }

    setValidatingProcess(true);
    try {
      await api(`/processes/${processId}/steps`, {
        method: "PUT",
        body: JSON.stringify({ stepKey: "ETAPA_3", data: step3 })
      });
      await api(`/processes/${processId}/kanban-stage`, {
        method: "PATCH",
        body: JSON.stringify({ kanbanStage: "DOC_INICIAL_APROVADA" })
      });
      notifySuccess("Processo validado e movido para Doc. Inicial Aprovada.");
      await load();
    } finally {
      setValidatingProcess(false);
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

  async function resendOtpOnly() {
    setSendingOtpOnly(true);
    try {
      await api(`/processes/${processId}/send-otp`, {
        method: "POST"
      });
      notifySuccess("Novo OTP enviado ao e-mail do cliente.");
    } finally {
      setSendingOtpOnly(false);
    }
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
      const response = await fetch(`${DOCS_API_BASE}/documents/${processId}/items/FOTO_FACHADA/upload`, {
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
  // When the address is virtual, `FOTO_FACHADA` is an internal attachment and should not block
  // client checklist completion (and should not be shown as "sent by the client").
  const docsForChecklist = isVirtual ? documentos.filter((doc: any) => doc.itemKey !== "FOTO_FACHADA") : documentos;

  const approvalsComplete =
    approvalFields.every((field) => fieldDecisions[field.key] === "approved") &&
    docsForChecklist.every((doc: any) => resolveDocStatus(doc) === "APROVADO");
  const fieldsApprovedCount = approvalFields.filter((field) => fieldDecisions[field.key] === "approved").length;
  const fieldsRejectedCount = approvalFields.filter((field) => fieldDecisions[field.key] === "rejected").length;
  const docsApprovedCount = docsForChecklist.filter((doc: any) => resolveDocStatus(doc) === "APROVADO").length;
  const docsRejectedCount = docsForChecklist.filter((doc: any) => resolveDocStatus(doc) === "REPROVADO").length;

  const getClientFiles = (doc: any) =>
    (doc.files ?? []).filter((file: any) => !file.uploadedByRole || file.uploadedByRole === "CLIENTE");

  const docsWithClientFiles = docsForChecklist.map((doc: any) => ({
    ...doc,
    clientFiles: getClientFiles(doc)
  }));

  const clientSentDocs = docsWithClientFiles.filter((doc: any) => (doc.clientFiles ?? []).length > 0);
  const clientMissingDocs = docsWithClientFiles.filter((doc: any) => (doc.clientFiles ?? []).length === 0);
  const step3Enabled = process.currentStep === "ETAPA_3" || (step2Enabled && approvalsComplete);
  const persistedStep3 = getStepData(process, "ETAPA_3");
  const canViewDocuments =
    Boolean(persistedStep3.tipoAtividade) &&
    Boolean(persistedStep3.naturezaJuridica) &&
    Boolean(persistedStep3.capitalSocial) &&
    Boolean(persistedStep3.cnae) &&
    Boolean(persistedStep3.tributacao);
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
              {sendingLink ? "Enviando link..." : "Enviar novo link + OTP"}
            </Button>
            <Button variant="primary" onClick={resendOtpOnly} disabled={sendingOtpOnly}>
              {sendingOtpOnly ? "Enviando OTP..." : "Enviar apenas novo OTP"}
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
          <p className="text-sm text-slate">Aprove campos e documentos para concluir a validação inicial.</p>
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
              ) : docsForChecklist.length > 0 && docsApprovedCount === docsForChecklist.length ? (
                <FiCheckCircle className="mt-0.5 h-5 w-5 text-emerald" />
              ) : (
                <FiCheckCircle className="mt-0.5 h-5 w-5 text-slate/50" />
              )}
              <div>
                <p className="text-sm font-semibold text-ink">Documentos</p>
                <p className="text-xs text-slate">
                  {docsApprovedCount}/{docsForChecklist.length} aprovados
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
              <option value="Comrcio">Comércio</option>
              <option value="Servio">Serviço</option>
              <option value="Comrcio e Servio">Comércio e Serviço</option>
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
              <option value="Sociedade Propsito Especfico - SPE">Sociedade Propósito Específico - SPE</option>
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
          <Button
            variant="accent"
            onClick={markAsValidated}
            disabled={!step3Enabled || !approvalsComplete || !step3IsComplete() || validatingProcess}
          >
            {validatingProcess ? "Validando..." : "Validado"}
          </Button>
          {canViewDocuments && (
            <Button variant="primary" onClick={() => router.push(`/operator/process/${processId}/review`)}>
              Visualizar documentos
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
                <p className="mt-0.5 text-xs text-slate">Processo {process.id} · Etapa {process.currentStep}</p>
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
                          {docsApprovedCount}/{docsForChecklist.length} aprovados
                        </p>
                        {docsRejectedCount > 0 && <p className="text-xs text-clay">{docsRejectedCount} reprovados</p>}
                      </div>
                    </div>
                    {!approvalsComplete && (
                      <p className="mt-3 text-xs text-slate">
                        Para avançar, aprove todos os campos e documentos (ou solicite correção quando necessário).
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-ink/10 bg-white/80 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">Ações rápidas</p>
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
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">Razão social 1</dt>
                          <dd className="mt-1 text-ink">{formatValue(step2.razaoSocial1)}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">Razão social 2</dt>
                          <dd className="mt-1 text-ink">{formatValue(step2.razaoSocial2)}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">Razão social 3</dt>
                          <dd className="mt-1 text-ink">{formatValue(step2.razaoSocial3)}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">Município</dt>
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
                      <h3 className="text-sm font-semibold text-ink">Endereço</h3>
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
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">Número</dt>
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
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">Endereço virtual</dt>
                          <dd className="mt-1 text-ink">{formatValue(step2.endereco?.escritorioVirtual)}</dd>
                        </div>
                      </dl>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold text-ink">Quadro societário</h3>
                    <p className="mt-1 text-xs text-slate">Conferência rápida dos dados informados.</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {sociosList.map((socio: any, index: number) => (
                        <div key={index} className="rounded-2xl border border-ink/10 bg-white/80 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-ink">Sócio {index + 1}</p>
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
                              <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">Profissão</dt>
                              <dd className="mt-1 text-ink">{formatValue(socio?.socioProfissao)}</dd>
                            </div>
                            <div className="sm:col-span-2">
                              <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">Regime de casamento</dt>
                              <dd className="mt-1 text-ink">{formatValue(socio?.socioRegimeCasamento)}</dd>
                            </div>
                            <div className="sm:col-span-2">
                              <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate">Responsável CNPJ</dt>
                              <dd className="mt-1 text-ink">{formatValue(socio?.responsavelCnpj)}</dd>
                            </div>
                          </dl>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold text-ink">Aprovação dos campos do cliente</h3>
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
                        Enviar reprovações
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
                      {clientSentDocs.map((doc: any) => {
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
                                  {doc.socioId ? ` · ${socioMap.get(doc.socioId) ?? "Sócio"}` : ""}
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
                              {(doc.clientFiles ?? []).map((file: any) => (
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

                    {clientSentDocs.length === 0 && (
                      <div className="mt-3 rounded-2xl border border-ink/10 bg-slate/5 p-4 text-sm text-slate">
                        <p className="font-semibold text-ink">Nenhum documento enviado pelo cliente apareceu aqui.</p>
                        <p className="mt-1 text-xs">
                          Se o cliente disse que enviou, o mais comum é a sessão ter expirado ou o upload ter falhado.
                          Peça para ele recarregar a página e reenviar.
                        </p>
                      </div>
                    )}

                    {clientMissingDocs.length > 0 && (
                      <div className="mt-3 rounded-2xl border border-ink/10 bg-white/80 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">Pendências</p>
                        <ul className="mt-2 space-y-1 text-sm text-slate">
                          {clientMissingDocs.map((doc: any) => (
                            <li key={doc.id} className="flex items-center justify-between gap-3">
                              <span className="truncate">
                                {doc.itemKey}
                                {doc.socioId ? ` · ${socioMap.get(doc.socioId) ?? "Sócio"}` : ""}
                              </span>
                              <span className="rounded-full bg-brass/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink">
                                Sem anexo
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {isVirtual && (
                      <div className="mt-4 rounded-2xl border border-emerald/30 bg-emerald/5 p-4">
                        <p className="text-sm font-semibold text-ink">Foto da fachada (endereço virtual)</p>
                        <p className="mt-1 text-xs text-slate">Anexe a fachada após a submissão do cliente.</p>
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
              {previewLoading && <div className="grid h-full w-full place-items-center text-sm text-slate">Carregando...</div>}
              {!previewLoading && previewError && (
                <div className="grid h-full w-full place-items-center p-6 text-center">
                  <div>
                    <p className="text-sm font-semibold text-ink">Não foi possível abrir o documento.</p>
                    <p className="mt-1 text-xs text-slate">{previewError}</p>
                    <div className="mt-4 flex justify-center gap-3">
                      <Button variant="primary" onClick={() => setSelectedFile(null)}>
                        Fechar
                      </Button>
                      <a
                        className="inline-flex items-center justify-center rounded-xl border border-ink/15 px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.14em] text-ink shadow-lift transition hover:-translate-y-0.5 hover:border-brass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/40"
                        href={`${DOCS_API_BASE}/documents/${processId}/items/${selectedFile.itemKey}/download/${selectedFile.file.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Baixar
                      </a>
                    </div>
                  </div>
                </div>
              )}
              {!previewLoading && !previewError && previewUrl && (
                <>
                  {selectedFile.file.mimeType === "application/pdf" ? (
                    <iframe className="h-full w-full" src={previewUrl} />
                  ) : (
                    <img alt={selectedFile.file.fileName} className="h-full w-full object-contain" src={previewUrl} />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
