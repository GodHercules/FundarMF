"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Logo } from "@/components/Logo";

type Item = { id: string; clientName?: string; clientEmail: string; companyKey?: string; status: string; updatedAt: string; owner?: { name: string }; _count?: { contracts: number; alteracoesContratuais: number } };
type Result = { items: Item[]; total: number; limit: number; offset: number };

export default function CompletedProcessesPage() {
  const [search, setSearch] = useState(""); const [result, setResult] = useState<Result | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  async function load(event?: FormEvent) { event?.preventDefault(); setLoading(true); setError(null); try { setResult(await api<Result>(`/completed-processes?limit=25&offset=0&search=${encodeURIComponent(search)}`)); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível carregar os processos."); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  return <main className="app-container flex min-h-screen flex-col gap-8 py-12"><Link href="/operator/dashboard" className="text-sm font-semibold text-slate">Voltar para dashboard</Link><header><Logo withText /><span className="badge bg-emerald/15 text-ink">Arquivo operacional</span><h1 className="mt-2 text-3xl font-semibold">Processos Finalizados</h1><p className="mt-2 text-slate">Contratos e documentos preservados após a conclusão do processo.</p></header><Card className="p-4"><form onSubmit={load} className="flex flex-col gap-3 md:flex-row"><input aria-label="Buscar processo" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cliente, e-mail ou empresa" className="input flex-1" /><Button type="submit" variant="accent">Buscar</Button></form></Card>{loading && <Card className="p-6 text-sm text-slate">Carregando...</Card>}{error && <Card className="p-6 text-sm text-clay">{error}<button className="ml-3 font-semibold text-ink" onClick={() => void load()}>Tentar novamente</button></Card>}{!loading && !error && result?.items.length === 0 && <Card className="p-6 text-sm text-slate">Nenhum processo finalizado encontrado.</Card>}<section className="grid gap-4">{result?.items.map((item) => <Card key={item.id} className="p-5"><div className="flex flex-col justify-between gap-4 md:flex-row"><div><h2 className="text-lg font-semibold">{item.clientName ?? "Cliente sem nome"}</h2><p className="text-sm text-slate">{item.companyKey ?? item.clientEmail}</p><p className="mt-2 text-xs text-slate">Finalizado/atualizado em {new Date(item.updatedAt).toLocaleString("pt-BR")}</p></div><div className="flex items-center gap-4 text-sm text-slate"><span>{item._count?.contracts ?? 0} contrato(s)</span><span>{item._count?.alteracoesContratuais ?? 0} alteração(ões)</span><Link href={`/operator/processos-finalizados/${item.id}`} className="font-semibold text-brass">Abrir</Link></div></div></Card>)}</section></main>;
}
