"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";

export default function MasterLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function handleLogin() {
    setMessage(null);
    try {
      await api("/auth/master/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      router.push("/master/dashboard");
    } catch (error: any) {
      setMessage(error.message ?? "Erro ao entrar.");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
      <Link href="/" className="text-sm font-semibold text-slate">
        ← Voltar
      </Link>
      <div className="flex flex-col gap-3">
        <span className="badge bg-brass/15 text-ink">Governança</span>
        <h1 className="text-3xl font-semibold">Portal Master</h1>
        <p className="text-slate">Acesso administrativo global e auditoria.</p>
      </div>
      <Card className="p-6 space-y-4">
        <div>
          <label className="text-sm font-semibold text-slate">E-mail</label>
          <Input value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate">Senha</label>
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        <Button onClick={handleLogin} className="w-full">
          Entrar no painel
        </Button>
        {message && <p className="text-sm text-slate">{message}</p>}
      </Card>
    </main>
  );
}
