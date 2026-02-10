"use client";

import { useEffect, useRef, useState } from "react";
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
import { logClientPerf } from "@/lib/perf";

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
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const initialLoadStart = useRef<number | null>(null);
  const [processToDelete, setProcessToDelete] = useState<any | null>(null);
  const [operatorToDelete, setOperatorToDelete] = useState<any | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [confirmProcessText, setConfirmProcessText] = useState("");
  const [confirmOperatorText, setConfirmOperatorText] = useState("");
  const [deleting, setDeleting] = useState(false);

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
    setInitialLoadDone(true);
  }

  useEffect(() => {
    initialLoadStart.current = typeof performance !== "undefined" ? performance.now() : Date.now();
    loadAll();
  }, []);

  useEffect(() => {
    if (!initialLoadDone) return;
    const start = initialLoadStart.current;
    if (!start) return;
    logClientPerf("page_ready", {
      page: "master/dashboard",
      readyMs: Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - start)
    });
  }, [initialLoadDone]);

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

  async function handleDeleteProcess() {
    if (!processToDelete) return;
    if (confirmProcessText.trim().toUpperCase() !== "EXCLUIR") {
      notifyError("Digite EXCLUIR para confirmar.");
      return;
    }
    setDeleting(true);
    try {
      await api(`/admin/processes/${processToDelete.id}`, {
        method: "DELETE",
        body: JSON.stringify({ reason: deleteReason || undefined })
      });
      notifySuccess("Processo excluído permanentemente.");
      setProcessToDelete(null);
      setConfirmProcessText("");
      setDeleteReason("");
      await Promise.all([loadProcesses(0, false), loadUnassigned()]);
    } catch {
      // handled by api notify
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeleteOperator() {
    if (!operatorToDelete) return;
    if (confirmOperatorText.trim().toUpperCase() !== "EXCLUIR") {
      notifyError("Digite EXCLUIR para confirmar.");
      return;
    }
    setDeleting(true);
    try {
      await api(`/admin/users/${operatorToDelete.id}`, {
        method: "DELETE"
      });
      notifySuccess("Operador excluído permanentemente.");
      setOperatorToDelete(null);
      setConfirmOperatorText("");
      await loadUsers(0, false);
    } catch {
      // handled by api notify
    } finally {
      setDeleting(false);
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
                <div className="flex flex-col">
                  <span className="text-sm text-slate">{user.name}</span>
                  <span className="text-xs text-slate">{user.role === "OPERATOR" ? "OPERADOR" : "MASTER"}</span>
                </div>
                {user.role === "OPERATOR" && (
                  <button
                    type="button"
                    className="rounded-full border border-ink/15 px-3 py-1 text-xs font-semibold text-ink hover:border-brass"
                    onClick={() => setOperatorToDelete(user)}
                  >
                    Excluir
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate">
            <span>Mostrando {users.length} usuários</span>
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

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Processos</h2>
            <p className="text-sm text-slate">Atribuição de responsáveis e operações administrativas.</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate">
            <span>Mostrando {processes.length}</span>
            <button
              type="button"
              className="rounded-full border border-ink/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => loadProcesses(processOffset, true)}
              disabled={!hasMoreProcesses || loadingProcesses}
            >
              {loadingProcesses ? "Carregando..." : hasMoreProcesses ? "Carregar mais" : "Fim da lista"}
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {processes.length === 0 && <p className="text-sm text-slate">Nenhum processo encontrado.</p>}
          {processes.map((process) => (
            <div
              key={process.id}
              className="rounded-2xl border border-ink/10 bg-white/70 p-4 shadow-soft transition hover:-translate-y-0.5 hover:bg-white/90"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-ink">{process.clientName ?? "Processo"}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate">
                    <span className="font-mono">{process.id}</span>
                    <span>·</span>
                    <span>Etapa: {process.currentStep}</span>
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
                  <StatusBadge status={process.status} />

                  <div className="min-w-[260px]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate">Responsável</p>
                    <select
                      className="mt-1 w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm text-ink shadow-sm focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/30"
                      value={process.ownerId ?? ""}
                      onChange={(event) => handleAssign(process.id, event.target.value)}
                      disabled={assigning === process.id}
                      aria-label="Responsável"
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

                  <button
                    type="button"
                    className="rounded-xl border border-clay/30 bg-clay/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink hover:border-clay"
                    onClick={() => setProcessToDelete(process)}
                  >
                    Excluir caso
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

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

      {processToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 py-6">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-soft md:max-w-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Excluir processo</h2>
              <button
                type="button"
                className="rounded-full bg-slate/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate"
                onClick={() => {
                  setProcessToDelete(null);
                  setConfirmProcessText("");
                  setDeleteReason("");
                }}
              >
                Fechar
              </button>
            </div>
            <p className="mt-2 text-sm text-slate">
              Esta ação é permanente. Digite <strong>EXCLUIR</strong> para confirmar.
            </p>
            <div className="mt-4 grid gap-4">
              <Input
                placeholder="Motivo (opcional)"
                value={deleteReason}
                onChange={(event) => setDeleteReason(event.target.value)}
              />
              <Input
                placeholder="Digite EXCLUIR para confirmar"
                value={confirmProcessText}
                onChange={(event) => setConfirmProcessText(event.target.value)}
              />
            </div>
            <div className="mt-5 flex items-center justify-between">
              <Button className="bg-ink" onClick={handleDeleteProcess} disabled={deleting}>
                {deleting ? "Excluindo..." : "Excluir definitivamente"}
              </Button>
              <span className="text-xs text-slate">Processo: {processToDelete.id}</span>
            </div>
          </div>
        </div>
      )}

      {operatorToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 py-6">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-soft md:max-w-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Excluir operador</h2>
              <button
                type="button"
                className="rounded-full bg-slate/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate"
                onClick={() => {
                  setOperatorToDelete(null);
                  setConfirmOperatorText("");
                }}
              >
                Fechar
              </button>
            </div>
            <p className="mt-2 text-sm text-slate">
              Esta ação é permanente. Digite <strong>EXCLUIR</strong> para confirmar.
            </p>
            <div className="mt-4 grid gap-4">
              <Input
                placeholder="Digite EXCLUIR para confirmar"
                value={confirmOperatorText}
                onChange={(event) => setConfirmOperatorText(event.target.value)}
              />
            </div>
            <div className="mt-5 flex items-center justify-between">
              <Button className="bg-ink" onClick={handleDeleteOperator} disabled={deleting}>
                {deleting ? "Excluindo..." : "Excluir definitivamente"}
              </Button>
              <span className="text-xs text-slate">{operatorToDelete.name}</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

