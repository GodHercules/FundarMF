"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { PhoneInput } from "@/components/PhoneInput";
import { Card } from "@/components/Card";
import { WorkspaceNav } from "@/components/WorkspaceNav";
import { notifySuccess } from "@/lib/notify";

export default function OperatorRequestLink() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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

  async function handleSubmit() {
    if (submitting) return;
    setMessage(null);
    if (!name.trim()) {
      setMessage("Informe o nome do cliente.");
      return;
    }
    if (!email && !whatsapp) {
      setMessage("Informe e-mail ou telefone para enviar o link.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await api<{ id: string }>("/processes", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
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
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Erro ao solicitar link.");
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return <div className="p-8">Carregando...</div>;
  }

  return (
    <main className="app-container flex min-h-screen flex-col gap-8 py-12">
      <WorkspaceNav role="operator" />
      <header className="operator-page-header"><div><p className="operator-breadcrumb"><Link href="/operator/start">Novo processo</Link> / Enviar acesso</p><h1>Enviar acesso ao cliente</h1><p>Informe a empresa e os contatos para envio do link seguro.</p></div><Link href="/operator/start" className="operator-secondary-action">Voltar</Link></header>
      <Card className="p-6">
        <label htmlFor="request-link-name" className="text-sm font-semibold text-slate">Nome do cliente</label>
        <Input id="request-link-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Fulano da Silva Santos" />
        <div className="mt-4">
          <label htmlFor="request-link-email" className="text-sm font-semibold text-slate">E-mail do cliente</label>
          <Input id="request-link-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="cliente@email.com" />
        </div>
        <div className="mt-4">
          <PhoneInput
            label="Telefone/WhatsApp do cliente"
            value={whatsapp}
            onChange={setWhatsapp}
          />
        </div>
        <Button variant="accent" onClick={handleSubmit} className="mt-4 w-full" disabled={submitting}>
          {submitting ? "Enviando..." : "Enviar link seguro"}
        </Button>
        {message && <p className="mt-4 text-sm text-slate">{message}</p>}
      </Card>
    </main>
  );
}
