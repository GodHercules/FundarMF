"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Card } from "@/components/Card";
import Link from "next/link";

export default function ClientLink() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [token, setToken] = useState(searchParams.get("token") ?? "");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function handleVerify() {
    setMessage(null);
    try {
      await api("/auth/customer/verify", {
        method: "POST",
        body: JSON.stringify({ token, otp: otp || undefined })
      });
      router.push("/client/dashboard");
    } catch (error: any) {
      setMessage(error.message ?? "Erro ao validar link.");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
      <Link href="/client" className="text-sm font-semibold text-slate">
        ← Voltar
      </Link>
      <div className="flex flex-col gap-3">
        <span className="badge bg-brass/15 text-ink">Validação segura</span>
        <h1 className="text-3xl font-semibold">Confirmar acesso</h1>
        <p className="text-slate">Insira o token do link e o OTP enviado pelo escritório.</p>
      </div>
      <Card className="p-6 space-y-4">
        <div>
          <label className="text-sm font-semibold text-slate">Token</label>
          <Input value={token} onChange={(event) => setToken(event.target.value)} placeholder="token do link" />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate">OTP (se necessário)</label>
          <Input value={otp} onChange={(event) => setOtp(event.target.value)} placeholder="123456" />
        </div>
        <Button onClick={handleVerify} className="w-full">
          Entrar no painel
        </Button>
        {message && <p className="text-sm text-slate">{message}</p>}
      </Card>
    </main>
  );
}
