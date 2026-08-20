"use client";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { OperatorAlteracaoKanbanBoard } from "@/components/OperatorAlteracaoKanbanBoard";
import { ALTERACAO_CONTRATUAL_OPTIONS } from "@/lib/alteracao-contratual";
import { api } from "@/lib/api";
import { useState } from "react";
import { WorkspaceNav } from "@/components/WorkspaceNav";

export default function OperatorAlteracoesContratuaisPage() {
  const [processId, setProcessId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [type, setType] = useState("nome");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const standaloneComplete = clientName.trim() && clientEmail.trim() && documentNumber.trim();
  const canCreate = Boolean(processId.trim() || standaloneComplete);

  async function create() {
    if (!canCreate || saving) return;
    setSaving(true); setMessage(null);
    try {
      const body = processId.trim() ? { processId: processId.trim(), alterationTypes: [type] } : { clientName: clientName.trim(), clientEmail: clientEmail.trim(), documentNumber: documentNumber.trim(), alterationTypes: [type] };
      await api("/processes/alteracoes-contratuais", { method: "POST", body: JSON.stringify(body) });
      setMessage("Alteração contratual criada na primeira etapa.");
      setProcessId(""); setClientName(""); setClientEmail(""); setDocumentNumber("");
    } catch (reason: unknown) { setMessage(reason instanceof Error ? reason.message : "Não foi possível criar a alteração."); }
    finally { setSaving(false); }
  }

  return <main className="app-container flex min-h-screen flex-col gap-8 py-12"><WorkspaceNav role="operator" />
    <Link href="/operator/dashboard" className="text-sm font-semibold text-slate">Voltar para dashboard</Link>
    <header className="flex flex-col gap-2"><Logo withText /><span className="badge bg-brass/15 text-ink">Kanban operacional</span><h1 className="text-3xl font-semibold">Alterações Contratuais</h1><p className="text-slate">Crie uma alteração para um processo existente ou para qualquer cliente cadastrado avulso.</p></header>
    <section className="rounded-2xl border border-ink/10 bg-white/70 p-4">
      <h2 className="font-semibold">Nova alteração contratual</h2><p className="mt-1 text-sm text-slate">Para um processo já aberto, informe apenas o ID. Para um novo cliente, preencha os dados de notificação.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input className="input" value={processId} onChange={(event) => setProcessId(event.target.value)} placeholder="ID do processo (opcional)" aria-label="ID do processo" />
        <select className="input" value={type} onChange={(event) => setType(event.target.value)} aria-label="Tipo de alteração">{ALTERACAO_CONTRATUAL_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>
        {!processId.trim() && <><input className="input" value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Nome / razão social" aria-label="Nome ou razão social" /><input className="input" value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} placeholder="CNPJ" aria-label="CNPJ" /><input className="input md:col-span-2" type="email" value={clientEmail} onChange={(event) => setClientEmail(event.target.value)} placeholder="E-mail para notificações" aria-label="E-mail para notificações" /></>}
      </div>
      <button type="button" className="mt-4 rounded-xl bg-ink px-4 py-2 font-semibold text-white disabled:opacity-50" onClick={() => void create()} disabled={!canCreate || saving}>{saving ? "Criando..." : "Criar alteração"}</button>
      {message && <p role="status" className="mt-3 text-sm text-slate">{message}</p>}
    </section><OperatorAlteracaoKanbanBoard />
  </main>;
}
