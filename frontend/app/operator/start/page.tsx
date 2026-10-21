"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceNav } from "@/components/WorkspaceNav";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { api } from "@/lib/api";

export default function OperatorStart() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const data = await api<{ actor?: { role?: string } }>("/auth/me");
        if (!active) return;
        const role = data?.actor?.role;
        if (role === "MASTER") {
          router.replace("/master/dashboard");
        } else if (role !== "OPERADOR") {
          router.replace("/");
        } else {
          const entry = await api<{ hasProcesses: boolean }>("/processes/entry-destination");
          if (entry.hasProcesses) router.replace("/operator/dashboard");
        }
      } catch {
        return;
      } finally {
        if (active) setChecking(false);
      }
    }

    checkSession();
    return () => {
      active = false;
    };
  }, [router]);

  if (checking) {
    return <div className="p-8">Carregando...</div>;
  }

  return (
    <main className="app-container flex min-h-screen flex-col gap-8 py-12">
      <WorkspaceNav role="operator" />
      <header className="operator-page-header"><div><p className="operator-breadcrumb">Portal operador / Novo processo</p><h1>Iniciar processo</h1><p>Comece um novo atendimento e envie o link seguro ao cliente.</p></div><Link href="/operator/dashboard" className="operator-secondary-action">Voltar ao painel</Link></header>

      <Card className="p-6 space-y-4">
        <Button variant="accent" className="w-full" onClick={() => router.push("/operator/request-link")}>
          Iniciar novo processo
        </Button>
        <Link href="/operator/dashboard" className="text-sm font-semibold text-brass">
          Ver meus processos
        </Link>
      </Card>
    </main>
  );
}
