"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { FiArrowLeft, FiCheckCircle, FiClock, FiDownload, FiFileText, FiSend, FiShield, FiUpload } from "react-icons/fi";
import { api } from "@/lib/api";
import { Button } from "@/components/Button";
import { WorkspaceNav } from "@/components/WorkspaceNav";

type ContractFile = { id: string; fileName: string; mimeType: string; createdAt: string };
type ContractExport = { id: string; format: string; version: number; fileName: string; createdAt: string };
type Contract = { id: string; title: string; status: string; currentVersion: number; versions: Array<{ id: string; version: number; status: string; content: unknown }>; files?: ContractFile[]; exports?: ContractExport[] };
type DocumentItem = { id: string; itemKey: string; status: string; updatedAt?: string; files: Array<{ id: string; fileName: string; mimeType: string; size: number; createdAt: string }> };
type HistoryItem = { id: string; action: string; actorRole: string; actorEmail?: string; metadata?: unknown; createdAt: string };
type Process = {
  id: string;
  clientName?: string;
  clientEmail: string;
  companyKey?: string;
  createdAt: string;
  finalizedAt?: string;
  owner?: { name: string };
  finalization?: { finalizedAt: string; finalizedById?: string; previousStatus?: string };
  contracts: Contract[];
  documents: DocumentItem[];
  reports?: Array<{ id: string; fileName: string; mimeType: string; createdAt: string }>;
  history?: HistoryItem[];
};

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}
function formatCnpj(value?: string) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length === 14 ? digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : value || "CNPJ não informado";
}
function duration(createdAt?: string, finalizedAt?: string) {
  if (!createdAt || !finalizedAt) return "—";
  const hours = Math.max(0, Math.round((new Date(finalizedAt).getTime() - new Date(createdAt).getTime()) / 3_600_000));
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const remaining = hours % 24;
  return remaining ? `${days}d ${remaining}h` : `${days}d`;
}
function actionLabel(action: string) {
  const labels: Record<string, string> = { process_created: "Processo criado", client_submitted: "Dados recebidos do cliente", approve_step: "Etapa aprovada", kanban_stage_updated: "Etapa atualizada no Kanban", process_completed: "Processo finalizado", contract_created: "Documento criado", contract_uploaded: "Documento convertido" };
  return labels[action] ?? action.replaceAll("_", " ");
}
function fileUrl(contractId: string, fileId: string) { return `/api/completed-processes/contracts/${contractId}/files/${fileId}`; }
function exportUrl(contractId: string, exportId: string) { return `/api/completed-processes/contracts/${contractId}/exports/${exportId}`; }

