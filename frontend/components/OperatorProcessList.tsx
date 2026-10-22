"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FiArrowUpRight, FiChevronLeft, FiChevronRight, FiFilter, FiRefreshCw, FiSearch } from "react-icons/fi";
import { api } from "@/lib/api";
import { KANBAN_STAGE_LABELS, KANBAN_STAGES, KanbanStage } from "@/lib/kanban";
import { WorkspaceNav } from "@/components/WorkspaceNav";

type OperationalProcess = {
  id: string;
  clientName: string;
  clientEmail: string;
  status: string;
  currentStep: string;
  kanbanStage: KanbanStage;
  createdAt: string;
  updatedAt: string;
  fillStatus: "Completo" | "Aguardando conferência" | "Em preenchimento";
  situation: string;
  pending: string[];
  nextAction: string;
  pendingDocuments: number;
  kanbanEligible: boolean;
};

type OperationsResponse = {
  items: OperationalProcess[];
  total: number;
  hasMore: boolean;
  summary: { active: number; awaitingOperator: number; awaitingClient: number; inProgress: number };
};

type LegacyProcess = {
  id: string;
  clientName?: string | null;
  clientEmail?: string | null;
  status?: string | null;
  currentStep?: string | null;
  kanbanStage?: KanbanStage | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  kanbanEligible?: boolean;
};

const PAGE_SIZE = 12;

const statusLabels: Record<string, string> = {
  AGUARDANDO_OPERADOR: "Aguardando conferência",
  AGUARDANDO_CLIENTE: "Aguardando cliente",
  EM_ANDAMENTO: "Em andamento",
  CORRECAO_SOLICITADA: "Correção solicitada"
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function stageLabel(stage: KanbanStage) {
  return KANBAN_STAGE_LABELS[stage] === "VIABILIDADE" ? "Viabilidade" : KANBAN_STAGE_LABELS[stage];
}

function operationalStatus(process: OperationalProcess) {
  return statusLabels[process.status] ?? process.situation;
}

function normalizeLegacyProcess(process: LegacyProcess): OperationalProcess {
  const status = process.status ?? "EM_ANDAMENTO";
  const kanbanStage = process.kanbanStage ?? "VIABILIDADE";
  const createdAt = process.createdAt ?? new Date(0).toISOString();
  const updatedAt = process.updatedAt ?? createdAt;
  const pending = status === "AGUARDANDO_OPERADOR"
    ? ["Conferir dados enviados pelo cliente"]
    : status === "AGUARDANDO_CLIENTE"
      ? ["Aguardar informações do cliente"]
      : [];

  return {
    id: process.id,
    clientName: process.clientName ?? "Empresa sem nome",
    clientEmail: process.clientEmail ?? "",
    status,
    currentStep: process.currentStep ?? "ETAPA_2",
    kanbanStage,
    createdAt,
    updatedAt,
    fillStatus: status === "AGUARDANDO_OPERADOR"
      ? "Aguardando conferência"
      : status === "AGUARDANDO_CLIENTE"
        ? "Em preenchimento"
        : "Completo",
    situation: statusLabels[status] ?? "Em andamento",
    pending,
    nextAction: pending[0] ?? "Acompanhar próxima etapa",
    pendingDocuments: 0,
    kanbanEligible: process.kanbanEligible ?? false
  };
}

function buildLegacyResponse(
  processes: LegacyProcess[],
  filters: { search: string; status: string; stage: string; offset: number }
): OperationsResponse {
  const active = processes
    .filter((process) => process.status !== "CONCLUIDO" && process.status !== "CANCELADO")
    .map(normalizeLegacyProcess);
  const search = filters.search.toLocaleLowerCase("pt-BR");
  const filtered = active.filter((process) => {
    const matchesSearch = !search
      || process.clientName.toLocaleLowerCase("pt-BR").includes(search)
      || process.clientEmail.toLocaleLowerCase("pt-BR").includes(search);
    const matchesStatus = !filters.status || process.status === filters.status;
    const matchesStage = !filters.stage || process.kanbanStage === filters.stage;
    return matchesSearch && matchesStatus && matchesStage;
  });

  return {
    items: filtered.slice(filters.offset, filters.offset + PAGE_SIZE),
    total: filtered.length,
    hasMore: filters.offset + PAGE_SIZE < filtered.length,
    summary: {
      active: active.length,
      awaitingOperator: active.filter((process) => process.status === "AGUARDANDO_OPERADOR").length,
      awaitingClient: active.filter((process) => process.status === "AGUARDANDO_CLIENTE").length,
      inProgress: active.filter((process) => process.status === "EM_ANDAMENTO").length
    }
  };
}

function StatButton({ label, value, detail, active, onClick }: { label: string; value: number; detail: string; active?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`operator-process-stat ${active ? "is-active" : ""}`} aria-pressed={active} onClick={onClick}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </button>
  );
}

