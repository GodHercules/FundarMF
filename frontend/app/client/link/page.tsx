"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Card } from "@/components/Card";
import { Logo } from "@/components/Logo";
import { notifySuccess } from "@/lib/notify";
import Link from "next/link";

interface ProcessSummary {
  id: string;
  status: string;
}

function ClientLinkInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [token, setToken] = useState(searchParams.get("token") ?? "");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [otpStatus, setOtpStatus] = useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);

  function parseError(error: any) {
    const raw = error?.message ?? "";
    if (error?.code && typeof error.code === "string") {
      return { code: error.code, message: error?.raw ?? raw };
    }
    if (["OTP_INVALID", "OTP_EXPIRED", "OTP_REQUIRED", "LINK_INVALID", "OTP_TOO_SOON", "OTP_LIMIT_REACHED"].includes(raw)) {
      return { code: raw, message: raw };
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.message && typeof parsed.message === "object" && parsed.message.code) {
        return { code: parsed.message.code as string, message: parsed.message.message ?? raw };
      }
      if (parsed?.code) return { code: parsed.code as string, message: raw };
      if (parsed?.message && typeof parsed.message === "string") return { code: undefined, message: parsed.message };
    } catch {
      // ignore
    }
    return { code: undefined, message: raw };
  }

  async function redirectToProcess() {
    const processes = await api<ProcessSummary[]>("/processes?limit=10");
    const open = processes.find((process) => !["CONCLUIDO", "CANCELADO"].includes(process.status));
    if (open) {
      router.push(`/client/process/${open.id}`);
      return;
    }
    setMessage("Nenhum processo ativo encontrado. Solicite um novo link ao operador.");
  }

  async function handleVerify() {
    setMessage(null);
    setOtpStatus(null);
    try {
      await api("/auth/customer/verify", {
        method: "POST",
        body: JSON.stringify({ token, otp: otp || undefined })
      });
      notifySuccess("Acesso confirmado com sucesso.");
      await redirectToProcess();
    } catch (error: any) {
      const parsed = parseError(error);
      let displayMessage = parsed.message || "Erro ao validar link.";
      if (parsed.code === "OTP_INVALID") {
        setOtpStatus("OTP inválido. Envie um novo OTP para continuar.");
        displayMessage = "";
      } else if (parsed.code === "OTP_EXPIRED") {
        setOtpStatus("OTP expirado. Envie um novo OTP para continuar.");
        displayMessage = "";
      } else if (parsed.code === "OTP_REQUIRED") {
        setOtpStatus("OTP obrigatório para continuar.");
        displayMessage = "";
      } else if (parsed.code === "OTP_TOO_SOON") {
        setOtpStatus("Aguarde 24 horas para solicitar um novo OTP.");
        displayMessage = "";
      } else if (parsed.code === "OTP_LIMIT_REACHED") {
        setOtpStatus("Limite de OTP atingido. Solicite um novo processo ao operador.");
        displayMessage = "";
      } else if (parsed.code === "LINK_INVALID") {
        setMessage("Link inválido ou expirado.");
        return;
      }
      if (displayMessage) setMessage(displayMessage);
    }
  }

  async function handleResendOtp() {
    if (!token) return;
    setSendingOtp(true);
    setMessage(null);
    setOtpStatus(null);
    try {
      await api("/auth/customer/resend-otp", {
        method: "POST",
        body: JSON.stringify({ token })
      });
      setOtp("");
      setOtpStatus("Novo OTP enviado para o e-mail cadastrado.");
      notifySuccess("Novo OTP enviado para o e-mail cadastrado.");
    } catch (error: any) {
      const parsed = parseError(error);
      if (parsed.code === "OTP_TOO_SOON") {
        setOtpStatus("Aguarde 24 horas para solicitar um novo OTP.");
      } else if (parsed.code === "OTP_LIMIT_REACHED") {
        setOtpStatus("Limite de OTP atingido. Solicite um novo processo ao operador.");
      } else {
        setMessage(error.message ?? "Erro ao reenviar OTP.");
      }
    } finally {
      setSendingOtp(false);
    }
  }

  return (
    <main className="app-container flex min-h-screen flex-col gap-8 py-12">
      <Link href="/" className="text-sm font-semibold text-slate">
        Voltar
      </Link>
      <div className="flex flex-col gap-3">
        <Logo withText />
        <span className="badge bg-brass/15 text-ink">Validação segura</span>
        <h1 className="text-3xl font-semibold">Confirmar acesso</h1>
        <p className="text-slate">Insira o token e o OTP enviado pelo escritorio.</p>
      </div>
      <Card className="p-6 space-y-4">
        <div>
          <label className="text-sm font-semibold text-slate">Token</label>
          <Input value={token} onChange={(event) => setToken(event.target.value)} placeholder="token do link" />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate">OTP</label>
          <Input value={otp} onChange={(event) => setOtp(event.target.value)} placeholder="123456" />
        </div>
        <Button onClick={handleVerify} className="w-full">
          Entrar
        </Button>
        {otpStatus && <p className="text-sm text-slate">{otpStatus}</p>}
        <Button onClick={handleResendOtp} className="w-full bg-ink" disabled={!token || sendingOtp}>
          {sendingOtp ? "Enviando OTP..." : "Enviar novo OTP"}
        </Button>
        {message && <p className="text-sm text-slate">{message}</p>}
      </Card>
    </main>
  );
}

export default function ClientLink() {
  return (
    <Suspense fallback={<div className="p-8">Carregando...</div>}>
      <ClientLinkInner />
    </Suspense>
  );
}

