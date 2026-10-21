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
  dismissedAt?: string | null;
  processId?: string | null;
  type: string;
};

type DashboardProcess = ProcessSummary & {
  stageLabel?: string;
  lastActivityAt: string;
  lastActivityAction: string;
  attention: {
    reason: "form_pending" | "inactive" | "both";
    waitingSince: string;
    lastActivityAt: string;
    lastActivityAction: string;
    message: string;
  } | null;
};

type DashboardSnapshot = {
  attention: DashboardProcess[];
  recent: DashboardProcess[];
  activeCount: number;
  waitingClientCount: number;
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

function formatElapsed(value?: string) {
  if (!value) return "Agora";
  const elapsedHours = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / (60 * 60 * 1000)));
  if (elapsedHours < 1) return "Há menos de 1 hora";
  if (elapsedHours < 24) return `Há ${elapsedHours}h`;
  const days = Math.floor(elapsedHours / 24);
  const hours = elapsedHours % 24;
  return hours > 0 ? `Há ${days}d e ${hours}h` : `Há ${days}d`;
}

function getProcessActivityAt(process: ProcessSummary | DashboardProcess) {
  return "lastActivityAt" in process && typeof process.lastActivityAt === "string"
    ? process.lastActivityAt
    : process.updatedAt ?? process.createdAt;
}

function getProcessStageLabel(process: ProcessSummary | DashboardProcess) {
  return "stageLabel" in process && typeof process.stageLabel === "string"
    ? process.stageLabel
    : process.currentStep === "ETAPA_2"
      ? "Aguardando dados cliente"
      : process.kanbanStage ? KANBAN_STAGE_LABELS[process.kanbanStage] : undefined;
}

