"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ApiError, api } from "@/lib/api";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Logo } from "@/components/Logo";
import { SupportChat } from "@/components/SupportChat";
import { notifySuccess } from "@/lib/notify";
import Link from "next/link";

interface ProcessSummary {
  id: string;
  status: string;
}

function ClientLinkInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryToken = searchParams.get("token") ?? "";
  const [token, setToken] = useState(queryToken);
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [otpStatus, setOtpStatus] = useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (queryToken && typeof window !== "undefined") {
      window.history.replaceState(null, "", "/client/link");
    }
  }, [queryToken]);

  function parseError(error: unknown) {
    const details = error instanceof ApiError ? error : error instanceof Error ? error : null;
    const raw = details?.message ?? "";
    if (error instanceof ApiError && error.code) {
      return { code: error.code, message: error.raw ?? raw };
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
    if (verifying) return;
    setMessage(null);
    setOtpStatus(null);
    setVerifying(true);
    try {
      await api("/auth/customer/verify", {
        method: "POST",
        body: JSON.stringify({ token, otp: otp || undefined })
      });
      notifySuccess("Acesso confirmado com sucesso.");
      await redirectToProcess();
    } catch (error: unknown) {
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
        setOtpStatus("Aguarde alguns minutos para solicitar um novo OTP.");
        displayMessage = "";
      } else if (parsed.code === "OTP_LIMIT_REACHED") {
        setOtpStatus("Limite de OTP atingido. Solicite um novo processo ao operador.");
        displayMessage = "";
      } else if (parsed.code === "LINK_INVALID") {
        setMessage("Link inválido ou expirado.");
        return;
      }
      if (displayMessage) setMessage(displayMessage);
    } finally {
      setVerifying(false);
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
    } catch (error: unknown) {
      const parsed = parseError(error);
      if (parsed.code === "OTP_TOO_SOON") {
        setOtpStatus("Aguarde alguns minutos para solicitar um novo OTP.");
      } else if (parsed.code === "OTP_LIMIT_REACHED") {
        setOtpStatus("Limite de OTP atingido. Solicite um novo processo ao operador.");
      } else {
        setMessage(error instanceof Error ? error.message : "Erro ao reenviar OTP.");
      }
    } finally {
      setSendingOtp(false);
    }
  }

  return (
    <main className="client-portal client-auth-shell">
      <div className="client-auth-orbit" aria-hidden="true" />
      <div className="client-auth-layout">
        <section className="client-auth-intro">
          <Logo withText className="client-logo" />
          <span className="client-eyebrow">Acesso protegido</span>
          <h1>Seu processo,<br /><span>no seu ritmo.</span></h1>
          <p>Você está a poucos passos de enviar as informações para a abertura da sua empresa. A jornada foi desenhada para ser simples, segura e acompanhada.</p>
          <div className="client-auth-promise"><span aria-hidden="true">✓</span><div><strong>Ambiente seguro</strong><small>Seu token é usado somente para confirmar este acesso.</small></div></div>
        </section>
        <section className="client-auth-card" aria-labelledby="client-link-title">
          <Link href="/" className="client-topbar-link">← Voltar</Link>
          <span className="client-eyebrow mt-8">Confirmação de acesso</span>
          <h2 id="client-link-title">Vamos confirmar<br />que é você.</h2>
          <p className="client-auth-card-copy">Insira o token do link e o código de seis dígitos enviado pelo escritório.</p>
          <form className="client-auth-form" onSubmit={(event) => { event.preventDefault(); void handleVerify(); }}>
            <div className="client-auth-field"><label htmlFor="client-link-token">Token do link</label><Input id="client-link-token" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Cole o token recebido" autoComplete="off" /></div>
            <div className="client-auth-field"><label htmlFor="client-link-otp">Código de segurança</label><Input id="client-link-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" /><small>O código expira por segurança. Se necessário, solicite um novo.</small></div>
            <Button type="submit" className="client-auth-primary" disabled={!token || verifying}>{verifying ? "Confirmando acesso..." : "Continuar com segurança →"}</Button>
            {otpStatus && <p role="status" className="client-auth-status">{otpStatus}</p>}
            <button type="button" className="client-auth-resend" onClick={() => void handleResendOtp()} disabled={!token || sendingOtp}>{sendingOtp ? "Enviando novo código..." : "Não recebi o código · enviar novamente"}</button>
            {message && <p role="alert" className="client-auth-error">{message}</p>}
          </form>
          <p className="client-auth-footer">A MF Contabilidade nunca solicita seu token por mensagem.</p>
        </section>
      </div>
      <SupportChat />
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

