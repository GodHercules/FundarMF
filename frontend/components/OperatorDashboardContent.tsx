"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/Stepper";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { PhoneInput } from "@/components/PhoneInput";
import { WorkspaceNav } from "@/components/WorkspaceNav";
import { KANBAN_STAGES, KANBAN_STAGE_LABELS, KanbanStage } from "@/lib/kanban";
import { notifySuccess } from "@/lib/notify";

type ProcessSummary = {
  id: string;
  clientName?: string;
  status: string;
  currentStep: string;
  kanbanStage?: KanbanStage;
  updatedAt?: string;
  createdAt?: string;
};

type KanbanProcess = ProcessSummary & { kanbanEligible?: boolean };
type InAppNotification = { id: string; title: string; body: string; createdAt: string; readAt?: string | null; processId?: string | null; type: string };
type ProcessStartMode = "link" | "internal";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function formatDate(value?: string) {
  if (!value) return "Sem atualização";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Sem atualização" : dateFormatter.format(date);
}

function showInternalProcessLoader(target: Window) {
  const loadingDocument = target.document;
  loadingDocument.open();
  loadingDocument.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Preparando preenchimento</title><style>:root{font-family:system-ui,sans-serif}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f8f9fb;color:#121a29}.loading{display:grid;justify-items:center;gap:14px;padding:32px;text-align:center}.loader{width:38px;height:38px;border:3px solid #d9dee7;border-top-color:#315efb;border-radius:50%;animation:spin 1s linear infinite}h1{margin:0;font-size:18px}p{margin:0;max-width:340px;color:#4f5b6d;font-size:14px;line-height:1.5}@keyframes spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.loader{animation-duration:2s}}</style></head><body><main class="loading" role="status" aria-live="polite"><div class="loader" aria-hidden="true"></div><h1>Preparando o preenchimento</h1><p>Aguarde enquanto abrimos o formulário interno já autenticado.</p></main></body></html>`);
  loadingDocument.close();
}

