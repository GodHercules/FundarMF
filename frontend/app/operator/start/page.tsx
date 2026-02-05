"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";

export default function OperatorStart() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const response = await fetch("/api/auth/me", { credentials: "include" });
        if (!response.ok) return;
        const data = await response.json();
        if (!active) return;
        const role = data?.actor?.role;
        if (role === "MASTER") {
          router.replace("/master/dashboard");
        } else if (role !== "OPERADOR") {
          router.replace("/");
        }
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
      <Link href="/" className="text-sm font-semibold text-slate">
        {"<- Sair"}
      </Link>
      <div className="flex flex-col gap-3">
        <Logo withText />
        <span className="badge bg-emerald/15 text-ink">Área do operador</span>
        <h1 className="text-3xl font-semibold">Iniciar processo</h1>
        <p className="text-slate">Comece um novo processo e envie o link seguro ao cliente.</p>
      </div>

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
