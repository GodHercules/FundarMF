"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { PasswordField } from "@/components/PasswordField";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Warm up backend on free-tier cold starts so login request is faster.
    void api("/public/health", { method: "GET" }).catch(() => {});
  }, []);

  async function handleLogin() {
    setMessage(null);
    setLoading(true);
    try {
      const result = await api<{ role: "OPERATOR" | "MASTER" }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      if (result.role === "MASTER") {
        router.push("/master/dashboard");
      } else {
        router.push("/operator/start");
      }
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-container flex min-h-screen flex-col gap-8 py-12">
      <div className="flex flex-col gap-3">
        <Logo withText />
        <span className="badge bg-ink/10 text-ink">Acesso interno</span>
        <h1 className="text-3xl font-semibold">Login</h1>
        <p className="text-slate">Entre com seu e-mail e senha para acessar o painel.</p>
      </div>
      <Card className="p-6 space-y-4">
        <div>
          <label htmlFor="login-email" className="text-sm font-semibold text-slate">E-mail</label>
          <Input id="login-email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seu@email.com" />
        </div>
        <div>
          <label htmlFor="login-password" className="text-sm font-semibold text-slate">Senha</label>
          <PasswordField id="login-password" value={password} onChange={setPassword} placeholder="Digite sua senha" showStrength={false} />
        </div>
        <Button onClick={handleLogin} className="w-full" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </Button>
        {message && <p className="text-sm text-slate">{message}</p>}
      </Card>
    </main>
  );
}
