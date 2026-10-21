"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiArrowUpRight, FiBriefcase, FiCheck, FiFileText, FiShield } from "react-icons/fi";
import { api } from "@/lib/api";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { PasswordField } from "@/components/PasswordField";
import { SESSION_EXPIRED_MESSAGE } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Warm up backend on free-tier cold starts so login request is faster.
    void fetch("/api/public/health", { method: "GET", credentials: "include", cache: "no-store" }).catch(() => {});
    const reason = new URLSearchParams(window.location.search).get("reason");
    let storedMessage: string | null = null;
    try {
      storedMessage = window.sessionStorage.getItem("fundarmf:session-message");
    } catch {
      // Storage can be unavailable in private browsing; the query reason is enough.
    }
    if (reason === "session-expired" || storedMessage) {
      setMessage(SESSION_EXPIRED_MESSAGE);
      try {
        window.sessionStorage.removeItem("fundarmf:session-message");
      } catch {
        // Ignore unavailable storage after the message has been displayed.
      }
      window.history.replaceState({}, "", "/");
    }
  }, []);

  async function handleLogin() {
    setMessage(null);
    setLoading(true);
    try {
      const result = await api<{ role: "OPERATOR" | "MASTER" }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      if (result.role === "MASTER") {
        router.push("/master/dashboard");
      } else {
        const entry = await api<{ hasProcesses: boolean }>("/processes/entry-destination");
        router.push(entry.hasProcesses ? "/operator/dashboard" : "/operator/start");
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
        <div className="login-aside-grid" aria-hidden="true" />
        <div className="login-brand">
          <Logo size={68} />
          <div>
            <p className="login-brand-label">FundarMF</p>
            <p className="login-brand-name">Abertura inteligente</p>
          </div>
        </div>

        <div className="login-aside-copy">
          <span className="login-kicker"><FiBriefcase aria-hidden="true" /> Abertura de empresa</span>
          <h2 className="login-aside-title">Seu CNPJ começa com um próximo passo claro.</h2>
          <p className="login-aside-copy-subtitle">Dados, documentos e decisões tributárias organizados em um único fluxo — do primeiro contato à empresa pronta.</p>
        </div>

        <div className="login-visual" aria-label="Resumo visual de uma abertura de empresa">
          <div className="login-visual-orbit login-visual-orbit--one" aria-hidden="true" />
          <div className="login-visual-orbit login-visual-orbit--two" aria-hidden="true" />
          <div className="login-document-card login-document-card--back" aria-hidden="true">
            <FiFileText />
            <span>Documentos</span>
            <strong>07 anexos</strong>
          </div>
          <div className="login-document-card login-document-card--main">
            <div className="login-document-head">
              <div className="login-document-logo"><Logo size={34} /></div>
              <div>
                <span>FundarMF</span>
                <strong>Cadastro em andamento</strong>
              </div>
              <FiArrowUpRight aria-hidden="true" />
            </div>
            <div className="login-document-id"><span>CNPJ</span><strong>Em preparação</strong></div>
            <div className="login-document-lines" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="login-document-footer"><FiCheck aria-hidden="true" /> Dados organizados para a próxima etapa</div>
          </div>
          <div className="login-visual-note"><FiShield aria-hidden="true" /><span>Fluxo seguro e acompanhado</span></div>
        </div>

        <div className="login-aside-footer"><span>Acesso restrito à equipe FundarMF</span><span className="login-footer-rule" aria-hidden="true" /></div>
      </section>

      <section className="login-content" aria-labelledby="login-title">
        <div className="login-form-wrap">
          <div className="login-mobile-brand"><Logo size={52} /><span>FundarMF</span></div>
          <div className="login-form-intro">
            <span className="login-kicker login-kicker--dark"><FiShield aria-hidden="true" /> Área restrita</span>
            <h1 id="login-title">Acesse seu painel</h1>
            <p className="login-intro">Entre para acompanhar a abertura de empresas e manter cada etapa no lugar certo.</p>
          </div>

          <Card className="login-card w-full p-6 sm:p-8">
            <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); void handleLogin(); }}>
              <div className="login-field">
                <label htmlFor="login-email">E-mail</label>
                <Input id="login-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seu@email.com" />
              </div>
              <div className="login-field">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="login-password">Senha</label>
                  <span className="login-field-hint">Acesso protegido</span>
                </div>
                <PasswordField id="login-password" autoComplete="current-password" value={password} onChange={setPassword} placeholder="Digite sua senha" showStrength={false} />
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
