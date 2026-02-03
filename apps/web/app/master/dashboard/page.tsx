"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/Stepper";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { PasswordField } from "@/components/PasswordField";
import { notifyError, notifySuccess } from "@/lib/notify";

export default function MasterDashboard() {
  const [processes, setProcesses] = useState<any[]>([]);
  const [unassigned, setUnassigned] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [newUser, setNewUser] = useState({ name: "", email: "", whatsapp: "", password: "", confirmPassword: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);

  async function load() {
    const [p, u, un] = await Promise.all([
      api("/processes"),
      api("/admin/users"),
      api("/admin/processes/unassigned")
    ]);
    setProcesses(p as any[]);
    setUsers(u as any[]);
    setUnassigned(un as any[]);
  }

  useEffect(() => {
    load();
  }, []);

  function passwordIsAcceptable(value: string) {
    const hasMin = value.length >= 6;
    const hasUpper = /[A-Z]/.test(value);
    const hasLower = /[a-z]/.test(value);
    const hasNumber = /\d/.test(value);
    const hasSymbol = /[^A-Za-z0-9]/.test(value);
    const score = [hasUpper, hasLower, hasNumber, hasSymbol].filter(Boolean).length;
    return hasMin && score >= 2;
  }

  async function handleCreateUser() {
    setMessage(null);
    if (!newUser.name || !newUser.email || !newUser.password) {
      setMessage("Preencha todos os campos.");
      return;
    }
    if (newUser.password !== newUser.confirmPassword) {
      setMessage("As senhas não coincidem.");
      return;
    }
    if (!passwordIsAcceptable(newUser.password)) {
      setMessage("Senha fraca. Use 6+ caracteres e combine letras, números e símbolos.");
      return;
    }
    try {
      await api("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          name: newUser.name,
          email: newUser.email,
          whatsapp: newUser.whatsapp || undefined,
          password: newUser.password
        })
      });
      notifySuccess("Operador criado com sucesso.");
      setNewUser({ name: "", email: "", whatsapp: "", password: "", confirmPassword: "" });
      setShowCreateUser(false);
      load();
    } catch {
      // erros já são exibidos no notify global
    }
  }

  async function handleAssign(processId: string, ownerId: string) {
    if (!ownerId) {
      notifyError("Selecione um operador.");
      return;
    }
    setAssigning(processId);
    try {
      await api(`/admin/processes/${processId}/assign`, {
        method: "POST",
        body: JSON.stringify({ ownerId })
      });
      notifySuccess("Responsável atualizado.");
      load();
    } catch {
      // handled by api notify
    } finally {
      setAssigning(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-screen-2xl flex-col gap-8 px-4 py-16 sm:px-6 lg:px-10 2xl:px-16">
      <Link href="/master" className="text-sm font-semibold text-slate">
        ← Sair
      </Link>
      <header className="flex flex-col gap-2">
        <Logo withText />
        <span className="badge bg-brass/15 text-ink">Governança</span>
        <h1 className="text-3xl font-semibold">Visão global</h1>
        <p className="text-slate">Gestão completa, auditoria e SLAs.</p>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Casos sem dono</h2>
          <div className="mt-4 space-y-3">
            {unassigned.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <span className="text-sm text-slate">{item.id}</span>
                <StatusBadge status={item.status} />
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Operadores</h2>
            <Button className="bg-ink" onClick={() => setShowCreateUser(true)}>
              Novo operador
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between">
                <span className="text-sm text-slate">{user.name}</span>
                <span className="text-xs text-slate">{user.role === "OPERATOR" ? "OPERADOR" : "MASTER"}</span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        {processes.map((process) => (
          <Card key={process.id} className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{process.clientName ?? "Processo"}</h3>
                <p className="text-sm text-slate">Etapa atual: {process.currentStep}</p>
              </div>
              <StatusBadge status={process.status} />
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">
                Responsável
              </label>
              <select
                className="w-full rounded-xl border border-ink/15 bg-white px-4 py-2 text-sm text-ink shadow-sm focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/30"
                value={process.ownerId ?? ""}
                onChange={(event) => handleAssign(process.id, event.target.value)}
                disabled={assigning === process.id}
              >
                <option value="">Selecione</option>
                {users
                  .filter((user) => user.role === "OPERATOR")
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
              </select>
            </div>
          </Card>
        ))}
      </section>

      {showCreateUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 py-6">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-soft md:max-w-xl lg:max-w-2xl xl:max-w-3xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Criar novo operador</h2>
              <button
                type="button"
                className="rounded-full bg-slate/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate"
                onClick={() => setShowCreateUser(false)}
              >
                Fechar
              </button>
            </div>
              <p className="mt-2 text-sm text-slate">Defina os dados de acesso do colaborador.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Input
                placeholder="Nome completo"
                value={newUser.name}
                onChange={(event) => setNewUser((prev) => ({ ...prev, name: event.target.value }))}
              />
              <Input
                placeholder="E-mail"
                value={newUser.email}
                onChange={(event) => setNewUser((prev) => ({ ...prev, email: event.target.value }))}
              />
              <Input
                placeholder="WhatsApp (opcional)"
                value={newUser.whatsapp}
                onChange={(event) => setNewUser((prev) => ({ ...prev, whatsapp: event.target.value }))}
              />
              <PasswordField
                placeholder="Senha"
                value={newUser.password}
                onChange={(value) => setNewUser((prev) => ({ ...prev, password: value }))}
              />
              <PasswordField
                placeholder="Confirmar senha"
                value={newUser.confirmPassword}
                onChange={(value) => setNewUser((prev) => ({ ...prev, confirmPassword: value }))}
                showStrength={false}
                matchWith={newUser.password}
              />
            </div>
            <p className="mt-3 text-xs text-slate">
              A senha deve ter 6+ caracteres e combinar letras, números e símbolos.
            </p>
            <div className="mt-4 flex items-center justify-between">
              <Button className="bg-ink" onClick={handleCreateUser}>
                Criar operador
              </Button>
              {message && <p className="text-sm text-slate">{message}</p>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
