"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/Stepper";

interface ProcessSummary {
  id: string;
  clientName?: string;
  status: string;
  currentStep: string;
}

export default function EmployeeDashboard() {
  const [processes, setProcesses] = useState<ProcessSummary[]>([]);

  async function load() {
    const data = await api<ProcessSummary[]>("/processes");
    setProcesses(data);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-16">
      <Link href="/employee" className="text-sm font-semibold text-slate">
        ← Sair
      </Link>
      <header className="flex flex-col gap-2">
        <span className="badge bg-emerald/15 text-ink">Painel interno</span>
        <h1 className="text-3xl font-semibold">Meus casos</h1>
        <p className="text-slate">Acompanhe validações, correções e SLAs.</p>
      </header>

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
            <Link href={`/employee/process/${process.id}`} className="mt-4 inline-flex text-sm font-semibold text-brass">
              Abrir caso →
            </Link>
          </Card>
        ))}
      </section>
    </main>
  );
}
