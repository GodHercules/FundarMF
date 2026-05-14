"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { PhoneInput } from "@/components/PhoneInput";
import { Card } from "@/components/Card";
import { Logo } from "@/components/Logo";
import { notifySuccess } from "@/lib/notify";

export default function OperatorRequestLink() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [message, setMessage] = useState<string | null>(null);
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

  async function handleSubmit() {
    setMessage(null);
    if (!name.trim()) {
      setMessage("Informe o nome do cliente.");
      return;
    }
    if (!email && !whatsapp) {
      setMessage("Informe e-mail ou telefone para enviar o link.");
      return;
    }
    try {
      const result = await api<{ id: string }>("/processes", {
        method: "POST",
        body: JSON.stringify({
          nome: name || undefined,
          email: email || undefined,
          telefone: whatsapp || undefined,
          sendEmail: Boolean(email),
          sendWhatsapp: Boolean(whatsapp)
        })
      });
      setMessage("Link seguro enviado para o cliente.");
      notifySuccess("Link de acesso enviado.");
      if (result?.id) {
        router.push(`/operator/process/${result.id}`);
      } else {
        router.push("/operator/dashboard");
      }
    } catch (error: any) {
      setMessage(error.message ?? "Erro ao solicitar link.");
    }
  }

  if (checking) {
    return <div className="p-8">Carregando...</div>;
  }

  return (
    <main className="app-container flex min-h-screen flex-col gap-8 py-12">
      <Link href="/operator/start" className="text-sm font-semibold text-slate">
        Voltar
      </Link>
      <div className="flex flex-col gap-3">
        <Logo withText />
        <span className="badge bg-emerald/15 text-ink">Envio de link</span>
        <h1 className="text-3xl font-semibold">Enviar acesso ao cliente</h1>
        <p className="text-slate">Informe a empresa e os contatos do cliente para envio do link seguro.</p>
      </div>
      <Card className="p-6">
        <label className="text-sm font-semibold text-slate">Nome do cliente</label>
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.:  Fulando da Silva Santos" />
        <div className="mt-4">
          <label className="text-sm font-semibold text-slate">E-mail do cliente</label>
          <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="cliente@email.com" />
        </div>
        <div className="mt-4">
          <PhoneInput
            label="Telefone/WhatsApp do cliente"
            value={whatsapp}
            onChange={setWhatsapp}
          />
        </div>
        <Button variant="accent" onClick={handleSubmit} className="mt-4 w-full">
          Enviar link seguro
        </Button>
        {message && <p className="mt-4 text-sm text-slate">{message}</p>}
      </Card>
    </main>
  );
}
