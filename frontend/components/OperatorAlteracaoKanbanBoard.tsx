"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DndContext, DragEndEvent, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { Card } from "@/components/Card";
import { api } from "@/lib/api";
import { ALTERACAO_KANBAN_STAGE_LABELS, ALTERACAO_KANBAN_STAGES, AlteracaoKanbanStage } from "@/lib/alteracao-contratual";

type AlteracaoCard = { id: string; processId?: string | null; legacyClientId?: string | null; alterationType: string; stage: AlteracaoKanbanStage; version: number; process?: { id: string; clientName?: string | null; ownerId?: string | null } | null; legacyClient?: { id: string; name?: string | null; documentNumber?: string | null } | null };

function Column({ stage, items }: { stage: AlteracaoKanbanStage; items: AlteracaoCard[] }) {
  const droppable = useDroppable({ id: `alteracao-column:${stage}` });
  return <div ref={droppable.setNodeRef} className="w-[300px] shrink-0 rounded-2xl border border-ink/10 bg-white/60 p-3">
    <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-ink">{ALTERACAO_KANBAN_STAGE_LABELS[stage]}</h2><span className="badge bg-ink text-white">{items.length}</span></div>
    <div className="min-h-24 space-y-3">{items.map((item) => <DraggableAlteracaoCard key={item.id} item={item} />)}{items.length === 0 && <p className="rounded-xl border border-dashed border-ink/20 p-4 text-xs text-slate">Arraste cards para esta coluna.</p>}</div>
  </div>;
}

function DraggableAlteracaoCard({ item }: { item: AlteracaoCard }) {
  const draggable = useDraggable({ id: `alteracao:${item.id}` });
  const name = item.process?.clientName ?? item.legacyClient?.name ?? "Empresa sem nome";
  const href = item.processId ? `/operator/process/${item.processId}` : item.legacyClientId ? `/operator/clientes-sem-processo/${item.legacyClientId}` : null;
  return <div ref={draggable.setNodeRef} style={{ transform: draggable.transform ? `translate3d(${draggable.transform.x}px, ${draggable.transform.y}px, 0)` : undefined }} {...draggable.attributes} {...draggable.listeners} className="cursor-grab rounded-xl border border-ink/10 bg-white p-4 shadow-sm active:cursor-grabbing">
    <p className="text-sm font-semibold text-ink">{name}</p><p className="mt-1 text-xs text-slate">Alteração: {item.alterationType}</p><p className="mt-1 font-mono text-[11px] text-slate">{item.legacyClient?.documentNumber ?? item.processId ?? item.legacyClientId}</p>{href && <Link href={href} className="mt-3 inline-block text-xs font-semibold text-brass">Abrir cadastro</Link>}
  </div>;
}

export function OperatorAlteracaoKanbanBoard() {
  const [items, setItems] = useState<AlteracaoCard[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 1 } }), useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }));
  async function load() { setLoading(true); setError(null); try { setItems(await api<AlteracaoCard[]>("/processes/alteracoes-contratuais")); } catch (reason: unknown) { setError(reason instanceof Error ? reason.message : "Erro ao carregar alterações contratuais."); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  const grouped = useMemo(() => Object.fromEntries(ALTERACAO_KANBAN_STAGES.map((stage) => [stage, items.filter((item) => item.stage === stage)])) as Record<AlteracaoKanbanStage, AlteracaoCard[]>, [items]);
  async function move(event: DragEndEvent) {
    const id = String(event.active.id).replace("alteracao:", ""); const stage = String(event.over?.id ?? "").replace("alteracao-column:", "") as AlteracaoKanbanStage; const item = items.find((candidate) => candidate.id === id);
    if (!item || !ALTERACAO_KANBAN_STAGES.includes(stage) || stage === item.stage) return;
    const previous = items; setBusy(id); setItems(items.map((candidate) => candidate.id === id ? { ...candidate, stage, version: candidate.version + 1 } : candidate));
    try { const response = await api<{ request: AlteracaoCard }>(`/processes/alteracoes-contratuais/${id}/stage`, { method: "PATCH", body: JSON.stringify({ stage, expectedVersion: item.version }) }); setItems(current => current.map(candidate => candidate.id === id ? response.request : candidate)); } catch (reason: unknown) { setItems(previous); setError(reason instanceof Error ? reason.message : "Não foi possível mover o card."); } finally { setBusy(null); }
  }
  if (loading) return <Card className="p-4 text-sm text-slate">Carregando alterações contratuais...</Card>;
  if (error && items.length === 0) return <Card className="p-4 text-sm text-clay">{error}<button className="ml-3 font-semibold text-ink" onClick={() => void load()}>Tentar novamente</button></Card>;
  return <DndContext sensors={sensors} onDragEnd={(event) => void move(event)}><section className="overflow-x-auto pb-2" aria-label="Quadro de alterações contratuais"><div className="flex min-w-max gap-4">{ALTERACAO_KANBAN_STAGES.map(stage => <Column key={stage} stage={stage} items={grouped[stage]} />)}</div></section>{busy && <p className="mt-2 text-xs text-slate">Salvando movimentação...</p>}{error && <p role="alert" className="mt-2 text-sm text-clay">{error}</p>}</DndContext>;
}
