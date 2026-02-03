"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
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

  async function handleLogin() {
    setMessage(null);
    try {
      await api("/auth/operator/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      notifySuccess("Login realizado com sucesso.");
      router.push("/operator/dashboard");
    } catch (error: any) {
      setMessage(error.message ?? "Erro ao entrar.");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-screen-xl flex-col gap-8 px-4 py-16 sm:px-6 lg:px-10 2xl:px-16">
      <Link href="/" className="text-sm font-semibold text-slate">
        ← Voltar
      </Link>
      <div className="flex flex-col gap-3">
        <Logo withText />
        <span className="badge bg-emerald/15 text-ink">Portal interno</span>
        <h1 className="text-3xl font-semibold">Área do operador</h1>
        <p className="text-slate">Acesso interno para validação, SLA e atendimento ao cliente.</p>
      </div>
      <Card className="p-6 space-y-4">
        <div>
          <label className="text-sm font-semibold text-slate">E-mail</label>
          <Input value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate">Senha</label>
          <PasswordField value={password} onChange={setPassword} placeholder="Digite sua senha" showStrength={false} />
        </div>
        <Button onClick={handleLogin} className="w-full">
          Entrar no painel
        </Button>
        {message && <p className="text-sm text-slate">{message}</p>}
      </Card>
    </main>
  );
}