export function OperatorDashboardContent() {
  const [processes, setProcesses] = useState<ProcessSummary[]>([]);
  const [kanbanProcesses, setKanbanProcesses] = useState<KanbanProcess[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showRead, setShowRead] = useState(false);
  const [busyNotificationIds, setBusyNotificationIds] = useState<Record<string, true>>({});
  const [creating, setCreating] = useState(false);
  const [loadingProcesses, setLoadingProcesses] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [loadingKanban, setLoadingKanban] = useState(false);
  const [startMode, setStartMode] = useState<ProcessStartMode>("link");
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [processOffset, setProcessOffset] = useState(0);
  const [notificationOffset, setNotificationOffset] = useState(0);
  const [hasMoreProcesses, setHasMoreProcesses] = useState(true);
  const [hasMoreNotifications, setHasMoreNotifications] = useState(true);
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", sendEmail: true, sendWhatsapp: true });
  const processPageSize = 8;
  const notificationPageSize = 20;

  async function loadUnreadCount() {
    const unread = await api<{ count: number }>("/notifications/unread-count");
    setUnreadCount(unread.count);
  }

  async function loadProcesses(nextOffset = 0, append = false) {
    setLoadingProcesses(true);
    try {
      const data = await api<ProcessSummary[]>(`/processes?limit=${processPageSize}&offset=${nextOffset}`);
      setProcesses((prev) => (append ? [...prev, ...data] : data));
      setHasMoreProcesses(data.length === processPageSize);
      setProcessOffset(nextOffset + data.length);
    } finally { setLoadingProcesses(false); }
  }

  async function loadKanban() {
    setLoadingKanban(true);
    try {
      const data = await api<KanbanProcess[]>("/processes/kanban?limit=200&offset=0");
      setKanbanProcesses(Array.isArray(data) ? data : []);
    }
    finally { setLoadingKanban(false); }
  }

  async function loadCompletedCount() {
    const data = await api<{ total?: number }>("/completed-processes?limit=1&offset=0");
    setCompletedCount(typeof data?.total === "number" ? data.total : 0);
  }

  async function loadNotifications(nextOffset = 0, append = false) {
    setLoadingNotifications(true);
    try {
      const data = await api<InAppNotification[]>(`/notifications?limit=${notificationPageSize}&offset=${nextOffset}`);
      setNotifications((prev) => (append ? [...prev, ...data] : data));
      setHasMoreNotifications(data.length === notificationPageSize);
      setNotificationOffset(nextOffset + data.length);
    } finally { setLoadingNotifications(false); }
  }

  async function loadAll() {
    setDashboardError(null);
    try { await Promise.all([loadProcesses(), loadKanban(), loadCompletedCount(), loadNotifications(), loadUnreadCount()]); }
    catch (error) { setDashboardError(error instanceof Error ? error.message : "Não foi possível carregar o painel."); }
  }

  useEffect(() => { void loadAll(); }, []);

  useEffect(() => {
    function handleInternalProcessComplete(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.data?.type !== "fundarmf-internal-process-complete") return;
      notifySuccess("Processo interno preenchido e enviado para validação.");
      void loadAll();
    }
    window.addEventListener("message", handleInternalProcessComplete);
    return () => window.removeEventListener("message", handleInternalProcessComplete);
  }, []);

  async function handleCreate() {
    if (!form.nome.trim() || !form.email.trim()) { setCreateMessage("Informe o nome da empresa e o e-mail do cliente."); return; }
    let internalWindow: Window | null = null;
    if (startMode === "internal") {
      internalWindow = window.open("about:blank", "_blank");
      if (!internalWindow) { setCreateMessage("Permita pop-ups neste site para abrir o preenchimento interno."); return; }
      showInternalProcessLoader(internalWindow);
    }
    const openedInternalWindow = internalWindow;
    setCreating(true); setCreateMessage(null);
    try {
      const created = await api<{ id: string }>("/processes", { method: "POST", body: JSON.stringify({ nome: form.nome.trim(), email: form.email.trim(), telefone: form.telefone, sendEmail: startMode === "link" ? form.sendEmail : false, sendWhatsapp: startMode === "link" ? form.sendWhatsapp : false }) });
      if (startMode === "internal" && openedInternalWindow) {
        openedInternalWindow.location.href = new URL(`/client/process/${created.id}?modo=interno`, window.location.origin).toString();
        openedInternalWindow.focus();
        notifySuccess("Processo interno iniciado em uma nova aba.");
      } else notifySuccess("Processo iniciado e link enviado.");
      setForm({ nome: "", email: "", telefone: "", sendEmail: true, sendWhatsapp: true });
      await loadAll();
    } catch (error) { openedInternalWindow?.close(); setCreateMessage(error instanceof Error ? error.message : "Não foi possível iniciar o processo."); }
    finally { setCreating(false); }
  }

  async function markRead(id: string) {
    if (busyNotificationIds[id]) return;
    setBusyNotificationIds((prev) => ({ ...prev, [id]: true }));
    try { await api(`/notifications/${id}/read`, { method: "PATCH" }); setNotifications((prev) => prev.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item)); setUnreadCount((prev) => Math.max(0, prev - 1)); }
    finally { setBusyNotificationIds((prev) => { const next = { ...prev }; delete next[id]; return next; }); }
  }

  async function dismiss(id: string) {
    if (busyNotificationIds[id]) return;
    const removed = notifications.find((item) => item.id === id);
    setBusyNotificationIds((prev) => ({ ...prev, [id]: true }));
    setNotifications((prev) => prev.filter((item) => item.id !== id));
    if (removed && !removed.readAt) setUnreadCount((prev) => Math.max(0, prev - 1));
    try { await api(`/notifications/${id}/dismiss`, { method: "PATCH" }); }
    catch (error) { if (removed) setNotifications((prev) => [removed, ...prev]); throw error; }
    finally { setBusyNotificationIds((prev) => { const next = { ...prev }; delete next[id]; return next; }); }
  }

  const stageCounts = useMemo(() => KANBAN_STAGES.map((stage) => ({ stage, count: kanbanProcesses.filter((item) => item.kanbanEligible !== false && item.kanbanStage === stage).length })), [kanbanProcesses]);
  const maxStageCount = Math.max(1, ...stageCounts.map((item) => item.count));
  const unreadNotifications = useMemo(() => notifications.filter((item) => !item.readAt).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)), [notifications]);
  const readNotifications = useMemo(() => notifications.filter((item) => item.readAt).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)), [notifications]);
  const attentionItems = unreadNotifications.slice(0, 3);
  const previewNotifications = (showRead ? [...unreadNotifications, ...readNotifications] : unreadNotifications).slice(0, 4);
  const processCount = kanbanProcesses.filter((item) => item.kanbanEligible !== false && item.kanbanStage !== "FINALIZADO").length;
  const waitingClientCount = kanbanProcesses.filter((item) => item.kanbanStage === "AGUARDANDO_DOCUMENTOS").length;
  const finishedCount = completedCount;

  return (
    <div className="operator-workspace">
      <WorkspaceNav role="operator" />
      <main id="main-content" className="app-container operator-dashboard" tabIndex={-1}>
        <header className="operator-page-header">
          <div><p className="operator-breadcrumb">Portal operador / Visão geral</p><h1>Meu painel</h1><p>Uma leitura rápida do que precisa avançar hoje.</p></div>
          <Link href="/operator/start" className="operator-primary-action">Novo processo <span aria-hidden="true">+</span></Link>
        </header>

        {dashboardError && <div className="operator-inline-error" role="alert"><strong>O painel não carregou por completo.</strong><span>{dashboardError}</span><button type="button" onClick={() => void loadAll()}>Tentar novamente</button></div>}

        <section className="operator-kpi-strip" aria-label="Indicadores operacionais">
          <div><span>Em andamento</span><strong>{processCount}</strong><small>processos ativos</small></div>
          <div className={unreadCount > 0 ? "is-attention" : ""}><span>Minha atenção</span><strong>{unreadCount}</strong><small>notificações não lidas</small></div>
          <div><span>Aguardando cliente</span><strong>{waitingClientCount}</strong><small>na etapa de documentos</small></div>
          <div><span>Finalizados</span><strong>{finishedCount}</strong><small>no quadro atual</small></div>
        </section>

        <section className="operator-primary-grid">
          <Card className="operator-panel operator-attention-panel"><div className="operator-panel-heading"><div><h2>Minha atenção</h2><p>Itens que pedem uma ação do operador.</p></div><span className="operator-panel-count">{attentionItems.length}</span></div>
            <div className="operator-attention-list">
              {attentionItems.length === 0 && <div className="operator-empty"><strong>Nenhuma pendência agora</strong><span>As notificações acionáveis aparecerão aqui.</span></div>}
              {attentionItems.map((item) => <div key={item.id} className="operator-attention-item"><span className="operator-status-dot" aria-hidden="true" /><div className="operator-item-copy"><strong>{item.title}</strong><span>{item.body}</span><small>{formatDate(item.createdAt)}</small></div>{item.processId ? <Link href={`/operator/process/${item.processId}`} className="operator-row-action">Abrir</Link> : <button type="button" className="operator-row-action" onClick={() => void markRead(item.id)}>Marcar lida</button>}</div>)}
            </div>
          </Card>

          <Card className="operator-panel operator-kanban-summary"><div className="operator-panel-heading"><div><h2>Fluxo de processos</h2><p>Distribuição real por etapa do atendimento.</p></div><Link href="/operator/kanban" className="operator-text-action">Abrir quadro</Link></div>
            <div className="operator-stage-list">{loadingKanban ? <p className="operator-muted">Carregando etapas…</p> : stageCounts.map(({ stage, count }) => <Link key={stage} href="/operator/kanban" className="operator-stage-row" aria-label={`${KANBAN_STAGE_LABELS[stage]}: ${count} processos`}><span>{KANBAN_STAGE_LABELS[stage]}</span><span className="operator-stage-track"><i style={{ width: `${Math.max(count ? 8 : 0, (count / maxStageCount) * 100)}%` }} /></span><strong>{count}</strong></Link>)}</div>
          </Card>
        </section>

        <section className="operator-secondary-grid">
          <Card className="operator-panel operator-notification-panel" id="notificacoes"><div className="operator-panel-heading"><div><h2>Notificações recentes</h2><p>{unreadCount} não lidas · eventos do seu atendimento.</p></div><Link href="#notificacoes" className="operator-text-action" onClick={() => setShowRead((value) => !value)}>{showRead ? "Ocultar lidas" : "Ver todas"}</Link></div>
            <div className="operator-notification-list">{previewNotifications.length === 0 && <div className="operator-empty"><strong>Sem notificações recentes</strong><span>Você está em dia com os eventos do portal.</span></div>}{previewNotifications.map((item) => <div key={item.id} className={`operator-notification-row ${item.readAt ? "is-read" : ""}`}><span className="operator-notification-mark" aria-hidden="true" /><div className="operator-item-copy"><strong>{item.title}</strong><span>{item.body}</span><small>{formatDate(item.createdAt)}</small></div><div className="operator-row-actions">{item.processId && <Link href={`/operator/process/${item.processId}`} className="operator-row-action">Abrir</Link>}{!item.readAt && <button type="button" className="operator-row-action" disabled={Boolean(busyNotificationIds[item.id])} onClick={() => void markRead(item.id)}>Lida</button>}<button type="button" className="operator-dismiss" aria-label={`Remover notificação: ${item.title}`} onClick={() => void dismiss(item.id)}>×</button></div></div>)}</div>
            <div className="operator-panel-footer"><span>Mostrando {previewNotifications.length} de {notifications.length}</span><button type="button" onClick={() => void loadNotifications(notificationOffset, true)} disabled={!hasMoreNotifications || loadingNotifications}>{loadingNotifications ? "Carregando…" : hasMoreNotifications ? "Carregar mais" : "Fim da lista"}</button></div>
          </Card>

          <Card className="operator-panel operator-process-panel"><div className="operator-panel-heading"><div><h2>Processos recentes</h2><p>Últimos casos recebidos ou atualizados.</p></div><Link href="/operator/kanban" className="operator-text-action">Ver processos</Link></div><div className="operator-process-list">{processes.slice(0, 5).map((process) => <Link key={process.id} href={`/operator/process/${process.id}`} className="operator-process-row"><span className="operator-process-initial" aria-hidden="true">{(process.clientName ?? "P").slice(0, 1).toUpperCase()}</span><span className="operator-item-copy"><strong>{process.clientName ?? "Processo sem nome"}</strong><span>{process.currentStep}</span></span><span className="operator-process-meta"><StatusBadge status={process.status} label={process.kanbanStage ? KANBAN_STAGE_LABELS[process.kanbanStage] : undefined} /><small>{formatDate(process.updatedAt ?? process.createdAt)}</small></span></Link>)}{processes.length === 0 && <div className="operator-empty"><strong>Nenhum processo carregado</strong><span>Inicie um novo atendimento para começar.</span></div>}</div><div className="operator-panel-footer"><span>{processes.length} carregados</span><button type="button" onClick={() => void loadProcesses(processOffset, true)} disabled={!hasMoreProcesses || loadingProcesses}>{loadingProcesses ? "Carregando…" : hasMoreProcesses ? "Carregar mais" : "Fim da lista"}</button></div></Card>
        </section>

        <section className="operator-start-section"><div><p className="operator-breadcrumb">Atalho operacional</p><h2>Começar um novo atendimento</h2><p>Escolha como os dados iniciais serão preenchidos.</p></div><div className="operator-start-options" role="group" aria-label="Modo de início do processo"><button type="button" className={startMode === "link" ? "is-selected" : ""} onClick={() => setStartMode("link")} aria-pressed={startMode === "link"}><strong>Iniciar processo link cliente</strong><span>O cliente preenche com acesso seguro.</span></button><button type="button" className={startMode === "internal" ? "is-selected" : ""} onClick={() => setStartMode("internal")} aria-pressed={startMode === "internal"}><strong>Iniciar processo interno</strong><span>O formulário abre em uma nova aba.</span></button></div><div className="operator-start-form"><label htmlFor="operator-company-name">Nome da empresa</label><Input id="operator-company-name" name="companyName" autoComplete="organization" placeholder="Nome da empresa" value={form.nome} onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))} /><label htmlFor="operator-client-email">E-mail do cliente</label><Input id="operator-client-email" name="email" type="email" autoComplete="email" placeholder="E-mail do cliente" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} /><PhoneInput label="WhatsApp do cliente" value={form.telefone} onChange={(value) => setForm((prev) => ({ ...prev, telefone: value }))} />{startMode === "link" && <div className="operator-check-options"><label><input type="checkbox" checked={form.sendEmail} onChange={(event) => setForm((prev) => ({ ...prev, sendEmail: event.target.checked }))} /> E-mail</label><label><input type="checkbox" checked={form.sendWhatsapp} onChange={(event) => setForm((prev) => ({ ...prev, sendWhatsapp: event.target.checked }))} /> WhatsApp</label></div>}<Button variant="accent" onClick={() => void handleCreate()} disabled={creating}>{creating ? "Iniciando…" : startMode === "link" ? "Enviar acesso seguro" : "Iniciar processo interno"}</Button>{createMessage && <p className="operator-form-message" role="alert">{createMessage}</p>}</div></section>
      </main>
    </div>
  );
}
