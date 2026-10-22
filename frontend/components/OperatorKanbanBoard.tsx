"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { dropHandler, Kanban } from "react-kanban-kit";
import type { BoardData, BoardItem } from "react-kanban-kit";
import { api } from "@/lib/api";
import { KANBAN_STAGES, KANBAN_STAGE_LABELS, KanbanStage } from "@/lib/kanban";

type ProcessCard = {
  id: string;
  clientName?: string;
  status: string;
  currentStep: string;
  kanbanStage: KanbanStage;
  kanbanEligible?: boolean;
  createdAt?: string;
};

type StagePatchResponse = { ok: boolean; process: ProcessCard };
type CardMove = {
  cardId: string;
  fromColumnId: string;
  toColumnId: string;
  taskAbove: string | null;
  taskBelow: string | null;
  position: number;
};

function columnId(stage: KanbanStage) {
  return `column:${stage}`;
}

function cardId(processId: string) {
  return `process:${processId}`;
}

function stageLabel(stage: KanbanStage) {
  return KANBAN_STAGE_LABELS[stage];
}

function makeBoard(processes: ProcessCard[]): BoardData {
  const board: BoardData = {
    root: {
      id: "root",
      title: "Processos de abertura",
      parentId: null,
      children: KANBAN_STAGES.map(columnId),
      totalChildrenCount: KANBAN_STAGES.length
    }
  };

  for (const stage of KANBAN_STAGES) {
    const items = processes.filter((process) => process.kanbanStage === stage);
    board[columnId(stage)] = {
      id: columnId(stage),
      title: KANBAN_STAGE_LABELS[stage],
      parentId: "root",
      children: items.map((process) => cardId(process.id)),
      totalChildrenCount: items.length,
      isDraggable: false,
      content: { stage }
    };

    for (const process of items) {
      board[cardId(process.id)] = {
        id: cardId(process.id),
        title: process.clientName ?? "Empresa sem nome",
        parentId: columnId(stage),
        children: [],
        totalChildrenCount: 0,
        type: "process",
        content: process
      };
    }
  }

  return board;
}

function getProcess(item: BoardItem) {
  return item.content as ProcessCard;
}

function renderCard({ data }: { data: BoardItem }) {
  const process = getProcess(data);
  return (
    <article className="operator-kanban-card">
      <div className="operator-kanban-card-top">
        <strong>{process.clientName ?? "Empresa sem nome"}</strong>
        <span>{stageLabel(process.kanbanStage)}</span>
      </div>
      <small title={process.id}>Processo {process.id.slice(0, 8)}…</small>
      <p>Última atualização operacional</p>
      <Link href={`/operator/processos/${process.id}`}>Abrir processo</Link>
    </article>
  );
}

const configMap = {
  process: { isDraggable: true, render: renderCard }
};

