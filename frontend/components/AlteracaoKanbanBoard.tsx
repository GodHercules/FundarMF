"use client";

import Link from "next/link";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { ALTERACAO_KANBAN_STAGE_LABELS, ALTERACAO_KANBAN_STAGES, AlteracaoContratualOptionId, AlteracaoKanbanStage, getAlteracaoContratualOption } from "@/lib/alteracao-contratual";

export function AlteracaoKanbanBoard({ processId, companyName, alterationType, stage = "SOLICITACAO_RECEBIDA" }: { processId: string; companyName: string; alterationType: AlteracaoContratualOptionId; stage?: AlteracaoKanbanStage }) {
  const option = getAlteracaoContratualOption(alterationType);
  const activeIndex = ALTERACAO_KANBAN_STAGES.indexOf(stage);

  return <section className="overflow-x-auto pb-2" aria-label="Quadro de etapas da alteração contratual">
    <div className="flex min-w-max gap-4">
      {ALTERACAO_KANBAN_STAGES.map((currentStage, index) => <div key={currentStage} role="region" aria-label={`Etapa ${ALTERACAO_KANBAN_STAGE_LABELS[currentStage]}`} className={["w-[300px] shrink-0 rounded-2xl border p-3", index === activeIndex ? "border-brass bg-brass/10" : "border-ink/10 bg-white/60"].join(" ")}>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-ink">{ALTERACAO_KANBAN_STAGE_LABELS[currentStage]}</h2><span className="badge bg-ink text-white">{index === activeIndex ? 1 : 0}</span></div>
        {index === activeIndex && <Card className="border border-ink/10 bg-white/90 p-4"><div className="flex items-start justify-between gap-3"><div><p className="line-clamp-2 text-sm font-semibold text-ink">{companyName}</p><p className="mt-1 text-xs text-slate">{option?.label ?? alterationType}</p></div><Badge className="bg-emerald/15 text-ink">Atual</Badge></div><p className="mt-2 break-all font-mono text-[11px] text-slate">{processId}</p><div className="mt-3"><Link href={`/client/process/${processId}`} className="text-xs font-semibold text-brass">Abrir processo</Link></div></Card>}
        {index !== activeIndex && <p className="rounded-xl border border-dashed border-ink/20 p-4 text-xs text-slate">A solicitação aparecerá aqui quando avançar para esta etapa.</p>}
      </div>)}
    </div>
  </section>;
}
