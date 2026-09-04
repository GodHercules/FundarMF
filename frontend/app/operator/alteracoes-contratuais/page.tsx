"use client";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { OperatorAlteracaoKanbanBoard } from "@/components/OperatorAlteracaoKanbanBoard";
import { ALTERACAO_CONTRATUAL_OPERATOR_OPTIONS } from "@/lib/alteracao-contratual";
import { api } from "@/lib/api";
import { formatCnpj } from "@/lib/cnpj";
import { useState } from "react";
import { WorkspaceNav } from "@/components/WorkspaceNav";

export default function OperatorAlteracoesContratuaisPage() {
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [type, setType] = useState("");
  const [otherDescription, setOtherDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [boardRefreshKey, setBoardRefreshKey] = useState(0);
  const canCreate = Boolean(type && clientName.trim() && clientEmail.trim() && documentNumber.trim() && (type !== "outra" || otherDescription.trim()));

  async function create() {
    if (!canCreate || saving) return;
    setSaving(true); setMessage(null);
    try {
      const body = { clientName: clientName.trim(), clientEmail: clientEmail.trim(), documentNumber: documentNumber.trim(), alterationTypes: [type], ...(type === "outra" ? { otherDescription: otherDescription.trim() } : {}) };
      await api("/processes/alteracoes-contratuais", { method: "POST", body: JSON.stringify(body) });
      setMessage("Alteração contratual criada em análise.");
      setBoardRefreshKey((current) => current + 1);
      setClientName(""); setClientEmail(""); setDocumentNumber(""); setOtherDescription("");
    } catch (reason: unknown) { setMessage(reason instanceof Error ? reason.message : "Não foi possível criar a alteração."); }
    finally { setSaving(false); }
  }

  return <main className="app-container flex min-h-screen flex-col gap-8 py-12"><WorkspaceNav role="operator" />
    <Link href="/operator/dashboard" className="text-sm font-semibold text-slate">Voltar para dashboard</Link>
    <header className="flex flex-col gap-2"><Logo withText /><span className="badge bg-brass/15 text-ink">Kanban operacional</span><h1 className="text-3xl font-semibold">Alterações Contratuais</h1><p className="text-slate">Crie uma alteração para um processo existente ou para qualquer cliente cadastrado avulso.</p></header>
    <section className="rounded-2xl border border-ink/10 bg-white/70 p-4">
      <h2 className="font-semibold">Nova alteração contratual</h2><p className="mt-1 text-sm text-slate">Informe onde será feita a alteração e os dados atuais da empresa para receber as notificações.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <select className="input md:col-span-2" value={type} onChange={(event) => setType(event.target.value)} aria-label="Onde será feita a alteração"><option value="" disabled>Onde será feita a alteração</option>{ALTERACAO_CONTRATUAL_OPERATOR_OPTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        <input className="input" value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Nome / razão social atual" aria-label="Nome ou razão social atual" /><input className="input" value={documentNumber} onChange={(event) => setDocumentNumber(formatCnpj(event.target.value))} placeholder="CNPJ" aria-label="CNPJ" inputMode="text" autoComplete="off" maxLength={18} /><input className="input md:col-span-2" type="email" value={clientEmail} onChange={(event) => setClientEmail(event.target.value)} placeholder="E-mail para receber notificações" aria-label="E-mail para receber notificações" />
        {type === "outra" && <input className="input md:col-span-2" value={otherDescription} onChange={(event) => setOtherDescription(event.target.value)} placeholder="Descreva a outra alteração" aria-label="Descrição da outra alteração" />}
      </div>
      <button type="button" className="mt-4 rounded-xl bg-ink px-4 py-2 font-semibold text-white disabled:opacity-50" onClick={() => void create()} disabled={!canCreate || saving}>{saving ? "Criando..." : "Criar alteração"}</button>
      {message && <p role="status" className="mt-3 text-sm text-slate">{message}</p>}
    </section><OperatorAlteracaoKanbanBoard refreshKey={boardRefreshKey} />
  </main>;
}
