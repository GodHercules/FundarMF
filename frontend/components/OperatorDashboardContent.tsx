"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/Stepper";
import { WorkspaceNav } from "@/components/WorkspaceNav";
import { OperatorNewProcessModal } from "@/components/OperatorNewProcessModal";
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
type InAppNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt?: string | null;
  processId?: string | null;
  type: string;
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit"
});

function formatDate(value?: string) {
  if (!value) return "Sem atualização";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Sem atualização" : dateFormatter.format(date);
}

export function OperatorDashboardContent() {
  const [processes, setProcesses] = useState<ProcessSummary[]>([]);
  const [kanbanProcesses, setKanbanProcesses] = useState<KanbanProcess[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showRead, setShowRead] = useState(false);
  const [busyNotificationIds, setBusyNotificationIds] = useState<Record<string, true>>({});
  const [loadingProcesses, setLoadingProcesses] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [loadingKanban, setLoadingKanban] = useState(false);
  const [newProcessOpen, setNewProcessOpen] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [processOffset, setProcessOffset] = useState(0);
  const [notificationOffset, setNotificationOffset] = useState(0);
  const [hasMoreProcesses, setHasMoreProcesses] = useState(true);
  const [hasMoreNotifications, setHasMoreNotifications] = useState(true);

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
    } finally {
      setLoadingProcesses(false);
    }
  }

  async function loadKanban() {
    setLoadingKanban(true);
    try {
      const data = await api<KanbanProcess[]>("/processes/kanban?limit=200&offset=0");
      setKanbanProcesses(Array.isArray(data) ? data : []);
    } finally {
      setLoadingKanban(false);
    }
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
    } finally {
      setLoadingNotifications(false);
    }
  }

  async function loadAll() {
    setDashboardError(null);
    try {
      await Promise.all([loadProcesses(), loadKanban(), loadCompletedCount(), loadNotifications(), loadUnreadCount()]);
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Não foi possível carregar o painel.");
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    function handleInternalProcessComplete(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.data?.type !== "fundarmf-internal-process-complete") return;
      notifySuccess("Processo interno preenchido e enviado para validação.");
      void loadAll();
    }

    window.addEventListener("message", handleInternalProcessComplete);
    return () => window.removeEventListener("message", handleInternalProcessComplete);
  }, []);

  async function markRead(id: string) {
    if (busyNotificationIds[id]) return;
    setBusyNotificationIds((prev) => ({ ...prev, [id]: true }));
    try {
      await api(`/notifications/${id}/read`, { method: "PATCH" });
      setNotifications((prev) => prev.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } finally {
      setBusyNotificationIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  async function dismiss(id: string) {
    if (busyNotificationIds[id]) return;
    const removed = notifications.find((item) => item.id === id);
    setBusyNotificationIds((prev) => ({ ...prev, [id]: true }));
    setNotifications((prev) => prev.filter((item) => item.id !== id));
    if (removed && !removed.readAt) setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await api(`/notifications/${id}/dismiss`, { method: "PATCH" });
    } catch (error) {
      if (removed) setNotifications((prev) => [removed, ...prev]);
      throw error;
    } finally {
      setBusyNotificationIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  const stageCounts = useMemo(() => KANBAN_STAGES.map((stage) => ({
    stage,
    count: kanbanProcesses.filter((item) => item.kanbanEligible !== false && item.kanbanStage === stage).length
  })), [kanbanProcesses]);
  const maxStageCount = Math.max(1, ...stageCounts.map((item) => item.count));
  const unreadNotifications = useMemo(() => notifications.filter((item) => !item.readAt).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)), [notifications]);
  const readNotifications = useMemo(() => notifications.filter((item) => item.readAt).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)), [notifications]);
  const attentionItems = unreadNotifications.slice(0, 3);
  const previewNotifications = (showRead ? [...unreadNotifications, ...readNotifications] : unreadNotifications).slice(0, 4);
  const processCount = kanbanProcesses.filter((item) => item.kanbanEligible !== false && item.kanbanStage !== "FINALIZADO").length;
  const waitingClientCount = kanbanProcesses.filter((item) => item.kanbanStage === "AGUARDANDO_DOCUMENTOS").length;
  const finishedCount = completedCount;

  function getProcessStageLabel(process: ProcessSummary) {
    if (process.currentStep === "ETAPA_2") return "Aguardando dados cliente";
    return process.kanbanStage ? KANBAN_STAGE_LABELS[process.kanbanStage] : undefined;
  }

  return (
    <div className="operator-workspace">
      <WorkspaceNav role="operator" onCreateProcess={() => setNewProcessOpen(true)} />

      <main id="main-content" className="app-container operator-dashboard" tabIndex={-1}>
        <header className="operator-page-header">
          <div>
            <p className="operator-breadcrumb">Portal operador / Visão geral</p>
            <h1>Meu painel</h1>
            <p>Uma leitura rápida do que precisa avançar hoje.</p>
          </div>
          <button type="button" className="operator-primary-action" onClick={() => setNewProcessOpen(true)}>
            Novo processo <span aria-hidden="true">+</span>
          </button>
        </header>

        {dashboardError && <div className="operator-inline-error" role="alert"><strong>O painel não carregou por completo.</strong><span>{dashboardError}</span><button type="button" onClick={() => void loadAll()}>Tentar novamente</button></div>}

        <section className="operator-kpi-strip" aria-label="Indicadores operacionais">
          <div><span>Em andamento</span><strong>{processCount}</strong><small>processos ativos</small></div>
          <div className={unreadCount > 0 ? "is-attention" : ""}><span>Minha atenção</span><strong>{unreadCount}</strong><small>notificações não lidas</small></div>
          <div><span>Aguardando cliente</span><strong>{waitingClientCount}</strong><small>na etapa de documentos</small></div>
          <div><span>Finalizados</span><strong>{finishedCount}</strong><small>no quadro atual</small></div>
        </section>

        <section className="operator-primary-grid">
          <Card className="operator-panel operator-attention-panel">
            <div className="operator-panel-heading"><div><h2>Minha atenção</h2><p>Itens que pedem uma ação do operador.</p></div><span className="operator-panel-count">{attentionItems.length}</span></div>
            <div className="operator-attention-list">
              {attentionItems.length === 0 && <div className="operator-empty"><strong>Nenhuma pendência agora</strong><span>As notificações acionáveis aparecerão aqui.</span></div>}
              {attentionItems.map((item) => <div key={item.id} className="operator-attention-item"><span className="operator-status-dot" aria-hidden="true" /><div className="operator-item-copy"><strong>{item.title}</strong><span>{item.body}</span><small>{formatDate(item.createdAt)}</small></div>{item.processId ? <Link href={`/operator/process/${item.processId}`} className="operator-row-action">Abrir</Link> : <button type="button" className="operator-row-action" onClick={() => void markRead(item.id)}>Marcar lida</button>}</div>)}
            </div>
          </Card>

          <Card className="operator-panel operator-kanban-summary">
            <div className="operator-panel-heading"><div><h2>Fluxo de processos</h2><p>Distribuição real por etapa do atendimento.</p></div><Link href="/operator/kanban" className="operator-text-action">Abrir quadro</Link></div>
            <div className="operator-stage-list">{loadingKanban ? <p className="operator-muted">Carregando etapas…</p> : stageCounts.map(({ stage, count }) => <Link key={stage} href="/operator/kanban" className="operator-stage-row" aria-label={`${KANBAN_STAGE_LABELS[stage]}: ${count} processos`}><span>{KANBAN_STAGE_LABELS[stage]}</span><span className="operator-stage-track"><i style={{ width: `${Math.max(count ? 8 : 0, (count / maxStageCount) * 100)}%` }} /></span><strong>{count}</strong></Link>)}</div>
          </Card>
        </section>

        <section className="operator-secondary-grid">
          <Card className="operator-panel operator-notification-panel" id="notificacoes">
            <div className="operator-panel-heading"><div><h2>Notificações recentes</h2><p>{unreadCount} não lidas · eventos do seu atendimento.</p></div><Link href="#notificacoes" className="operator-text-action" onClick={() => setShowRead((value) => !value)}>{showRead ? "Ocultar lidas" : "Ver todas"}</Link></div>
            <div className="operator-notification-list">{previewNotifications.length === 0 && <div className="operator-empty"><strong>Sem notificações recentes</strong><span>Você está em dia com os eventos do portal.</span></div>}{previewNotifications.map((item) => <div key={item.id} className={`operator-notification-row ${item.readAt ? "is-read" : ""}`}><span className="operator-notification-mark" aria-hidden="true" /><div className="operator-item-copy"><strong>{item.title}</strong><span>{item.body}</span><small>{formatDate(item.createdAt)}</small></div><div className="operator-row-actions">{item.processId && <Link href={`/operator/process/${item.processId}`} className="operator-row-action">Abrir</Link>}{!item.readAt && <button type="button" className="operator-row-action" disabled={Boolean(busyNotificationIds[item.id])} onClick={() => void markRead(item.id)}>Lida</button>}<button type="button" className="operator-dismiss" aria-label={`Remover notificação: ${item.title}`} onClick={() => void dismiss(item.id)}>×</button></div></div>)}</div>
            <div className="operator-panel-footer"><span>Mostrando {previewNotifications.length} de {notifications.length}</span><button type="button" onClick={() => void loadNotifications(notificationOffset, true)} disabled={!hasMoreNotifications || loadingNotifications}>{loadingNotifications ? "Carregando…" : hasMoreNotifications ? "Carregar mais" : "Fim da lista"}</button></div>
          </Card>

          <Card className="operator-panel operator-process-panel">
            <div className="operator-panel-heading"><div><h2>Processos recentes</h2><p>Últimos casos recebidos ou atualizados.</p></div><Link href="/operator/kanban" className="operator-text-action">Ver processos</Link></div>
            <div className="operator-process-list">
              {processes.slice(0, 5).map((process) => <Link key={process.id} href={`/operator/process/${process.id}`} className="operator-process-row"><span className="operator-process-initial" aria-hidden="true">{(process.clientName ?? "P").slice(0, 1).toUpperCase()}</span><span className="operator-item-copy"><strong>{process.clientName ?? "Processo sem nome"}</strong></span><span className="operator-process-meta"><StatusBadge status={process.status} label={getProcessStageLabel(process)} /><small>{formatDate(process.updatedAt ?? process.createdAt)}</small></span></Link>)}
              {processes.length === 0 && <div className="operator-empty"><strong>Nenhum processo carregado</strong><span>Inicie um novo atendimento para começar.</span></div>}
            </div>
            <div className="operator-panel-footer"><span>{processes.length} carregados</span><button type="button" onClick={() => void loadProcesses(processOffset, true)} disabled={!hasMoreProcesses || loadingProcesses}>{loadingProcesses ? "Carregando…" : hasMoreProcesses ? "Carregar mais" : "Fim da lista"}</button></div>
          </Card>
        </section>
      </main>

      <OperatorNewProcessModal open={newProcessOpen} onClose={() => setNewProcessOpen(false)} onCreated={() => void loadAll()} />
    </div>
  );
}
