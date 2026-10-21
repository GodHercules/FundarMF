"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, SESSION_EXPIRED_MESSAGE } from "@/lib/api";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { notifySuccess } from "@/lib/notify";
import { PasswordField } from "@/components/PasswordField";

export default function OperatorLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("reason");
    let storedMessage: string | null = null;
    try {
      storedMessage = window.sessionStorage.getItem("fundarmf:session-message");
    } catch {
      // Storage can be unavailable in private browsing; the query reason is enough.
    }
    if (reason === "session-expired" || storedMessage) {
      setMessage(SESSION_EXPIRED_MESSAGE);
      try {
        window.sessionStorage.removeItem("fundarmf:session-message");
      } catch {
        // Ignore unavailable storage after the message has been displayed.
      }
      window.history.replaceState({}, "", "/operator");
    }
  }, []);

  async function handleLogin() {
    setMessage(null);
    try {
      await api("/auth/operator/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      notifySuccess("Login realizado com sucesso.");
      const entry = await api<{ hasProcesses: boolean }>("/processes/entry-destination");
      router.push(entry.hasProcesses ? "/operator/dashboard" : "/operator/start");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Erro ao entrar.");
    }
  }

  return (
    <main className="app-container flex min-h-screen flex-col gap-8 py-12">
      <Link href="/" className="text-sm font-semibold text-slate">
         Voltar
      </Link>
      <div className="flex flex-col gap-3">
        <Logo withText />
        <span className="badge bg-emerald/15 text-ink">Portal interno</span>
        <h1 className="text-3xl font-semibold">Área do operador</h1>
        <p className="text-slate">Acesso interno para validação, SLA e atendimento ao cliente.</p>
      </div>
      <Card className="w-full max-w-xl space-y-4 p-6">
        <div>
          <label htmlFor="operator-login-email" className="text-sm font-semibold text-slate">E-mail</label>
          <Input id="operator-login-email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div>
          <label htmlFor="operator-login-password" className="text-sm font-semibold text-slate">Senha</label>
          <PasswordField id="operator-login-password" value={password} onChange={setPassword} placeholder="Digite sua senha" showStrength={false} />
        </div>
        <Button onClick={handleLogin} className="w-full">
          Entrar no painel
        </Button>
        {message && <p role="alert" className="text-sm text-clay">{message}</p>}
      </Card>
    </main>
  );
}
