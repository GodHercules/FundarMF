"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/Stepper";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { PhoneInput } from "@/components/PhoneInput";
import { OperatorKanbanBoard } from "@/components/OperatorKanbanBoard";
import { KANBAN_STAGE_LABELS, KanbanStage } from "@/lib/kanban";
import { notifySuccess } from "@/lib/notify";

interface ProcessSummary {
  id: string;
  clientName?: string;
  status: string;
  currentStep: string;
  kanbanStage?: KanbanStage;
}

type InAppNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt?: string | null;
  processId?: string | null;
  type: string;
};

export default function OperatorDashboard() {
  const [processes, setProcesses] = useState<ProcessSummary[]>([]);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showRead, setShowRead] = useState(false);
  const [busyNotificationIds, setBusyNotificationIds] = useState<Record<string, true>>({});
  const [creating, setCreating] = useState(false);
  const [loadingProcesses, setLoadingProcesses] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [processOffset, setProcessOffset] = useState(0);
  const [notificationOffset, setNotificationOffset] = useState(0);
  const [hasMoreProcesses, setHasMoreProcesses] = useState(true);
  const [hasMoreNotifications, setHasMoreNotifications] = useState(true);
  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    sendEmail: true,
    sendWhatsapp: true
  });

  const processPageSize = 8;
  const notificationPageSize = 20;

  const MS_DAY = 24 * 60 * 60 * 1000;
  const READ_HIDE_AFTER_DAYS = 2;
  const UNREAD_PIN_AFTER_DAYS = 5;

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

  async function loadNotifications(nextOffset = 0, append = false) {
    setLoadingNotifications(true);
    try {
      const data = await api<InAppNotification[]>(
        `/notifications?limit=${notificationPageSize}&offset=${nextOffset}`
      );
      setNotifications((prev) => (append ? [...prev, ...data] : data));
      setHasMoreNotifications(data.length === notificationPageSize);
      setNotificationOffset(nextOffset + data.length);
    } finally {
      setLoadingNotifications(false);
    }
  }

  async function loadAll() {
    await Promise.all([loadProcesses(0, false), loadNotifications(0, false), loadUnreadCount()]);
  }

  function syncProcessKanbanStage(processId: string, stage: KanbanStage) {
    setProcesses((prev) =>
      prev.map((process) => (process.id === processId ? { ...process, kanbanStage: stage } : process))
    );
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleCreate() {
    if (!form.nome || !form.email) return;
    setCreating(true);
    try {
      await api("/processes", {
        method: "POST",
        body: JSON.stringify({
          nome: form.nome,
          email: form.email,
          telefone: form.telefone,
          sendEmail: form.sendEmail,
          sendWhatsapp: form.sendWhatsapp
        })
      });
      notifySuccess("Processo iniciado e link enviado.");
      setForm({ nome: "", email: "", telefone: "", sendEmail: true, sendWhatsapp: true });
      await loadProcesses(0, false);
      await loadNotifications(0, false);
      await loadUnreadCount();
    } finally {
      setCreating(false);
    }
  }

  async function markRead(id: string) {
    if (busyNotificationIds[id]) return;
    setBusyNotificationIds((prev) => ({ ...prev, [id]: true }));
    try {
      await api(`/notifications/${id}/read`, { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, readAt: new Date().toISOString() } : item))
      );
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
    setBusyNotificationIds((prev) => ({ ...prev, [id]: true }));
    const removed = notifications.find((n) => n.id === id);
    // Optimistic UI: remove immediately.
    setNotifications((prev) => prev.filter((item) => item.id !== id));
    if (removed && !removed.readAt) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    try {
      await api(`/notifications/${id}/dismiss`, { method: "PATCH" });
    } catch (err) {
      // Put it back if the API failed.
      if (removed) {
        setNotifications((prev) => [removed, ...prev]);
        if (!removed.readAt) {
          setUnreadCount((prev) => prev + 1);
        }
      }
      throw err;
    } finally {
      setBusyNotificationIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  const nowMs = Date.now();
  const readCutoffMs = nowMs - READ_HIDE_AFTER_DAYS * MS_DAY;
  const unreadPinMs = nowMs - UNREAD_PIN_AFTER_DAYS * MS_DAY;

  const unreadNotifications = [...notifications]
    .filter((item) => !item.readAt)
    .sort((a, b) => {
      const aMs = new Date(a.createdAt).getTime();
      const bMs = new Date(b.createdAt).getTime();
      const aPinned = aMs <= unreadPinMs;
      const bPinned = bMs <= unreadPinMs;
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      return bMs - aMs;
    });

  const readNotifications = [...notifications]
    .filter((item) => item.readAt && new Date(item.createdAt).getTime() >= readCutoffMs)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <main className="app-container flex min-h-screen flex-col gap-8 py-12">
      <Link href="/" className="text-sm font-semibold text-slate">
        {"<- Sair"}
      </Link>
      <header className="flex flex-col gap-2">
        <Logo withText />
        <span className="badge bg-emerald/15 text-ink">Painel interno</span>
        <h1 className="text-3xl font-semibold">Meus casos</h1>
        <p className="text-slate">Acompanhe validações, correções, chat e SLAs.</p>
        <div>
          <Link href="/operator/kanban" className="text-sm font-semibold text-brass">
            Abrir quadro Kanban
          </Link>
        </div>
      </header>

      <Card className="p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Kanban</h2>
          <p className="text-sm text-slate">Gerencie as etapas arrastando os cards entre as colunas.</p>
        </div>
        <OperatorKanbanBoard onStageChange={syncProcessKanbanStage} />
      </Card>

      <section className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Notificações</h2>
            <span className="badge bg-ink text-white">{unreadCount} não lidas</span>
          </div>
          <div className="mt-4 max-h-[520px] space-y-3 overflow-auto pr-2">
            {notifications.length === 0 && <p className="text-sm text-slate">Nenhuma notificação recente.</p>}

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">Não lidas</span>
              <span className="text-xs text-slate">{unreadNotifications.length}</span>
            </div>

            {unreadNotifications.length === 0 && (
              <p className="rounded-xl border border-ink/10 bg-white/60 p-3 text-sm text-slate">Sem notificações não lidas.</p>
            )}

            {unreadNotifications.map((item) => {
              const pinned = new Date(item.createdAt).getTime() <= unreadPinMs;
              const busy = Boolean(busyNotificationIds[item.id]);
              return (
                <div key={item.id} className="rounded-xl border border-ink/10 bg-brass/10 p-3 text-sm text-ink">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{item.title}</p>
                        {pinned && <span className="badge bg-rose-500/15 text-rose-700">Atrasada</span>}
                      </div>
                      <p className="mt-1 whitespace-pre-line text-slate">{item.body}</p>
                    </div>
                    <button
                      type="button"
                      className="rounded-full border border-ink/15 px-2 py-1 text-xs font-semibold text-ink hover:border-brass"
                      onClick={() => dismiss(item.id)}
                      aria-label="Fechar notificação"
                      title="Fechar"
                      disabled={busy}
                    >
                      x
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate">
                    <span>{new Date(item.createdAt).toLocaleString("pt-BR")}</span>
                    <button
                      className="font-semibold text-brass disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => markRead(item.id)}
                      disabled={busy}
                    >
                      Marcar como lida
                    </button>
                  </div>
                </div>
              );
            })}

            <div className="mt-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">
                  Lidas (últimos {READ_HIDE_AFTER_DAYS} dias)
                </span>
                <button
                  type="button"
                  className="rounded-full border border-ink/15 px-3 py-1 text-[11px] font-semibold text-ink hover:border-brass"
                  onClick={() => setShowRead((prev) => !prev)}
                >
                  {showRead ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              <span className="text-xs text-slate">{readNotifications.length}</span>
            </div>

            {!showRead && readNotifications.length > 0 && (
              <p className="rounded-xl border border-ink/10 bg-white/60 p-3 text-sm text-slate">
                Lidas ocultas. Clique em Mostrar para ver.
              </p>
            )}

            {showRead && readNotifications.length === 0 && (
              <p className="rounded-xl border border-ink/10 bg-white/60 p-3 text-sm text-slate">Sem notificações lidas recentes.</p>
            )}

            {showRead && readNotifications.map((item) => {
              const busy = Boolean(busyNotificationIds[item.id]);
              return (
              <div key={item.id} className="rounded-xl border border-ink/10 bg-white/60 p-3 text-sm text-slate">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-1 whitespace-pre-line">{item.body}</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-ink/15 px-2 py-1 text-xs font-semibold text-ink hover:border-brass"
                    onClick={() => dismiss(item.id)}
                    aria-label="Fechar notificação"
                    title="Fechar"
                    disabled={busy}
                  >
                    x
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate">
                  <span>{new Date(item.createdAt).toLocaleString("pt-BR")}</span>
                  {item.processId && (
                    <Link href={`/operator/process/${item.processId}`} className="font-semibold text-brass">
                      Abrir caso {"->"}
                    </Link>
                  )}
                </div>
              </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate">
            <span>Mostrando {notifications.length} notificações</span>
            <button
              type="button"
              className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => loadNotifications(notificationOffset, true)}
              disabled={!hasMoreNotifications || loadingNotifications}
            >
              {loadingNotifications ? "Carregando..." : hasMoreNotifications ? "Carregar mais" : "Fim da lista"}
            </button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Iniciar novo processo</h2>
          <p className="mt-1 text-sm text-slate">
            Preencha os dados da empresa e do contato do cliente para enviar o link seguro por e-mail e/ou WhatsApp.
          </p>
          <div className="mt-4 grid gap-3">
            <Input
              placeholder="Nome da empresa"
              value={form.nome}
              onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
            />
            <Input
              placeholder="E-mail do cliente"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            />
            <PhoneInput
              label="WhatsApp do cliente"
              value={form.telefone}
              onChange={(value) => setForm((prev) => ({ ...prev, telefone: value }))}
            />
            <div className="flex flex-wrap gap-3 text-sm text-slate">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.sendEmail}
                  onChange={(event) => setForm((prev) => ({ ...prev, sendEmail: event.target.checked }))}
                />
                Enviar por e-mail
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.sendWhatsapp}
                  onChange={(event) => setForm((prev) => ({ ...prev, sendWhatsapp: event.target.checked }))}
                />
                Enviar por WhatsApp
              </label>
            </div>
            <Button onClick={handleCreate} variant="accent" disabled={creating}>
              {creating ? "Iniciando..." : "Iniciar processo"}
            </Button>
          </div>
        </Card>
      </section>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Processos</h2>
            <p className="text-sm text-slate">Lista dos seus casos em andamento e pendências.</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate">
            <span>Mostrando {processes.length}</span>
            <button
              type="button"
              className="rounded-full border border-ink/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => loadProcesses(processOffset, true)}
              disabled={!hasMoreProcesses || loadingProcesses}
            >
              {loadingProcesses ? "Carregando..." : hasMoreProcesses ? "Carregar mais" : "Fim da lista"}
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {processes.length === 0 && <p className="text-sm text-slate">Nenhum processo encontrado.</p>}
          {processes.map((process) => (
            <div
              key={process.id}
              className="rounded-2xl border border-ink/10 bg-white/70 p-4 shadow-soft transition hover:-translate-y-0.5 hover:bg-white/90"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-ink">{process.clientName ?? "Processo"}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate">
                    <span className="font-mono">{process.id}</span>
                    <span>·</span>
                    <span>Etapa: {process.currentStep}</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 md:justify-end">
                  <StatusBadge
                    status={process.status}
                    label={process.kanbanStage ? KANBAN_STAGE_LABELS[process.kanbanStage] : undefined}
                  />
                  <Link
                    href={`/operator/process/${process.id}`}
                    className="rounded-xl border border-brass/30 bg-brass/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink hover:border-brass"
                  >
                    Abrir caso
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </main>
  );
}




