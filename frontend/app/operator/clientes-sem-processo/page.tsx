"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/api";

type LegacyClient = { id: string; name: string; tradeName?: string | null; documentNumber: string; email?: string | null; phone?: string | null };

export default function ClientsWithoutProcessPage() {
  const [clients, setClients] = useState<LegacyClient[]>([]);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load(searchTerm = search) {
    setLoading(true);
    try {
      setClients(await api<LegacyClient[]>(`/completed-processes/legacy-clients?search=${encodeURIComponent(searchTerm)}`));
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar os clientes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(""); }, []);

  async function createClient(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await api<LegacyClient>("/completed-processes/legacy-clients", {
        method: "POST",
        body: JSON.stringify({ name, documentNumber })
      });
      setName("");
      setDocumentNumber("");
      await load();
      setMessage("Cliente cadastrado. Agora você pode criar os contratos.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Não foi possível cadastrar o cliente.");
    } finally {
      setSaving(false);
    }
  }

  return <main className="app-container flex min-h-screen flex-col gap-8 py-12">
    <Link href="/operator/dashboard" className="text-sm font-semibold text-slate">Voltar para dashboard</Link>
    <header><Logo withText /><span className="badge bg-brass/15 text-ink">Cadastro operacional</span><h1 className="mt-2 text-3xl font-semibold">Clientes sem processo FundarMF</h1><p className="mt-2 text-slate">Cadastre clientes externos ao fluxo de abertura e gerencie contratos e alterações contratuais.</p></header>
    <Card className="p-6">
      <h2 className="text-lg font-semibold">Novo cliente</h2>
      <form onSubmit={createClient} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <Input aria-label="Nome ou razão social" placeholder="Nome ou razão social" value={name} onChange={(event) => setName(event.target.value)} required />
        <Input aria-label="CPF ou CNPJ" placeholder="CPF ou CNPJ" value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} required />
        <Button type="submit" variant="accent" disabled={saving}>{saving ? "Salvando..." : "Cadastrar"}</Button>
      </form>
    </Card>
    <Card className="p-6">
      <form onSubmit={(event) => { event.preventDefault(); void load(); }} className="flex flex-col gap-3 md:flex-row">
        <Input aria-label="Buscar cliente" placeholder="Nome ou CPF/CNPJ" value={search} onChange={(event) => setSearch(event.target.value)} />
        <Button type="submit" variant="ghost">Buscar</Button>
      </form>
      {message && <p role="status" className="mt-4 text-sm text-slate">{message}</p>}
      {loading ? <p className="mt-4 text-sm text-slate">Carregando...</p> : clients.length === 0 ? <p className="mt-4 text-sm text-slate">Nenhum cliente encontrado.</p> : <div className="mt-4 grid gap-3">{clients.map((client) => <Link key={client.id} href={`/operator/clientes-sem-processo/${client.id}`} className="rounded-xl border border-ink/10 bg-white/80 p-4 transition hover:-translate-y-0.5 hover:border-brass/50"><p className="font-semibold">{client.name}</p><p className="mt-1 text-sm text-slate">{client.tradeName ?? client.documentNumber}</p><p className="mt-1 text-xs text-slate">{client.email ?? client.phone ?? "Sem contato informado"}</p></Link>)}</div>}
    </Card>
  </main>;
}
