"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Card } from "@/components/Card";
import { Logo } from "@/components/Logo";
import { AlteracaoKanbanBoard } from "@/components/AlteracaoKanbanBoard";
import { getAlteracaoContratualOption, AlteracaoContratualOptionId } from "@/lib/alteracao-contratual";

type ProcessDetails = { id: string; clientName?: string | null; status: string };
type AlteracaoRequest = { alterationType: string; stage: "SOLICITACAO_RECEBIDA" | "ANALISE_JURIDICA" | "AJUSTES_DOCUMENTAIS" | "PROTOCOLO" | "FINALIZADO" };

export default function ClientAlteracaoContratualKanban() {
  const params = useParams();
  const searchParams = useSearchParams();
  const processId = params?.id as string;
  const [process, setProcess] = useState<ProcessDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<AlteracaoRequest | null>(null);
  const tipo = (searchParams.get("tipo") ?? "") as AlteracaoContratualOptionId | "";
  const option = useMemo(() => (tipo ? getAlteracaoContratualOption(tipo) : undefined), [tipo]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [processData, requests] = await Promise.all([
          api<ProcessDetails>(`/processes/${processId}`),
          api<AlteracaoRequest[]>(`/processes/${processId}/alteracoes-contratuais`)
        ]);
        if (active) {
          setProcess(processData);
          setRequest(Array.isArray(requests) ? requests.find((item) => item.alterationType === tipo) ?? null : null);
        }
      } catch (reason: unknown) {
        if (active) setError(reason instanceof Error ? reason.message : "Não foi possível carregar o processo.");
      } finally {
        if (active) setLoading(false);
      }
    }
    if (processId) void load();
    return () => { active = false; };
  }, [processId]);

  const backHref = `/client/process/${processId}/alteracao-contratual`;
  if (loading) return <div className="p-8">Carregando...</div>;
  if (error || !process) return <main className="app-container flex min-h-screen flex-col gap-8 py-12"><Link href={backHref} className="text-sm font-semibold text-slate">{"<- Voltar"}</Link><Card className="p-6 text-sm text-slate">{error ?? "Não foi possível carregar o processo."}</Card></main>;
  if (process.status !== "CONCLUIDO") return <main className="app-container flex min-h-screen flex-col gap-8 py-12"><Link href={backHref} className="text-sm font-semibold text-slate">{"<- Voltar"}</Link><Card className="p-6 text-sm text-slate">Apenas empresas com o ciclo de criação concluído conseguem abrir a tratativa de alteração contratual.</Card></main>;

  return <main className="app-container flex min-h-screen flex-col gap-8 py-12">
    <Link href={backHref} className="text-sm font-semibold text-slate">{"<- Voltar"}</Link>
    <header className="flex flex-col gap-3"><Logo withText /><span className="badge bg-emerald/15 text-ink">Kanban da alteração</span><h1 className="text-3xl font-semibold">Acompanhamento da alteração contratual</h1><p className="text-slate">Processo {process.id} · {process.clientName ?? "empresa"}{option ? ` · ${option.label}` : ""}</p></header>
    <Card className="p-6"><div className="flex flex-col gap-2"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate">Seleção atual</p><p className="text-base font-semibold text-ink">{option?.label ?? "Nenhuma opção selecionada"}</p><p className="text-sm text-slate">Você pode arrastar o cartão entre as etapas abaixo para acompanhar a tratativa da solicitação.</p></div></Card>
    {option && request ? <AlteracaoKanbanBoard processId={process.id} companyName={process.clientName ?? "Empresa"} alterationType={option.id} stage={request.stage} /> : <Card className="p-6 text-sm text-slate">{option ? "Não foi possível encontrar a solicitação. Volte e tente novamente." : "Tipo de alteração inválido ou não informado. Volte e selecione uma opção para continuar."}</Card>}
  </main>;
}
