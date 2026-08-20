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
    <main className="login-screen">
      <section className="login-aside" aria-label="Sobre o FundarMF">
        <div className="login-brand">
          <Logo size={68} />
          <div>
            <p className="login-brand-kicker">FundarMF</p>
            <p className="login-brand-name">Portal contábil</p>
          </div>
        </div>
        <div className="login-aside-copy">
          <span className="login-eyebrow">Workflow para abertura de empresa</span>
          <h1>Clareza para cada etapa do processo.</h1>
          <p>Organize validações, documentos e decisões em um único lugar — do primeiro contato à conclusão.</p>
        </div>
        <div className="login-process-mark" aria-hidden="true">
          <span className="login-process-line" />
          <div><strong>01</strong><span>Dados recebidos</span></div>
          <div><strong>02</strong><span>Validação assistida</span></div>
          <div><strong>03</strong><span>Empresa concluída</span></div>
        </div>
        <p className="login-aside-footer">Acesso restrito à equipe FundarMF</p>
      </section>

      <section className="login-content" aria-labelledby="login-title">
        <div className="login-mobile-brand"><Logo size={52} /><span>FundarMF</span></div>
        <div className="login-form-wrap">
          <span className="login-eyebrow login-eyebrow-light">Acesso interno</span>
          <h2 id="login-title">Entrar no painel</h2>
          <p className="login-intro">Use suas credenciais para continuar a operação.</p>
          <Card className="login-card w-full p-6 sm:p-8">
            <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); void handleLogin(); }}>
            <div className="login-field">
              <label htmlFor="login-email">E-mail</label>
              <Input id="login-email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seu@email.com" />
            </div>
            <div className="login-field">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="login-password">Senha</label>
                <span className="login-field-hint">Acesso protegido</span>
              </div>
              <PasswordField id="login-password" value={password} onChange={setPassword} placeholder="Digite sua senha" showStrength={false} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
            {message && <p role="alert" className="text-sm text-clay">{message}</p>}
            </form>
          </Card>
          <p className="login-help">Problemas para acessar? Fale com o administrador do seu ambiente.</p>
        </div>
      </section>
    </main>
  );
}