export default function CompletedProcessPage({ params }: { params: { id: string } }) {
  const [process, setProcess] = useState<Process | null>(null);
  const [selected, setSelected] = useState<Contract | null>(null);
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const [saveState, setSaveState] = useState<"salvo" | "alterado" | "salvando" | "erro">("salvo");
  const dirtyRef = useRef(false);

  useEffect(() => {
    void api<Process>(`/completed-processes/${params.id}`).then(setProcess).catch((e) => setMessage(e instanceof Error ? e.message : "Erro ao carregar o processo finalizado."));
  }, [params.id]);

  function open(contract: Contract) {
    setSelected(contract);
    setContent(JSON.stringify(contract.versions[0]?.content ?? { type: "doc", content: [] }, null, 2));
    dirtyRef.current = false;
    setSaveState("salvo");
  }
  async function save() {
    if (!selected || !dirtyRef.current) return;
    setSaveState("salvando");
    try {
      const saved = await api<{ version: number }>(`/completed-processes/contracts/${selected.id}`, { method: "PUT", body: JSON.stringify({ content: JSON.parse(content), expectedVersion: selected.currentVersion }) });
      setSelected((old) => old ? { ...old, currentVersion: saved.version } : old);
      dirtyRef.current = false;
      setSaveState("salvo");
      setMessage("Versão salva.");
    } catch (e) {
      setSaveState("erro");
      setMessage(e instanceof Error ? e.message : "Erro ao salvar.");
    }
  }
  useEffect(() => {
    if (!selected || !dirtyRef.current) return;
    const timer = window.setTimeout(() => void save(), 1200);
    return () => window.clearTimeout(timer);
  }, [content, selected]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (dirtyRef.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
  function updateEditor(next: string) { setContent(next); dirtyRef.current = true; setSaveState("alterado"); }
  function applyBlock(type: "paragraph" | "heading") {
    try {
      const doc = JSON.parse(content);
      if (doc.content?.[0]) { doc.content[0].type = type; if (type === "heading") doc.content[0].attrs = { level: 2 }; else delete doc.content[0].attrs; updateEditor(JSON.stringify(doc, null, 2)); }
    } catch { setMessage("Corrija o JSON estruturado antes de formatar."); }
  }
  async function createBlank() {
    try { const result = await api<Contract>(`/completed-processes/${params.id}/contracts/blank`, { method: "POST", body: JSON.stringify({ title: "Nova alteração contratual" }) }); setProcess((old) => old ? { ...old, contracts: [...old.contracts, result] } : old); open(result); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Erro ao criar documento."); }
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData(); form.append("file", file); setUploading(true);
    try { const result = await api<Contract>(`/completed-processes/${params.id}/contracts/upload`, { method: "POST", body: form }); setProcess((old) => old ? { ...old, contracts: [...old.contracts, result] } : old); open(result); setMessage("Documento convertido e preservado como original."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Erro ao converter documento."); }
    finally { setUploading(false); event.target.value = ""; }
  }
  function prepareExport() { setExportMessage("Exportação preparada. O webhook da Central de clientes ainda está em desenvolvimento e nenhum dado foi enviado."); }

  if (!process) return <main className="app-container completed-page completed-loading"><WorkspaceNav role="operator" /><Link href="/operator/processos-finalizados" className="completed-back"><FiArrowLeft aria-hidden="true" /> Voltar para processos finalizados</Link><section className="completed-state" role={message ? "alert" : "status"}>{message || "Carregando processo finalizado..."}</section></main>;

  const finalizedAt = process.finalization?.finalizedAt ?? process.finalizedAt;
  const history = process.history ?? [];

  return (
    <div className="operator-workspace completed-workspace">
      <WorkspaceNav role="operator" />
      <main id="main-content" className="app-container completed-page completed-detail" tabIndex={-1}>
        <Link href="/operator/processos-finalizados" className="completed-back"><FiArrowLeft aria-hidden="true" /> Voltar para processos finalizados</Link>
        <header className="completed-detail-hero">
          <div><p className="operator-breadcrumb"><Link href="/operator/dashboard">Portal operador</Link> / Arquivo / Processo</p><span className="completed-eyebrow"><FiCheckCircle aria-hidden="true" /> Processo concluído</span><h1>{process.clientName ?? "Processo finalizado"}</h1><p>{formatCnpj(process.companyKey)} · {process.clientEmail}</p></div>
          <button type="button" className="completed-export-button completed-export-button-large" onClick={prepareExport}><FiSend aria-hidden="true" /> Preparar exportação</button>
        </header>
        {exportMessage && <p className="completed-inline-message" role="status">{exportMessage}</p>}

        <section className="completed-detail-summary" aria-label="Resumo da conclusão"><div><FiClock aria-hidden="true" /><span>Tempo total</span><strong>{duration(process.createdAt, finalizedAt)}</strong></div><div><FiCheckCircle aria-hidden="true" /><span>Finalizado em</span><strong>{formatDate(finalizedAt)}</strong></div><div><FiShield aria-hidden="true" /><span>Responsável</span><strong>{process.owner?.name ?? "Operação"}</strong></div></section>

        <div className="completed-detail-grid">
          <section className="completed-panel"><div className="completed-panel-heading"><div><span className="completed-panel-kicker">Rastro operacional</span><h2>Histórico do processo</h2></div><span className="completed-panel-count">{history.length} eventos</span></div>{history.length === 0 ? <p className="completed-muted">O histórico detalhado ainda não foi registrado para este processo.</p> : <ol className="completed-timeline">{history.map((item) => <li key={item.id}><span className="completed-timeline-dot" aria-hidden="true" /><div><strong>{actionLabel(item.action)}</strong><p>{item.actorEmail || item.actorRole} · {formatDate(item.createdAt)}</p></div></li>)}</ol>}</section>
          <section className="completed-panel"><div className="completed-panel-heading"><div><span className="completed-panel-kicker">Identidade empresarial</span><h2>Dados preservados</h2></div><FiShield aria-hidden="true" /></div><dl className="completed-data-list"><div><dt>CNPJ</dt><dd>{formatCnpj(process.companyKey)}</dd></div><div><dt>Cliente</dt><dd>{process.clientName ?? "—"}</dd></div><div><dt>E-mail</dt><dd>{process.clientEmail}</dd></div><div><dt>Início do processo</dt><dd>{formatDate(process.createdAt)}</dd></div></dl></section>
        </div>

        <section className="completed-panel completed-documents-panel"><div className="completed-panel-heading"><div><span className="completed-panel-kicker">Preservação documental</span><h2>Documentação final gerada</h2><p>Arquivos recebidos e documentos produzidos durante o atendimento.</p></div><span className="completed-panel-count">{process.documents.length + process.contracts.length} itens</span></div>{process.documents.length === 0 && process.contracts.length === 0 && <p className="completed-muted">Nenhum documento final foi anexado a este processo.</p>}<div className="completed-document-groups">{process.documents.map((document) => <div className="completed-document-row" key={document.id}><span className="completed-document-icon"><FiFileText aria-hidden="true" /></span><div><strong>{document.itemKey.replaceAll("_", " ")}</strong><p>Status: {document.status.toLowerCase()}</p></div><div className="completed-document-links">{document.files.map((file) => <a key={file.id} href={`/api/documents/${process.id}/items/${document.itemKey}/download/${file.id}`}><FiDownload aria-hidden="true" /> {file.fileName}</a>)}</div></div>)}{process.contracts.map((contract) => <div className="completed-document-row" key={contract.id}><span className="completed-document-icon"><FiFileText aria-hidden="true" /></span><div><strong>{contract.title}</strong><p>{contract.status} · versão {contract.currentVersion}</p></div><div className="completed-document-links">{(contract.files ?? []).map((file) => <a key={file.id} href={fileUrl(contract.id, file.id)}><FiDownload aria-hidden="true" /> {file.fileName}</a>)}{(contract.exports ?? []).map((file) => <a key={file.id} href={exportUrl(contract.id, file.id)}><FiDownload aria-hidden="true" /> {file.fileName}</a>)}<button type="button" onClick={() => open(contract)}>Abrir editor</button></div></div>)}</div></section>

        <section className="completed-panel completed-editor-panel"><div className="completed-panel-heading"><div><span className="completed-panel-kicker">Manutenção documental</span><h2>Contratos e alterações</h2></div><div className="completed-editor-actions"><Button variant="accent" onClick={() => void createBlank()}><FiFileText aria-hidden="true" /> Novo documento</Button><label className="completed-upload-button"><FiUpload aria-hidden="true" /> {uploading ? "Convertendo..." : "Enviar PDF/DOCX"}<input className="sr-only" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => void upload(event)} disabled={uploading} /></label></div></div><div className="completed-contract-list">{process.contracts.map((contract) => <button key={contract.id} type="button" className="completed-contract-card" onClick={() => open(contract)}><strong>{contract.title}</strong><span>{contract.status} · v{contract.currentVersion}</span></button>)}{process.contracts.length === 0 && <p className="completed-muted">Use uma das ações acima para iniciar um documento.</p>}</div></section>

        {selected && <section className="completed-panel completed-editor"><div className="completed-panel-heading"><div><span className="completed-panel-kicker">Edição segura</span><h2>{selected.title}</h2><p>Conteúdo canônico JSON com salvamento automático e controle de versão.</p></div><span className="completed-save-state" role="status">{saveState === "salvando" ? "Salvando..." : saveState === "salvo" ? "Salvo" : saveState === "erro" ? "Erro ao salvar" : "Alterações pendentes"}</span></div><div className="completed-editor-tools"><Button variant="ghost" onClick={() => applyBlock("paragraph")}>Parágrafo</Button><Button variant="ghost" onClick={() => applyBlock("heading")}>Título</Button></div><textarea aria-label="Conteúdo estruturado editável" value={content} onChange={(event) => updateEditor(event.target.value)} /><div className="completed-editor-footer"><Button variant="accent" onClick={() => void save()}>Salvar agora</Button><Button variant="ghost" onClick={() => setSelected(null)}>Fechar</Button></div></section>}
        {message && <p className="completed-inline-message" role="status">{message}</p>}
      </main>
    </div>
  );
}