export function OperatorDashboardContent() {
  const [processes, setProcesses] = useState<ProcessSummary[]>([]);
  const [dashboardSnapshot, setDashboardSnapshot] = useState<DashboardSnapshot | null>(null);
  const [kanbanProcesses, setKanbanProcesses] = useState<KanbanProcess[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [, setUnreadCount] = useState(0);
  const [busyNotificationIds, setBusyNotificationIds] = useState<Record<string, true>>({});
  const [, setLoadingProcesses] = useState(false);
  const [, setLoadingNotifications] = useState(false);
  const [loadingKanban, setLoadingKanban] = useState(false);
  const [newProcessOpen, setNewProcessOpen] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [dashboardStatus, setDashboardStatus] = useState<"loading" | "ready" | "error">("loading");

  const processPageSize = 8;
  const notificationPageSize = 5;

  async function loadUnreadCount() {
    const unread = await api<{ count: number }>("/notifications/unread-count");
    setUnreadCount(unread.count);
  }

  async function loadProcesses(nextOffset = 0, append = false) {
    setLoadingProcesses(true);
    try {
      const data = await api<ProcessSummary[]>(`/processes?limit=${processPageSize}&offset=${nextOffset}`);
      setProcesses((prev) => (append ? [...prev, ...data] : data));
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
      setNotifications((prev) => (append ? [...prev, ...data].slice(0, notificationPageSize) : data));
    } finally {
      setLoadingNotifications(false);
    }
  }

  async function loadDashboard() {
    const data = await api<DashboardSnapshot>("/processes/dashboard");
    if (Array.isArray(data?.attention) && Array.isArray(data?.recent)) {
      setDashboardSnapshot(data);
    }
  }

  async function loadAll() {
    setDashboardError(null);
    setDashboardStatus("loading");
    try {
      await Promise.all([loadProcesses(), loadDashboard(), loadKanban(), loadCompletedCount(), loadNotifications(), loadUnreadCount()]);
      setDashboardStatus("ready");
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Não foi possível carregar o painel.");
      setDashboardStatus("error");
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

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void loadDashboard();
      void loadNotifications();
      void loadUnreadCount();
    };
    const interval = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(interval);
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
  const previewNotifications = useMemo(() => notifications
    .filter((item) => Date.parse(item.createdAt) > Date.now() - 72 * 60 * 60 * 1000 && !item.dismissedAt)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 5), [notifications]);
  const attentionItems = dashboardSnapshot?.attention ?? [];
  const recentProcesses = dashboardSnapshot?.recent ?? processes.slice(0, 4);
  const processCount = dashboardSnapshot?.activeCount ?? kanbanProcesses.filter((item) => item.kanbanEligible !== false && item.kanbanStage !== "FINALIZADO").length;
  const waitingClientCount = dashboardSnapshot?.waitingClientCount ?? kanbanProcesses.filter((item) => item.kanbanStage === "AGUARDANDO_DOCUMENTOS").length;
  const finishedCount = completedCount;

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

        {dashboardStatus === "loading" && <div className="operator-loading-state" role="status" aria-live="polite" aria-busy="true"><div className="operator-loading-copy"><strong>Carregando o painel</strong><span>Aguarde enquanto buscamos os dados atualizados.</span></div><div className="operator-skeleton-row"><span /><span /><span /></div></div>}
        {dashboardStatus === "error" && <div className="operator-inline-error" role="alert"><strong>O painel não carregou.</strong><span>{dashboardError}</span><button type="button" onClick={() => void loadAll()}>Tentar novamente</button></div>}

        {dashboardStatus === "ready" && <>
        <section className="operator-kpi-strip" aria-label="Indicadores operacionais">
          <div><span>Em andamento</span><strong>{processCount}</strong><small>processos ativos</small></div>
          <div className={attentionItems.length > 0 ? "is-attention" : ""}><span>Minha atenção</span><strong>{attentionItems.length}</strong><small>pendências operacionais</small></div>
          <div><span>Aguardando cliente</span><strong>{waitingClientCount}</strong><small>na etapa de documentos</small></div>
          <div><span>Finalizados</span><strong>{finishedCount}</strong><small>no quadro atual</small></div>
        </section>
        </>}

        {dashboardStatus === "ready" && <section className="operator-primary-grid">
          <Card className="operator-panel operator-attention-panel">
            <div className="operator-panel-heading"><div><h2>Minha atenção</h2><p>Itens que pedem uma ação do operador.</p></div><span className="operator-panel-count">{attentionItems.length}</span></div>
            <div className="operator-attention-list">
              {attentionItems.length === 0 && <div className="operator-empty"><strong>Tudo em dia!</strong><span>Nenhum formulário aguardando análise e nenhum processo atribuído a você parado há mais de 72 horas.</span></div>}
              {attentionItems.map((item) => {
                const attention = item.attention;
                if (!attention) return null;
                return <div key={item.id} className="operator-attention-item">
                  <span className={`operator-status-dot is-${attention.reason}`} aria-hidden="true" />
                  <div className="operator-item-copy">
                    <strong>{item.clientName}</strong>
                    <span>{attention.message}</span>
                    <small>{attention.reason === "inactive" ? `${formatElapsed(attention.lastActivityAt)} · Última atividade: ${attention.lastActivityAction}` : `Recebido ${formatDate(attention.waitingSince)}`}</small>
                  </div>
                  <span className={`operator-attention-badge is-${attention.reason}`}>{attention.reason === "inactive" ? "Inativo" : attention.reason === "both" ? "Análise + inativo" : "Análise pendente"}</span>
                  <Link href={`/operator/process/${item.id}`} className="operator-row-action">Analisar</Link>
                </div>;
              })}
            </div>
          </Card>

          <Card className="operator-panel operator-kanban-summary">
            <div className="operator-panel-heading"><div><h2>Fluxo de processos</h2><p>Distribuição real por etapa do atendimento.</p></div><Link href="/operator/kanban" className="operator-text-action">Abrir quadro</Link></div>
            <div className="operator-stage-list">{loadingKanban ? <p className="operator-muted">Carregando etapas…</p> : stageCounts.map(({ stage, count }) => <Link key={stage} href="/operator/kanban" className="operator-stage-row" aria-label={`${KANBAN_STAGE_LABELS[stage]}: ${count} processos`}><span>{KANBAN_STAGE_LABELS[stage]}</span><span className="operator-stage-track"><i style={{ width: `${Math.max(count ? 8 : 0, (count / maxStageCount) * 100)}%` }} /></span><strong>{count}</strong></Link>)}</div>
          </Card>
        </section>}

        {dashboardStatus === "ready" && <section className="operator-secondary-grid">
          <Card className="operator-panel operator-notification-panel" id="notificacoes">
            <div className="operator-panel-heading"><div><h2>Notificações recentes</h2><p>Eventos do seu atendimento nos últimos 3 dias.</p></div><span className="operator-panel-count">{previewNotifications.length}</span></div>
            <div className="operator-notification-list">{previewNotifications.length === 0 && <div className="operator-empty"><strong>Nenhuma notificação recente.</strong><span>As próximas atualizações aparecerão aqui.</span></div>}{previewNotifications.map((item) => <div key={item.id} className={`operator-notification-row ${item.readAt ? "is-read" : ""}`}><span className="operator-notification-mark" aria-hidden="true" /><div className="operator-item-copy"><strong>{item.title}</strong><span>{item.body}</span><small>{formatDate(item.createdAt)}</small></div><div className="operator-row-actions">{item.processId && <Link href={`/operator/process/${item.processId}`} className="operator-row-action">Abrir</Link>}{!item.readAt && <button type="button" className="operator-row-action" disabled={Boolean(busyNotificationIds[item.id])} onClick={() => void markRead(item.id)}>Marcar como lida</button>}<button type="button" className="operator-dismiss" aria-label={`Dispensar notificação: ${item.title}`} onClick={() => void dismiss(item.id)}>×</button></div></div>)}</div>
            <div className="operator-panel-footer"><span>{previewNotifications.length === 0 ? "Nenhum evento recente" : `Mostrando ${previewNotifications.length} evento${previewNotifications.length === 1 ? "" : "s"}`}</span><span>Expira após 72h</span></div>
          </Card>

          <Card className="operator-panel operator-process-panel">
            <div className="operator-panel-heading"><div><h2>Processos recentes</h2><p>Últimos casos recebidos ou atualizados.</p></div><Link href="/operator/kanban" className="operator-text-action">Ver processos</Link></div>
            <div className="operator-process-list">
              {recentProcesses.map((process) => <Link key={process.id} href={`/operator/process/${process.id}`} className="operator-process-row"><span className="operator-process-initial" aria-hidden="true">{(process.clientName ?? "P").slice(0, 1).toUpperCase()}</span><span className="operator-item-copy"><strong>{process.clientName ?? "Processo sem nome"}</strong><small>Última movimentação: {formatDate(getProcessActivityAt(process))}</small></span><span className="operator-process-meta"><StatusBadge status={process.status} label={getProcessStageLabel(process)} /></span></Link>)}
              {recentProcesses.length === 0 && <div className="operator-empty"><strong>Nenhum processo em andamento</strong><span>Os processos ativos mais recentes aparecerão aqui.</span></div>}
            </div>
            <div className="operator-panel-footer"><span>{recentProcesses.length} processo{recentProcesses.length === 1 ? "" : "s"} exibido{recentProcesses.length === 1 ? "" : "s"}</span><Link href="/operator/kanban" className="operator-row-action">Ver quadro completo</Link></div>
          </Card>
        </section>}
      </main>

      <OperatorNewProcessModal open={newProcessOpen} onClose={() => setNewProcessOpen(false)} onCreated={() => void loadAll()} />
    </div>
  );
}
