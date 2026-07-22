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
import { FiAlertTriangle, FiTrash2, FiUserX, FiX } from "react-icons/fi";

type DashboardProcess = {
  id: string;
  status: string;
  clientName?: string;
  currentStep?: string;
  ownerId?: string | null;
};

type DashboardUser = {
  id: string;
  name: string;
  email?: string;
  role: string;
};

export default function MasterDashboard() {
  const [processes, setProcesses] = useState<DashboardProcess[]>([]);
  const [unassigned, setUnassigned] = useState<DashboardProcess[]>([]);
  const [users, setUsers] = useState<DashboardUser[]>([]);
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
  const [processToDelete, setProcessToDelete] = useState<DashboardProcess | null>(null);
  const [operatorToDelete, setOperatorToDelete] = useState<DashboardUser | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [confirmProcessText, setConfirmProcessText] = useState("");
  const [confirmOperatorText, setConfirmOperatorText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const processPageSize = 8;
  const userPageSize = 10;

  async function loadProcesses(nextOffset = 0, append = false) {
    setLoadingProcesses(true);
    try {
      const list = await api<DashboardProcess[]>(`/processes?limit=${processPageSize}&offset=${nextOffset}`);
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
      const list = await api<DashboardUser[]>(`/admin/users?limit=${userPageSize}&offset=${nextOffset}`);
      setUsers((prev) => (append ? [...prev, ...list] : list));
      setHasMoreUsers(list.length === userPageSize);
      setUserOffset(nextOffset + list.length);
    } finally {
      setLoadingUsers(false);
    }
  }

  async function loadUnassigned() {
    const data = await api<DashboardProcess[]>("/admin/processes/unassigned");
    setUnassigned(data);
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-4 py-6"
          onClick={() => {
            setProcessToDelete(null);
            setConfirmProcessText("");
            setDeleteReason("");
          }}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-soft"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-ink/10 bg-white/95 px-6 py-5 backdrop-blur">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-clay/10 text-clay">
                  <FiTrash2 className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-ink">Excluir processo</h2>
                  <p className="mt-1 text-sm text-slate">
                    Esta ação é permanente e remove também documentos, etapas e histórico do processo.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate/10 text-slate hover:bg-slate/15"
                aria-label="Fechar"
                onClick={() => {
                  setProcessToDelete(null);
                  setConfirmProcessText("");
                  setDeleteReason("");
                }}
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-6 px-6 py-6 md:grid-cols-[1.2fr_1fr]">
              <div className="rounded-2xl border border-clay/20 bg-clay/5 p-4">
                <div className="flex items-start gap-3">
                  <FiAlertTriangle className="mt-0.5 h-5 w-5 text-clay" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">Atenção</p>
                    <p className="mt-1 text-xs text-slate">
                      Para confirmar, digite <span className="font-semibold text-ink">EXCLUIR</span>. Se clicar por engano,
                      use Cancelar.
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-ink/10 bg-white/80 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate">Processo</p>
                  <p className="mt-1 truncate text-sm font-semibold text-ink">{processToDelete.clientName ?? "Cliente"}</p>
                  <p className="mt-1 break-all font-mono text-[11px] text-slate">{processToDelete.id}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate">Motivo (opcional)</p>
                  <Input
                    className="mt-2"
                    placeholder="Ex: cadastro duplicado, solicitação do cliente..."
                    value={deleteReason}
                    onChange={(event) => setDeleteReason(event.target.value)}
                  />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate">Confirmação</p>
                  <Input
                    className="mt-2"
                    placeholder="Digite EXCLUIR para confirmar"
                    value={confirmProcessText}
                    onChange={(event) => setConfirmProcessText(event.target.value)}
                  />
                  <p className="mt-2 text-xs text-slate">
                    {confirmProcessText.trim().toUpperCase() === "EXCLUIR"
                      ? "Confirmado. Você pode excluir."
                      : "Digite EXCLUIR para habilitar o botão."}
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button
                    variant="primary"
                    onClick={() => {
                      setProcessToDelete(null);
                      setConfirmProcessText("");
                      setDeleteReason("");
                    }}
                    disabled={deleting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="bg-clay"
                    onClick={handleDeleteProcess}
                    disabled={deleting || confirmProcessText.trim().toUpperCase() !== "EXCLUIR"}
                  >
                    {deleting ? "Excluindo..." : "Excluir definitivamente"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {operatorToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-4 py-6"
          onClick={() => {
            setOperatorToDelete(null);
            setConfirmOperatorText("");
          }}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-soft"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-ink/10 bg-white/95 px-6 py-5 backdrop-blur">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-clay/10 text-clay">
                  <FiUserX className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-ink">Excluir operador</h2>
                  <p className="mt-1 text-sm text-slate">
                    Esta ação é permanente. Operadores com processos em andamento não podem ser removidos.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate/10 text-slate hover:bg-slate/15"
                aria-label="Fechar"
                onClick={() => {
                  setOperatorToDelete(null);
                  setConfirmOperatorText("");
                }}
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-6 px-6 py-6 md:grid-cols-[1.2fr_1fr]">
              <div className="rounded-2xl border border-ink/10 bg-white/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate">Operador</p>
                <p className="mt-1 truncate text-sm font-semibold text-ink">{operatorToDelete.name}</p>
                {operatorToDelete.email && <p className="mt-1 break-all text-xs text-slate">{operatorToDelete.email}</p>}
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-clay/20 bg-clay/5 p-4">
                  <div className="flex items-start gap-3">
                    <FiAlertTriangle className="mt-0.5 h-5 w-5 text-clay" />
                    <div>
                      <p className="text-sm font-semibold text-ink">Confirmação</p>
                      <p className="mt-1 text-xs text-slate">
                        Digite <span className="font-semibold text-ink">EXCLUIR</span> para habilitar o botão.
                      </p>
                    </div>
                  </div>
                  <Input
                    className="mt-3"
                    placeholder="Digite EXCLUIR para confirmar"
                    value={confirmOperatorText}
                    onChange={(event) => setConfirmOperatorText(event.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button
                    variant="primary"
                    onClick={() => {
                      setOperatorToDelete(null);
                      setConfirmOperatorText("");
                    }}
                    disabled={deleting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="bg-clay"
                    onClick={handleDeleteOperator}
                    disabled={deleting || confirmOperatorText.trim().toUpperCase() !== "EXCLUIR"}
                  >
                    {deleting ? "Excluindo..." : "Excluir definitivamente"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