export function OperatorKanbanBoard() {
  const [processes, setProcesses] = useState<ProcessCard[]>([]);
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyProcessId, setBusyProcessId] = useState<string | null>(null);
  const [manualProcessId, setManualProcessId] = useState("");
  const [manualStage, setManualStage] =
    useState<KanbanStage>("VIABILIDADE");

  async function loadProcesses() {
    setLoading(true);
    setError(null);
    try {
      const data = await api<ProcessCard[]>(
        "/processes/kanban?limit=200&offset=0"
      );
      const eligible = data.filter(
        (process) => process.kanbanEligible === true
      );
      setProcesses(eligible);
      setBoard(makeBoard(eligible));
      if (!manualProcessId && eligible[0]) {
        setManualProcessId(eligible[0].id);
        setManualStage(eligible[0].kanbanStage);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao carregar o Kanban.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProcesses();
  }, []);

  const selectedProcess = useMemo(
    () => processes.find((process) => process.id === manualProcessId),
    [manualProcessId, processes]
  );

  async function moveProcess(
    processId: string,
    targetStage: KanbanStage,
    previousBoard: BoardData
  ) {
    const sourceProcess = processes.find((process) => process.id === processId);
    if (!sourceProcess || sourceProcess.kanbanStage === targetStage) return;

    setBusyProcessId(processId);
    try {
      const response = await api<StagePatchResponse>(
        `/processes/${processId}/kanban-stage`,
        {
          method: "PATCH",
          body: JSON.stringify({ kanbanStage: targetStage })
        }
      );
      const nextProcesses = processes.map((process) =>
        process.id === processId
          ? { ...process, ...response.process }
          : process
      );
      setProcesses(nextProcesses);
      setBoard(makeBoard(nextProcesses));
      setManualStage(targetStage);
    } catch (err: unknown) {
      setBoard(previousBoard);
      setError(
        err instanceof Error ? err.message : "A movimentação não foi salva."
      );
    } finally {
      setBusyProcessId(null);
    }
  }

  function handleCardMove(move: CardMove) {
    if (!board) return;
    const process = getProcess(board[move.cardId]);
    const previousBoard = board;
    const nextBoard = dropHandler(move, board, () => {});
    const targetStage = nextBoard[move.cardId]?.parentId?.replace(
      "column:",
      ""
    ) as KanbanStage | undefined;
    setBoard(nextBoard);
    if (targetStage) {
      void moveProcess(process.id, targetStage, previousBoard);
    }
  }

  function handleManualMove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!board || !manualProcessId) return;
    void moveProcess(manualProcessId, manualStage, board);
  }

  function handleProcessChange(value: string) {
    setManualProcessId(value);
    const process = processes.find((item) => item.id === value);
    if (process) setManualStage(process.kanbanStage);
  }

  if (loading) {
    return (
      <div className="operator-kanban-loading" role="status" aria-busy="true">
        <span />
        <span />
        <span />
      </div>
    );
  }

  if (error && !board) {
    return (
      <div className="operator-process-error" role="alert">
        <strong>O quadro não carregou.</strong>
        <span>{error}</span>
        <button type="button" onClick={() => void loadProcesses()}>
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <section
      className="operator-kanban-shell"
      aria-label="Quadro de processos de abertura de empresas"
    >
      <div className="operator-kanban-tools">
        <div>
          <strong>
            {processes.length} processo{processes.length === 1 ? "" : "s"} no
            quadro
          </strong>
          <span>
            Arraste um card ou use o seletor para mover sem drag-and-drop.
          </span>
        </div>
        <form className="operator-kanban-manual-move" onSubmit={handleManualMove}>
          <label>
            <span>Processo</span>
            <select
              value={manualProcessId}
              onChange={(event) => handleProcessChange(event.target.value)}
            >
              {processes.map((process) => (
                <option key={process.id} value={process.id}>
                  {process.clientName ?? "Empresa sem nome"}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Enviar para</span>
            <select
              value={manualStage}
              onChange={(event) =>
                setManualStage(event.target.value as KanbanStage)
              }
            >
              {KANBAN_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stageLabel(stage)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={
              !selectedProcess ||
              !manualStage ||
              busyProcessId === manualProcessId
            }
          >
            Mover
          </button>
        </form>
      </div>

      {error && <p className="operator-kanban-feedback" role="alert">{error}</p>}
      {processes.length === 0 && (
        <div className="operator-process-empty">
          <strong>Nenhum processo pronto para o Kanban.</strong>
          <span>
            A entrada acontece depois do preenchimento do cliente e da
            conferência do operador.
          </span>
          <Link href="/operator/processos">Ver processos</Link>
        </div>
      )}
      {board && processes.length > 0 && (
        <div className="operator-kanban-viewport">
          <Kanban
            dataSource={board}
            configMap={configMap}
            onCardMove={handleCardMove}
            renderColumnHeader={(column) => (
              <div className="operator-kanban-column-header">
                <strong>{stageLabel(column.content?.stage as KanbanStage)}</strong>
                <span>{column.totalChildrenCount}</span>
              </div>
            )}
            columnWrapperClassName={() => "operator-kanban-column"}
            columnClassName={() => "operator-kanban-column-inner"}
            columnListContentClassName={() => "operator-kanban-list"}
            cardWrapperClassName="operator-kanban-card-wrapper"
            cardsGap={10}
            virtualization={processes.length > 40}
          />
        </div>
      )}
    </section>
  );
}
