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
import { notifySuccess } from "@/lib/notify";

interface ProcessSummary {
  id: string;
  clientName?: string;
  status: string;
  currentStep: string;
}

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

export default function OperatorDashboard() {
  const [processes, setProcesses] = useState<ProcessSummary[]>([]);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
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
    await api(`/notifications/${id}/read`, { method: "PATCH" });
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, readAt: new Date().toISOString() } : item)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }

  async function dismiss(id: string) {
    await api(`/notifications/${id}/dismiss`, { method: "PATCH" });
    const removed = notifications.find((n) => n.id === id);
    setNotifications((prev) => prev.filter((item) => item.id !== id));
    if (removed && !removed.readAt) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  }

  const nowMs = Date.now();
  const readCutoffMs = nowMs - READ_HIDE_AFTER_DAYS * MS_DAY;
  const unreadPinMs = nowMs - UNREAD_PIN_AFTER_DAYS * MS_DAY;

  const visibleNotifications = notifications.filter((item) => !item.dismissedAt);

  const unreadNotifications = [...visibleNotifications]
    .filter((item) => !item.readAt)
    .sort((a, b) => {
      const aMs = new Date(a.createdAt).getTime();
      const bMs = new Date(b.createdAt).getTime();
      const aPinned = aMs <= unreadPinMs;
      const bPinned = bMs <= unreadPinMs;
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      return bMs - aMs;
    });

  const readNotifications = [...visibleNotifications]
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
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Notificações</h2>
            <span className="badge bg-ink text-white">{unreadCount} não lidas</span>
          </div>
          <div className="mt-4 space-y-3">
            {visibleNotifications.length === 0 && <p className="text-sm text-slate">Nenhuma notificação recente.</p>}

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">Não lidas</span>
              <span className="text-xs text-slate">{unreadNotifications.length}</span>
            </div>

            {unreadNotifications.length === 0 && (
              <p className="rounded-xl border border-ink/10 bg-white/60 p-3 text-sm text-slate">Sem notificações não lidas.</p>
            )}

            {unreadNotifications.map((item) => {
              const pinned = new Date(item.createdAt).getTime() <= unreadPinMs;
              return (
                <div key={item.id} className="rounded-xl border border-ink/10 bg-brass/10 p-3 text-sm text-ink">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{item.title}</p>
                        {pinned && <span className="badge bg-rose-500/15 text-rose-700">Atrasada</span>}
                      </div>
                      <p className="mt-1">{item.body}</p>
                    </div>
                    <button
                      type="button"
                      className="rounded-full border border-ink/15 px-2 py-1 text-xs font-semibold text-ink hover:border-brass"
                      onClick={() => dismiss(item.id)}
                      aria-label="Fechar notificação"
                      title="Fechar"
                    >
                      x
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate">
                    <span>{new Date(item.createdAt).toLocaleString("pt-BR")}</span>
                    <button className="font-semibold text-brass" onClick={() => markRead(item.id)}>
                      Marcar como lida
                    </button>
                  </div>
                </div>
              );
            })}

            <div className="mt-5 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">Lidas (últimos {READ_HIDE_AFTER_DAYS} dias)</span>
              <span className="text-xs text-slate">{readNotifications.length}</span>
            </div>

            {readNotifications.length === 0 && (
              <p className="rounded-xl border border-ink/10 bg-white/60 p-3 text-sm text-slate">Sem notificações lidas recentes.</p>
            )}

            {readNotifications.map((item) => (
              <div key={item.id} className="rounded-xl border border-ink/10 bg-white/60 p-3 text-sm text-slate">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-1">{item.body}</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-ink/15 px-2 py-1 text-xs font-semibold text-ink hover:border-brass"
                    onClick={() => dismiss(item.id)}
                    aria-label="Fechar notificação"
                    title="Fechar"
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
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate">
            <span>Mostrando {visibleNotifications.length} notificações</span>
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
            Preencha os dados do cliente e envie o link seguro por e-mail e/ou WhatsApp.
          </p>
          <div className="mt-4 grid gap-3">
            <Input
              placeholder="Nome do cliente"
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

      <section className="grid gap-6 md:grid-cols-2">
        {processes.map((process) => (
          <Card key={process.id} className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{process.clientName ?? "Processo"}</h3>
                <p className="text-sm text-slate">Etapa atual: {process.currentStep}</p>
              </div>
              <StatusBadge status={process.status} />
            </div>
            <Link href={`/operator/process/${process.id}`} className="mt-4 inline-flex text-sm font-semibold text-brass">
              Abrir caso {"->"}
            </Link>
          </Card>
        ))}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate">
        <span>Mostrando {processes.length} processos</span>
        <button
          type="button"
          className="rounded-full border border-ink/15 px-4 py-2 font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => loadProcesses(processOffset, true)}
          disabled={!hasMoreProcesses || loadingProcesses}
        >
          {loadingProcesses ? "Carregando..." : hasMoreProcesses ? "Carregar mais" : "Fim da lista"}
        </button>
      </div>
    </main>
  );
}




