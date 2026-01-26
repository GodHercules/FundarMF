"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/Stepper";
import { Input } from "@/components/Input";

export default function EmployeeProcess() {
  const params = useParams();
  const processId = params?.id as string;
  const [process, setProcess] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [correctionReason, setCorrectionReason] = useState("");

  async function load() {
    const data = await api(`/processes/${processId}`);
    setProcess(data);
  }

  useEffect(() => {
    if (processId) load();
  }, [processId]);

  async function approve(stepKey: string) {
    setMessage(null);
    await api(`/processes/${processId}/approve-step`, {
      method: "POST",
      body: JSON.stringify({ stepKey })
    });
    setMessage("Etapa aprovada.");
    load();
  }

  async function requestCorrection(stepKey: string) {
    setMessage(null);
    await api(`/processes/${processId}/request-correction`, {
      method: "POST",
      body: JSON.stringify({ stepKey, fields: ["campo1"], reason: correctionReason || "Ajustar" })
    });
    setMessage("Correção solicitada.");
    load();
  }

  async function cancelProcess() {
    setMessage(null);
    await api(`/processes/${processId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: "Cancelado pelo funcionário" })
    });
    setMessage("Processo cancelado.");
    load();
  }

  if (!process) return <div className="p-8">Carregando...</div>;

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-12">
      <Link href="/employee/dashboard" className="text-sm font-semibold text-slate">
        ← Voltar
      </Link>
      <header className="flex flex-col gap-2">
        <span className="badge bg-emerald/15 text-ink">Caso em análise</span>
        <h1 className="text-3xl font-semibold">Caso {process.id}</h1>
        <div className="flex items-center gap-3">
          <StatusBadge status={process.status} />
          <span className="text-sm text-slate">Etapa atual: {process.currentStep}</span>
        </div>
        <div>
          <Button className="bg-clay" onClick={cancelProcess}>
            Cancelar processo
          </Button>
        </div>
      </header>

      {message && <p className="text-sm text-slate">{message}</p>}

      <section className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Checklist</h2>
          <p className="text-sm text-slate">Marque itens e aprove quando tudo estiver completo.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={() => approve(process.currentStep)}>Aprovar etapa</Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Solicitar correção</h2>
          <Input
            placeholder="Motivo da correção"
            value={correctionReason}
            onChange={(event) => setCorrectionReason(event.target.value)}
          />
          <Button onClick={() => requestCorrection(process.currentStep)} className="mt-3 bg-clay">
            Solicitar correção
          </Button>
        </Card>
      </section>

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Documentos</h2>
        <p className="text-sm text-slate">Faça o preview e aprove/reprove por item.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {(process.documents ?? []).map((doc: any) => (
            <div key={doc.id} className="rounded-xl border border-slate/10 bg-white/70 p-4">
              <p className="text-sm font-semibold">{doc.itemKey}</p>
              <p className="text-xs text-slate">Status: {doc.status}</p>
            </div>
          ))}
        </div>
      </Card>
    </main>
  );
}
