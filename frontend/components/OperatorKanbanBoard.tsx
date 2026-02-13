"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api } from "@/lib/api";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/Stepper";
import { KANBAN_STAGES, KANBAN_STAGE_LABELS, KanbanStage } from "@/lib/kanban";

type ProcessCard = {
  id: string;
  clientName?: string;
  status: string;
  currentStep: string;
  kanbanStage: KanbanStage;
  createdAt?: string;
};

type StagePatchResponse = {
  ok: boolean;
  process: ProcessCard;
};

function processDragId(processId: string) {
  return `process:${processId}`;
}

function columnDragId(stage: KanbanStage) {
  return `column:${stage}`;
}

function parseProcessId(dragId: string | number) {
  const text = String(dragId);
  if (!text.startsWith("process:")) return null;
  return text.slice("process:".length);
}

function parseStageId(dragId: string | number) {
  const text = String(dragId);
  if (text.startsWith("column:")) {
    return text.slice("column:".length) as KanbanStage;
  }
  return null;
}

function SortableProcessCard({ process, disabled }: { process: ProcessCard; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: processDragId(process.id),
    data: { processId: process.id }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.92 : 1,
    zIndex: isDragging ? 20 : "auto"
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        className="cursor-grab border border-ink/10 bg-white/90 p-4 transition hover:-translate-y-0.5 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-sm font-semibold text-ink">{process.clientName ?? "Processo sem nome"}</p>
          <StatusBadge status={process.status} label={KANBAN_STAGE_LABELS[process.kanbanStage]} />
        </div>
        <p className="mt-2 break-all font-mono text-[11px] text-slate">{process.id}</p>
        <p className="mt-1 text-xs text-slate">Etapa técnica: {process.currentStep}</p>
        <div className="mt-2 flex items-center justify-between">
          <Link href={`/operator/process/${process.id}`} className="text-xs font-semibold text-brass">
            Abrir caso
          </Link>
          {disabled && <p className="text-[11px] text-slate">Movendo...</p>}
        </div>
      </Card>
    </div>
  );
}

function KanbanColumn({
  stage,
  processes,
  busyId
}: {
  stage: KanbanStage;
  processes: ProcessCard[];
  busyId: string | null;
}) {
  const droppable = useDroppable({ id: columnDragId(stage) });

  return (
    <div ref={droppable.setNodeRef} className="w-[300px] shrink-0 rounded-2xl border border-ink/10 bg-white/60 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-ink">{KANBAN_STAGE_LABELS[stage]}</h2>
        <span className="badge bg-ink text-white">{processes.length}</span>
      </div>

      <SortableContext items={processes.map((process) => processDragId(process.id))} strategy={verticalListSortingStrategy}>
        <div className="min-h-24 space-y-3">
          {processes.map((process) => (
            <SortableProcessCard key={process.id} process={process} disabled={busyId === process.id} />
          ))}
          {processes.length === 0 && (
            <div className="rounded-xl border border-dashed border-ink/20 p-4 text-xs text-slate">Arraste cards para esta coluna.</div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function OperatorKanbanBoard() {
  const [processes, setProcesses] = useState<ProcessCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeProcessId, setActiveProcessId] = useState<string | null>(null);
  const [busyProcessId, setBusyProcessId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } })
  );

  async function loadProcesses() {
    setLoading(true);
    setError(null);
    try {
      const data = await api<ProcessCard[]>("/processes?limit=200&offset=0");
      setProcesses(
        [...data].sort((a, b) => {
          const aTs = a.createdAt ? Date.parse(a.createdAt) : 0;
          const bTs = b.createdAt ? Date.parse(b.createdAt) : 0;
          return bTs - aTs;
        })
      );
    } catch (err: any) {
      setError(err?.message ?? "Erro ao carregar processos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProcesses();
  }, []);

  const grouped = useMemo(() => {
    const map: Record<KanbanStage, ProcessCard[]> = {
      VIABILIDADE: [],
      DOC_INICIAL_APROVADA: [],
      DBE_RECEITA_FEDERAL: [],
      PREPARACAO_DOCUMENTOS: [],
      AGUARDANDO_DOCUMENTOS: [],
      ANALISE_JUCEB: [],
      FINALIZADO: []
    };

    for (const process of processes) {
      const stage = process.kanbanStage ?? "VIABILIDADE";
      map[stage].push(process);
    }
    return map;
  }, [processes]);

  function stageFromOverId(overId: string | number, current: ProcessCard[]) {
    const directStage = parseStageId(overId);
    if (directStage) return directStage;

    const processId = parseProcessId(overId);
    if (!processId) return null;

    const related = current.find((process) => process.id === processId);
    return related?.kanbanStage ?? null;
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveProcessId(null);

    const activeId = parseProcessId(event.active.id);
    if (!activeId || !event.over) return;

    const sourceProcess = processes.find((process) => process.id === activeId);
    if (!sourceProcess) return;

    const targetStage = stageFromOverId(event.over.id, processes);
    if (!targetStage || targetStage === sourceProcess.kanbanStage) return;

    const previous = processes;
    const optimistic = previous.map((process) =>
      process.id === activeId ? { ...process, kanbanStage: targetStage } : process
    );

    setProcesses(optimistic);
    setBusyProcessId(activeId);

    try {
      const response = await api<StagePatchResponse>(`/processes/${activeId}/kanban-stage`, {
        method: "PATCH",
        body: JSON.stringify({ kanbanStage: targetStage })
      });

      setProcesses((current) =>
        current.map((process) => (process.id === activeId ? { ...process, ...response.process } : process))
      );
    } catch {
      setProcesses(previous);
    } finally {
      setBusyProcessId(null);
    }
  }

  if (loading) return <Card className="p-4 text-sm text-slate">Carregando Kanban...</Card>;
  if (error) {
    return (
      <Card className="p-4 text-sm text-clay">
        {error}
        <button className="ml-3 font-semibold text-ink" onClick={() => void loadProcesses()}>
          Tentar novamente
        </button>
      </Card>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(event) => setActiveProcessId(parseProcessId(event.active.id))}
      onDragCancel={() => setActiveProcessId(null)}
      onDragEnd={(event) => void handleDragEnd(event)}
    >
      <section className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-4">
          {KANBAN_STAGES.map((stage) => (
            <KanbanColumn key={stage} stage={stage} processes={grouped[stage]} busyId={busyProcessId} />
          ))}
        </div>
      </section>
    </DndContext>
  );
}
