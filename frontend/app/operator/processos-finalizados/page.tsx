"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { FiArchive, FiArrowUpRight, FiDownload, FiSearch } from "react-icons/fi";
import { api } from "@/lib/api";
import { Button } from "@/components/Button";
import { WorkspaceNav } from "@/components/WorkspaceNav";

type Item = {
  id: string;
  clientName?: string;
  clientEmail: string;
  companyKey?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  finalizedAt?: string;
  owner?: { name: string };
  _count?: { contracts: number; alteracoesContratuais: number };
};
type Result = { items: Item[]; total: number; limit: number; offset: number };

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatCnpj(value?: string) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length === 14 ? digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : value || "CNPJ não informado";
}

function initials(name?: string) {
  return (name ?? "PF").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function duration(createdAt: string, finalizedAt?: string) {
  if (!finalizedAt) return "Duração indisponível";
  const days = Math.max(0, Math.round((new Date(finalizedAt).getTime() - new Date(createdAt).getTime()) / 86_400_000));
  return days === 1 ? "1 dia de ciclo" : `${days} dias de ciclo`;
}

export default function CompletedProcessesPage() {
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState("");

  async function load(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      setResult(await api<Result>(`/completed-processes?limit=25&offset=0&search=${encodeURIComponent(search)}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar os processos finalizados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function prepareExport(item: Item) {
    setExportMessage(`Exportação de ${item.clientName ?? "cliente"} preparada. A integração com o webhook da Central de clientes será conectada quando estiver disponível.`);
  }

  return (
    <div className="operator-workspace completed-workspace">
      <WorkspaceNav role="operator" />
      <main id="main-content" className="app-container completed-page" tabIndex={-1}>
        <header className="completed-hero">
          <div>
            <p className="operator-breadcrumb"><Link href="/operator/dashboard">Portal operador</Link> / Arquivo</p>
            <div className="completed-title-row"><span className="completed-eyebrow"><FiArchive aria-hidden="true" /> Arquivo operacional</span><span className="completed-count">{result?.total ?? 0} processos preservados</span></div>
            <h1>Processos finalizados</h1>
            <p>Consulte o histórico, os documentos gerados e os próximos destinos de cada empresa concluída.</p>
          </div>
          <Link href="/operator/dashboard" className="operator-secondary-action">Voltar ao painel</Link>
        </header>

        <section className="completed-summary" aria-label="Resumo do arquivo">
          <div><span>Processos preservados</span><strong>{result?.total ?? 0}</strong><small>conclusões disponíveis para consulta</small></div>
          <div><span>Última conclusão</span><strong>{result?.items[0] ? formatDate(result.items[0].finalizedAt ?? result.items[0].updatedAt).split(",")[0] : "—"}</strong><small>data da movimentação mais recente</small></div>
          <div><span>Destino preparado</span><strong>Central</strong><small>webhook aguardando integração</small></div>
        </section>

        <section className="completed-search-panel" aria-label="Buscar processos finalizados">
          <form onSubmit={load}>
            <label htmlFor="completed-search"><FiSearch aria-hidden="true" /> <span>Buscar por cliente, e-mail ou CNPJ</span></label>
            <div className="completed-search-controls"><input id="completed-search" aria-label="Buscar processo" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ex.: DemiGod ou 12.345.678/0001-90" /><Button type="submit" variant="accent">Buscar</Button></div>
          </form>
        </section>

        {exportMessage && <p className="completed-inline-message" role="status">{exportMessage}</p>}
        {loading && <section className="completed-state" role="status"><span className="completed-skeleton" /> Carregando arquivo operacional...</section>}
        {error && <section className="completed-state completed-state-error" role="alert"><strong>Não foi possível carregar o arquivo.</strong><span>{error}</span><button type="button" onClick={() => void load()}>Tentar novamente</button></section>}
        {!loading && !error && result?.items.length === 0 && <section className="completed-state"><strong>Nenhum processo finalizado encontrado.</strong><span>Ajuste a busca ou conclua um processo pelo Kanban para ele aparecer aqui.</span></section>}

        {!loading && !error && result && result.items.length > 0 && <section className="completed-list" aria-label="Processos finalizados">
          {result.items.map((item) => <article className="completed-list-item" key={item.id}>
            <div className="completed-identity"><span className="completed-avatar" aria-hidden="true">{initials(item.clientName)}</span><div><h2>{item.clientName ?? "Cliente sem nome"}</h2><p>{formatCnpj(item.companyKey)} · {item.clientEmail}</p><small>Finalizado em {formatDate(item.finalizedAt ?? item.updatedAt)}</small></div></div>
            <div className="completed-facts"><span><b>{duration(item.createdAt, item.finalizedAt)}</b><small>tempo de ciclo</small></span><span><b>{item._count?.contracts ?? 0}</b><small>documentos finais</small></span><span><b>{item.owner?.name ?? "Operação"}</b><small>responsável</small></span></div>
            <div className="completed-item-actions"><button type="button" className="completed-export-button" onClick={() => prepareExport(item)} title="Preparar exportação para a Central de clientes"><FiDownload aria-hidden="true" /> Exportar</button><Link href={`/operator/processos-finalizados/${item.id}`} className="completed-open-button">Abrir histórico <FiArrowUpRight aria-hidden="true" /></Link></div>
          </article>)}
        </section>}
      </main>
    </div>
  );
}
