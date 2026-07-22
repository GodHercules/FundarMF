"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { ALTERACAO_CONTRATUAL_OPTIONS, AlteracaoContratualOptionId, getAlteracaoContratualOption } from "@/lib/alteracao-contratual";

type ProcessDetails = { id: string; clientName?: string | null; status: string };

export default function ClientAlteracaoContratualSelection() {
  const params = useParams();
  const router = useRouter();
  const processId = params?.id as string;
  const [process, setProcess] = useState<ProcessDetails | null>(null);
  const [selected, setSelected] = useState<AlteracaoContratualOptionId | "">("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const processData = await api<ProcessDetails>(`/processes/${processId}`);
        if (active) setProcess(processData);
      } catch (error: unknown) {
        if (active) setMessage(error instanceof Error ? error.message : "Não foi possível carregar o processo.");
      } finally {
        if (active) setLoading(false);
      }
    }
    if (processId) void load();
    return () => { active = false; };
  }, [processId]);

  const allowed = process?.status === "CONCLUIDO";
  const selectedOption = useMemo(() => getAlteracaoContratualOption(selected), [selected]);
  async function continueFlow() {
    if (!selected || !processId || submitting) return;
    setSubmitting(true);
    try {
      await api(`/processes/${processId}/alteracoes-contratuais`, {
        method: "POST",
        body: JSON.stringify({ alterationType: selected })
      });
      router.push(`/client/process/${processId}/alteracao-contratual/kanban?tipo=${selected}`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Não foi possível criar a solicitação.");
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-8">Carregando...</div>;
  if (!process) return <main className="app-container flex min-h-screen flex-col gap-8 py-12"><Link href={`/client/process/${processId}`} className="text-sm font-semibold text-slate">{"<- Voltar"}</Link><Card className="p-6 text-sm text-slate">{message ?? "Processo não encontrado."}</Card></main>;
  if (!allowed) return <main className="app-container flex min-h-screen flex-col gap-8 py-12"><Link href={`/client/process/${processId}`} className="text-sm font-semibold text-slate">{"<- Voltar para o processo"}</Link><div className="flex flex-col gap-3"><Logo withText /><span className="badge bg-emerald/15 text-ink">Alteração contratual</span><h1 className="text-3xl font-semibold">Ação indisponível no momento</h1><p className="text-slate">Só empresas com o ciclo de criação concluído podem solicitar alteração contratual.</p></div><Card className="p-6 text-sm text-slate">O processo atual ainda não terminou. Conclua a criação da empresa para liberar esta jornada.</Card></main>;

  return <main className="app-container flex min-h-screen flex-col gap-8 py-12">
    <Link href={`/client/process/${processId}`} className="text-sm font-semibold text-slate">{"<- Voltar para o processo"}</Link>
    <header className="flex flex-col gap-3"><Logo withText /><span className="badge bg-brass/15 text-ink">Alteração contratual</span><h1 className="text-3xl font-semibold">Escolha o tipo de alteração</h1><p className="text-slate">Processo {process.id} · {process.clientName ?? "empresa"} já concluiu o ciclo de criação e pode seguir para a alteração.</p></header>
    {message && <Card className="p-4 text-sm text-slate">{message}</Card>}
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {ALTERACAO_CONTRATUAL_OPTIONS.map((option) => { const active = selected === option.id; return <button key={option.id} type="button" onClick={() => setSelected(option.id)} aria-pressed={active} className={["rounded-3xl border p-5 text-left transition", active ? "border-brass bg-brass/10 shadow-lift" : "border-ink/10 bg-white/80 hover:-translate-y-0.5 hover:border-brass/40 hover:bg-white"].join(" ")}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-lg font-semibold text-ink">{option.label}</p><p className="mt-2 text-sm leading-6 text-slate">{option.description}</p></div><span className="badge bg-ink text-white">{active ? "Selecionada" : "Escolher"}</span></div></button>; })}
    </section>
    <Card className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate">Próximo passo</p><h2 className="mt-1 text-xl font-semibold text-ink">{selectedOption ? selectedOption.label : "Selecione uma opção para continuar"}</h2><p className="mt-2 text-sm text-slate">Depois da escolha, você verá o Kanban da alteração para acompanhar a tratativa.</p></div><div className="flex flex-wrap gap-3"><Button variant="ghost" onClick={() => router.push(`/client/process/${processId}`)}>Cancelar</Button><Button variant="accent" onClick={() => void continueFlow()} disabled={!selected || submitting}>{submitting ? "Criando..." : "Continuar"}</Button></div></Card>
  </main>;
}
