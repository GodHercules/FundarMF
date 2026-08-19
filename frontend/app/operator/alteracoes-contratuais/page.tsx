"use client";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { OperatorAlteracaoKanbanBoard } from "@/components/OperatorAlteracaoKanbanBoard";
import { ALTERACAO_CONTRATUAL_OPTIONS } from "@/lib/alteracao-contratual";
import { api } from "@/lib/api";
import { useState } from "react";

export default function OperatorAlteracoesContratuaisPage() {
  const [processId, setProcessId] = useState(""); const [type, setType] = useState("nome"); const [message, setMessage] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  async function create() { if (!processId.trim() || saving) return; setSaving(true); setMessage(null); try { await api("/processes/alteracoes-contratuais", { method: "POST", body: JSON.stringify({ processId: processId.trim(), alterationTypes: [type] }) }); setMessage("Alteração contratual criada na primeira etapa."); setProcessId(""); } catch (reason: unknown) { setMessage(reason instanceof Error ? reason.message : "Não foi possível criar a alteração."); } finally { setSaving(false); } }
  return <main className="app-container flex min-h-screen flex-col gap-8 py-12"><Link href="/operator/dashboard" className="text-sm font-semibold text-slate">Voltar para dashboard</Link><header className="flex flex-col gap-2"><Logo withText /><span className="badge bg-brass/15 text-ink">Kanban operacional</span><h1 className="text-3xl font-semibold">Alterações Contratuais</h1><p className="text-slate">Quadro separado do fluxo de abertura, com as mesmas etapas e movimentações operacionais.</p></header><section className="rounded-2xl border border-ink/10 bg-white/70 p-4"><h2 className="font-semibold">Nova alteração contratual</h2><div className="mt-3 flex flex-col gap-3 md:flex-row"><input className="input flex-1" value={processId} onChange={(event) => setProcessId(event.target.value)} placeholder="ID do processo ou empresa já cadastrada" aria-label="ID do processo" /><select className="input" value={type} onChange={(event) => setType(event.target.value)} aria-label="Tipo de alteração">{ALTERACAO_CONTRATUAL_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select><button type="button" className="rounded-xl bg-ink px-4 py-2 font-semibold text-white disabled:opacity-50" onClick={() => void create()} disabled={!processId.trim() || saving}>{saving ? "Criando..." : "Criar alteração"}</button></div>{message && <p role="status" className="mt-3 text-sm text-slate">{message}</p>}</section><OperatorAlteracaoKanbanBoard /></main>;
}
