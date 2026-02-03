"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/Stepper";
import { Logo } from "@/components/Logo";

interface ProcessSummary {
  id: string;
  status: string;
  currentStep: string;
  clientName?: string;
}

export default function ClientDashboard() {
  const router = useRouter();
  const [processes, setProcesses] = useState<ProcessSummary[]>([]);
  const [message] = useState<string | null>(null);

  async function load() {
    const data = await api<ProcessSummary[]>("/processes");
    setProcesses(data);
  }

  useEffect(() => {
    load();
  }, []);

  const openProcesses = useMemo(
    () => processes.filter((process) => !["CONCLUIDO", "CANCELADO"].includes(process.status)),
    [processes]
  );

  useEffect(() => {
    if (openProcesses.length === 1) {
      router.replace(`/client/process/${openProcesses[0].id}`);
    }
  }, [openProcesses, router]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-screen-2xl flex-col gap-8 px-4 py-16 sm:px-6 lg:px-10 2xl:px-16">
      <Link href="/client" className="text-sm font-semibold text-slate">
        ← Sair
      </Link>
      <header className="flex flex-col gap-2">
        <Logo withText />
        <span className="badge bg-brass/15 text-ink">Painel do Cliente</span>
        <h1 className="text-3xl font-semibold">Seu painel contábil</h1>
        <p className="text-slate">Acompanhe seus processos ativos e conclua etapas pendentes.</p>
      </header>

      {openProcesses.length === 0 && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Nenhum processo ativo</h2>
          <p className="mt-2 text-sm text-slate">
            Aguarde o operador responsável iniciar o processo e enviar o link de acesso. Assim que estiver ativo, ele
            aparecerá aqui.
          </p>
          {message && <p className="mt-3 text-sm text-slate">{message}</p>}
        </Card>
      )}

      {openProcesses.length > 1 && (
        <section className="grid gap-6 md:grid-cols-2">
          {openProcesses.map((process) => (
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
      )}
    </main>
  );
}
