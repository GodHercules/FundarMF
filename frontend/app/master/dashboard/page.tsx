"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/Stepper";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { PhoneInput } from "@/components/PhoneInput";
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
  const [loadingProcesses, setLoadingProcesses] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [processOffset, setProcessOffset] = useState(0);
  const [userOffset, setUserOffset] = useState(0);
  const [hasMoreProcesses, setHasMoreProcesses] = useState(true);
  const [hasMoreUsers, setHasMoreUsers] = useState(true);

  const processPageSize = 8;
  const userPageSize = 10;

  async function loadProcesses(nextOffset = 0, append = false) {
    setLoadingProcesses(true);
    try {
      const data = await api(`/processes?limit=${processPageSize}&offset=${nextOffset}`);
      const list = data as any[];
      setProcesses((prev) => (append ? [...prev, ...list] : list));
      setHasMoreProcesses(list.length === processPageSize);
      setProcessOffset(nextOffset + list.length);
    } finally {
      setLoadingProcesses(false);
    }
  }

  async function loadUsers(nextOffset = 0, append = false) {
    setLoadingUsers(true);
    try {
      const data = await api(`/admin/users?limit=${userPageSize}&offset=${nextOffset}`);
      const list = data as any[];
      setUsers((prev) => (append ? [...prev, ...list] : list));
      setHasMoreUsers(list.length === userPageSize);
      setUserOffset(nextOffset + list.length);
    } finally {
      setLoadingUsers(false);
    }
  }

  async function loadUnassigned() {
    const data = await api("/admin/processes/unassigned");
    setUnassigned(data as any[]);
  }

  async function loadAll() {
    await Promise.all([loadProcesses(0, false), loadUsers(0, false), loadUnassigned()]);
  }

  useEffect(() => {
    loadAll();
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
      await loadUsers(0, false);
    } catch {
      // erros ja sao exibidos no notify global
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
      await Promise.all([loadProcesses(0, false), loadUnassigned()]);
    } catch {
      // handled by api notify
    } finally {
      setAssigning(null);
    }
  }

  return (
    <main className="app-container flex min-h-screen flex-col gap-8 py-12">
      <Link href="/" className="text-sm font-semibold text-slate">
        {"<- Sair"}
      </Link>
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2">
          <Logo withText />
          <span className="badge bg-brass/15 text-ink">Governança</span>
          <h1 className="text-3xl font-semibold">Visão global</h1>
          <p className="text-slate">Gestão completa, auditoria e SLAs.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" onClick={() => setShowCreateUser(true)}>
            Novo operador
          </Button>
        </div>
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
          </div>
          <div className="mt-4 space-y-3">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between">
                <span className="text-sm text-slate">{user.name}</span>
                <span className="text-xs text-slate">{user.role === "OPERATOR" ? "OPERADOR" : "MASTER"}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate">
            <span>Mostrando {users.length} usuarios</span>
            <button
              type="button"
              className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => loadUsers(userOffset, true)}
              disabled={!hasMoreUsers || loadingUsers}
            >
              {loadingUsers ? "Carregando..." : hasMoreUsers ? "Carregar mais" : "Fim da lista"}
            </button>
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
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">Responsável</label>
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

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate">
        <span>Mostrando {processes.length} processos</span>
        <button
          type="button"
          className="rounded-full border border-ink/15 px-4 py-2 font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => loadProcesses(processOffset, true)}
          disabled={!hasMoreProcesses || loadingProcesses}
        >
          {loadingProcesses ? "Carregando..." : hasMoreProcesses ? "Carregar mais" : "Fim da lista"}
        </button>
      </div>

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
            <div className="mt-4 grid gap-5">
              <div className="grid gap-4 md:grid-cols-2">
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
              </div>
              <div>
                <PhoneInput
                  label="WhatsApp (opcional)"
                  value={newUser.whatsapp}
                  onChange={(value) => setNewUser((prev) => ({ ...prev, whatsapp: value }))}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
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

