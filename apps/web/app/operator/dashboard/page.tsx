"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/Stepper";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { notifySuccess } from "@/lib/notify";
import { maskPhone } from "@/lib/masks";

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
  processId?: string | null;
  type: string;
};

export default function OperatorDashboard() {
  const [processes, setProcesses] = useState<ProcessSummary[]>([]);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    sendEmail: true,
    sendWhatsapp: true
  });

  async function load() {
    const [processesData, notificationsData, unread] = await Promise.all([
      api<ProcessSummary[]>("/processes"),
      api<InAppNotification[]>("/notifications"),
      api<{ count: number }>("/notifications/unread-count")
    ]);
    setProcesses(processesData);
    setNotifications(notificationsData);
    setUnreadCount(unread.count);
  }

  useEffect(() => {
    load();
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
      load();
    } finally {
      setCreating(false);
    }
  }

  async function markRead(id: string) {
    await api(`/notifications/${id}/read`, { method: "PATCH" });
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, readAt: new Date().toISOString() } : item)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-screen-2xl flex-col gap-8 px-4 py-16 sm:px-6 lg:px-10 2xl:px-16">
      <Link href="/operator" className="text-sm font-semibold text-slate">
        ← Sair
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
            {notifications.length === 0 && <p className="text-sm text-slate">Nenhuma notificação recente.</p>}
            {notifications.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className={`rounded-xl border border-ink/10 p-3 text-sm ${
                  item.readAt ? "bg-white/60 text-slate" : "bg-brass/10 text-ink"
                }`}
              >
                <p className="font-semibold">{item.title}</p>
                <p className="mt-1">{item.body}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-slate">
                  <span>{new Date(item.createdAt).toLocaleString("pt-BR")}</span>
                  {!item.readAt && (
                    <button className="font-semibold text-brass" onClick={() => markRead(item.id)}>
                      Marcar como lida
                    </button>
                  )}
                </div>
              </div>
            ))}
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
            <Input
              placeholder="WhatsApp do cliente"
              value={form.telefone}
              onChange={(event) => setForm((prev) => ({ ...prev, telefone: maskPhone(event.target.value) }))}
              inputMode="numeric"
              maxLength={15}
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
            <Button onClick={handleCreate} className="bg-emerald" disabled={creating}>
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
              Abrir caso →
            </Link>
          </Card>
        ))}
      </section>
    </main>
  );
}