export function OperatorProcessList() {
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [stage, setStage] = useState("");
  const [sort, setSort] = useState<"updated" | "name">("updated");
  const [offset, setOffset] = useState(0);
  const [response, setResponse] = useState<OperationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setAppliedSearch(search.trim());
      setOffset(0);
    }, 220);
    return () => window.clearTimeout(timeout);
  }, [search]);

  async function load() {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (appliedSearch) params.set("search", appliedSearch);
    if (status) params.set("status", status);
    if (stage) params.set("stage", stage);
    try {
      setResponse(await api<OperationsResponse>(`/processes/operations?${params.toString()}`, { suppressErrorNotification: true }));
    } catch (err: unknown) {
      const isMissingOperationsRoute = err
        && typeof err === "object"
        && "status" in err
        && (err as { status?: number }).status === 404;

      if (isMissingOperationsRoute) {
        try {
          const legacyProcesses = await api<LegacyProcess[]>("/processes?limit=200&offset=0");
          setResponse(buildLegacyResponse(legacyProcesses, { search: appliedSearch, status, stage, offset }));
          return;
        } catch (legacyError: unknown) {
          setError(legacyError instanceof Error ? legacyError.message : "Não foi possível carregar os processos.");
          return;
        }
      }

      setError(err instanceof Error ? err.message : "Não foi possível carregar os processos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [appliedSearch, status, stage, offset]);

  const items = useMemo(() => {
    const list = [...(response?.items ?? [])];
    if (sort === "name") return list.sort((a, b) => a.clientName.localeCompare(b.clientName, "pt-BR"));
    return list.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }, [response?.items, sort]);

  function clearFilters() {
    setSearch("");
    setStatus("");
    setStage("");
    setOffset(0);
  }

  const summary = response?.summary ?? { active: 0, awaitingOperator: 0, awaitingClient: 0, inProgress: 0 };

  return (
    <div className="operator-workspace">
      <WorkspaceNav role="operator" />
      <main id="main-content" className="app-container operator-process-page" tabIndex={-1}>
        <header className="operator-page-header">
          <div>
            <p className="operator-breadcrumb"><Link href="/operator/dashboard">Portal operador</Link> / Processos</p>
            <h1>Processos em andamento</h1>
            <p>Acompanhe, confira e gerencie as aberturas de empresas.</p>
          </div>
          <div className="operator-process-header-actions">
            <Link href="/operator/kanban" className="operator-secondary-action">Abrir Kanban</Link>
            <Link href="/operator/start" className="operator-primary-action">Novo processo <span aria-hidden="true">+</span></Link>
          </div>
        </header>

        <section className="operator-process-stats" aria-label="Resumo dos processos">
          <StatButton label="Processos ativos" value={summary.active} detail="aberturas em andamento" active={!status} onClick={() => { setStatus(""); setOffset(0); }} />
          <StatButton label="Aguardando conferência" value={summary.awaitingOperator} detail="dados recebidos do cliente" active={status === "AGUARDANDO_OPERADOR"} onClick={() => { setStatus("AGUARDANDO_OPERADOR"); setOffset(0); }} />
          <StatButton label="Aguardando cliente" value={summary.awaitingClient} detail="próxima ação externa" active={status === "AGUARDANDO_CLIENTE"} onClick={() => { setStatus("AGUARDANDO_CLIENTE"); setOffset(0); }} />
          <StatButton label="Em andamento" value={summary.inProgress} detail="sem pendência de envio" active={status === "EM_ANDAMENTO"} onClick={() => { setStatus("EM_ANDAMENTO"); setOffset(0); }} />
        </section>

        <section className="operator-process-list-shell" aria-labelledby="operator-process-list-title">
          <div className="operator-process-list-heading">
            <div>
              <h2 id="operator-process-list-title">Fila de atendimento</h2>
              <p>{response ? `${response.total} processo${response.total === 1 ? "" : "s"} encontrado${response.total === 1 ? "" : "s"}` : "Carregando processos…"}</p>
            </div>
            <button type="button" className="operator-quiet-action" onClick={() => void load()} disabled={loading}>
              <FiRefreshCw aria-hidden="true" className={loading ? "is-spinning" : ""} /> Atualizar
            </button>
          </div>

          <div className="operator-process-filters">
            <label className="operator-process-search">
              <span className="sr-only">Pesquisar empresa</span>
              <FiSearch aria-hidden="true" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar por empresa ou e-mail" type="search" />
            </label>
            <label>
              <span>Etapa</span>
              <select value={stage} onChange={(event) => { setStage(event.target.value); setOffset(0); }}>
                <option value="">Todas as etapas</option>
                {KANBAN_STAGES.filter((item) => item !== "FINALIZADO").map((item) => <option key={item} value={item}>{stageLabel(item)}</option>)}
              </select>
            </label>
            <label>
              <span>Ordenar</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as "updated" | "name")}>
                <option value="updated">Mais recentes</option>
                <option value="name">Nome da empresa</option>
              </select>
            </label>
            {(status || stage || appliedSearch) && <button type="button" className="operator-filter-clear" onClick={clearFilters}><FiFilter aria-hidden="true" /> Limpar filtros</button>}
          </div>

          {loading && <div className="operator-process-loading" role="status" aria-busy="true"><span /><span /><span /></div>}
          {error && <div className="operator-process-error" role="alert"><strong>Não foi possível carregar a fila.</strong><span>{error}</span><button type="button" onClick={() => void load()}>Tentar novamente</button></div>}
          {!loading && !error && items.length === 0 && <div className="operator-process-empty"><strong>Nenhum processo corresponde aos filtros.</strong><span>Altere a busca ou limpe os filtros para consultar toda a fila de aberturas.</span><button type="button" onClick={clearFilters}>Limpar filtros</button></div>}

          {!error && items.length > 0 && <>
            <div className="operator-process-table" role="table" aria-label="Processos de abertura de empresas">
              <div className="operator-process-table-head" role="row">
                <span role="columnheader">Empresa</span><span role="columnheader">Etapa atual</span><span role="columnheader">Situação</span><span role="columnheader">Última atualização</span><span role="columnheader">Próxima ação</span><span role="columnheader"><span className="sr-only">Ações</span></span>
              </div>
              {items.map((process) => <div key={process.id} className="operator-process-table-row" role="row">
                <div className="operator-process-company" role="cell"><span className="operator-process-initial" aria-hidden="true">{process.clientName.slice(0, 1).toUpperCase()}</span><span><strong>{process.clientName}</strong><small title={process.id}>Processo {process.id.slice(0, 8)}… · Criado em {formatDate(process.createdAt)}</small></span></div>
                <div role="cell"><strong>{stageLabel(process.kanbanStage)}</strong><small className="operator-process-cell-muted">{process.fillStatus}</small></div>
                <div role="cell"><span className={`operator-process-status is-${process.status.toLowerCase()}`}>{operationalStatus(process)}</span>{process.pendingDocuments > 0 && <small className="operator-process-cell-muted">{process.pendingDocuments} documento{process.pendingDocuments === 1 ? "" : "s"} pendente{process.pendingDocuments === 1 ? "" : "s"}</small>}</div>
                <div role="cell"><strong>{formatDate(process.updatedAt)}</strong><small className="operator-process-cell-muted">{process.situation}</small></div>
                <div role="cell" className="operator-process-next"><span>{process.nextAction}</span>{process.pending.length > 1 && <small>+{process.pending.length - 1} pendência{process.pending.length - 1 === 1 ? "" : "s"}</small>}</div>
                <div role="cell"><Link className="operator-process-open" href={`/operator/processos/${process.id}`}>Abrir processo <FiArrowUpRight aria-hidden="true" /></Link></div>
              </div>)}
            </div>
            <div className="operator-process-pagination"><span>Mostrando {offset + 1}–{Math.min(offset + items.length, response?.total ?? items.length)} de {response?.total ?? items.length}</span><div><button type="button" aria-label="Página anterior" onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} disabled={offset === 0}><FiChevronLeft aria-hidden="true" /></button><button type="button" aria-label="Próxima página" onClick={() => setOffset(offset + PAGE_SIZE)} disabled={!response?.hasMore}><FiChevronRight aria-hidden="true" /></button></div></div>
          </>}
        </section>
      </main>
    </div>
  );
}
