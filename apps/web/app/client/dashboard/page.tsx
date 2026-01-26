"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { StatusBadge } from "@/components/Stepper";

interface ProcessSummary {
  id: string;
  status: string;
  currentStep: string;
  clientName?: string;
}

export default function ClientDashboard() {
  const [processes, setProcesses] = useState<ProcessSummary[]>([]);
  const [form, setForm] = useState({ nome: "", email: "", telefone: "" });
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const data = await api<ProcessSummary[]>("/processes");
    setProcesses(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    setMessage(null);
    try {
      await api("/processes", {
        method: "POST",
        body: JSON.stringify(form)
      });
      setMessage("Processo criado com sucesso.");
      setForm({ nome: "", email: "", telefone: "" });
      load();
    } catch (error: any) {
      setMessage(error.message ?? "Erro ao criar processo.");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-16">
      <Link href="/client" className="text-sm font-semibold text-slate">
        ← Sair
      </Link>
      <header className="flex flex-col gap-2">
        <span className="badge bg-brass/15 text-ink">Painel do Cliente</span>
        <h1 className="text-3xl font-semibold">Seu painel contábil</h1>
        <p className="text-slate">Acompanhe seus processos ativos e conclua etapas pendentes.</p>
      </header>

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Abrir novo processo</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Input placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <Input placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input
            placeholder="Telefone"
            value={form.telefone}
            onChange={(e) => setForm({ ...form, telefone: e.target.value })}
          />
        </div>
        <Button className="mt-4" onClick={handleCreate}>
          Criar processo
        </Button>
        {message && <p className="mt-3 text-sm text-slate">{message}</p>}
      </Card>

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
            <Link href={`/client/process/${process.id}`} className="mt-4 inline-flex text-sm font-semibold text-brass">
              Ver detalhes →
            </Link>
          </Card>
        ))}
      </section>
    </main>
  );
}
