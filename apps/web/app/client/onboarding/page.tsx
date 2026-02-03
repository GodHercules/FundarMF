"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card } from "@/components/Card";
import { Logo } from "@/components/Logo";

interface ProcessSummary {
  id: string;
  status: string;
  currentStep: string;
  clientName?: string;
}

export default function ClientOnboarding() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [actorInfo, setActorInfo] = useState<{ email?: string; whatsapp?: string }>({});

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [{ actor }, processes] = await Promise.all([
          api<{ actor: { email?: string; whatsapp?: string } }>("/auth/me"),
          api<ProcessSummary[]>("/processes")
        ]);

        if (!active) return;

        const openProcesses = processes.filter(
          (process) => !["CONCLUIDO", "CANCELADO"].includes(process.status)
        );

        if (openProcesses.length === 1) {
          router.replace(`/client/process/${openProcesses[0].id}`);
          return;
        }

        if (openProcesses.length > 1) {
          router.replace("/client/dashboard");
          return;
        }

        setActorInfo({ email: actor.email ?? undefined, whatsapp: actor.whatsapp ?? undefined });
      } catch (error) {
        router.replace("/client");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [router]);

  if (loading) {
    return <div className="p-8">Carregando...</div>;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-screen-xl flex-col gap-8 px-4 py-16 sm:px-6 lg:px-10 2xl:px-16">
      <Link href="/client" className="text-sm font-semibold text-slate">
        ← Voltar
      </Link>
      <div className="flex flex-col gap-3">
        <Logo withText />
        <span className="badge bg-brass/15 text-ink">Aguardando início</span>
        <h1 className="text-3xl font-semibold">Seu processo será iniciado pelo operador</h1>
        <p className="text-slate">
          O operador responsável cria o processo e envia o link seguro. Assim que o processo estiver ativo, você verá as
          etapas aqui.
        </p>
      </div>
      <Card className="p-6 space-y-3">
        <p className="text-sm text-slate">
          Assim que o operador iniciar o processo, você poderá preencher o formulário e enviar documentos.
        </p>
        <div className="text-sm text-slate">
          <p className="font-semibold text-ink">Seus dados de acesso</p>
          <p>E-mail: {actorInfo.email ?? "não informado"}</p>
          <p>WhatsApp: {actorInfo.whatsapp ?? "não informado"}</p>
        </div>
      </Card>
    </main>
  );
}
