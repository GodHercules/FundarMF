"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Card } from "@/components/Card";
import Link from "next/link";

export default function ClientPortal() {
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit() {
    setMessage(null);
    try {
      if (!email && !whatsapp) {
        setMessage("Informe e-mail ou WhatsApp para receber o acesso.");
        return;
      }
      const result = await api<{ otpRequired: boolean }>("/auth/customer/request-link", {
        method: "POST",
        body: JSON.stringify({ email: email || undefined, whatsapp: whatsapp || undefined })
      });
      const channels = [
        email ? "e-mail" : null,
        whatsapp ? "WhatsApp" : null
      ]
        .filter(Boolean)
        .join(" e ");
      setMessage(
        result.otpRequired
          ? `Link e OTP enviados para seu ${channels}.`
          : `Link enviado para seu ${channels}.`
      );
    } catch (error: any) {
      setMessage(error.message ?? "Erro ao solicitar link.");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
      <Link href="/" className="text-sm font-semibold text-slate">
        ← Voltar
      </Link>
      <div className="flex flex-col gap-3">
        <span className="badge bg-brass/15 text-ink">Portal do Cliente</span>
        <h1 className="text-3xl font-semibold">Acesso contábil seguro</h1>
        <p className="text-slate">Receba o link com validação e acompanhe seu processo com transparência.</p>
      </div>
      <Card className="p-6">
        <label className="text-sm font-semibold text-slate">E-mail de contato</label>
        <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@email.com" />
        <label className="mt-4 text-sm font-semibold text-slate">WhatsApp (opcional)</label>
        <Input
          value={whatsapp}
          onChange={(event) => setWhatsapp(event.target.value)}
          placeholder="+55 11 99999-0000"
        />
        <Button onClick={handleSubmit} className="mt-4 w-full">
          Solicitar link seguro
        </Button>
        {message && <p className="mt-4 text-sm text-slate">{message}</p>}
      </Card>
      <Card className="p-6">
        <h2 className="text-lg font-semibold">Já recebeu o link?</h2>
        <p className="text-sm text-slate">Valide o token e o OTP para entrar no seu painel.</p>
        <Link href="/client/link" className="mt-4 inline-flex text-sm font-semibold text-brass">
          Validar acesso →
        </Link>
      </Card>
    </main>
  );
}
