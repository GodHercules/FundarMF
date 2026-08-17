"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/api";
import { EditorDoc, RichTextEditor } from "@/components/RichTextEditor";

type Contract = { id: string; title: string; type?: string | null; status: string; currentVersion: number; versions: Array<{ version: number; content: unknown }> };
type LegacyClient = { id: string; name: string; tradeName?: string | null; documentNumber: string; email?: string | null; phone?: string | null; contracts: Contract[] };

export default function LegacyClientContractsPage() {
  const params = useParams();
  const clientId = params?.id as string;
  const [client, setClient] = useState<LegacyClient | null>(null);
  const [selected, setSelected] = useState<Contract | null>(null);
  const [content, setContent] = useState<EditorDoc>({ type: "doc", content: [{ type: "paragraph", content: [] }] });
  const [title, setTitle] = useState("");
  const [type, setType] = useState("ALTERACAO_CONTRATUAL");
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const dirtyRef = useRef(false);

  async function load() {
    try {
      setClient(await api<LegacyClient>(`/completed-processes/legacy-clients/${clientId}`));
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar o cliente.");
    }
  }

  useEffect(() => { if (clientId) void load(); }, [clientId]);

  function open(contract: Contract) {
    setSelected(contract);
    setTitle(contract.title);
    setContent((contract.versions[0]?.content as EditorDoc) ?? { type: "doc", content: [{ type: "paragraph", content: [] }] });
    dirtyRef.current = false;
  }

  async function createBlank() {
    try {
      const created = await api<Contract>(`/completed-processes/legacy-clients/${clientId}/contracts/blank`, { method: "POST", body: JSON.stringify({ title: type === "ALTERACAO_CONTRATUAL" ? "Nova alteração contratual" : "Novo contrato", type }) });
      setClient((current) => current ? { ...current, contracts: [created, ...current.contracts] } : current);
      open(created);
    } catch (error: unknown) { setMessage(error instanceof Error ? error.message : "Não foi possível criar o contrato."); }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    setUploading(true);
    try {
      const created = await api<Contract>(`/completed-processes/legacy-clients/${clientId}/contracts/upload`, { method: "POST", body: form });
      setClient((current) => current ? { ...current, contracts: [created, ...current.contracts] } : current);
      open(created);
      setMessage("Documento convertido e pronto para edição.");
    } catch (error: unknown) { setMessage(error instanceof Error ? error.message : "Não foi possível enviar o documento."); }
    finally { setUploading(false); event.target.value = ""; }
  }

  async function save() {
    if (!selected || !dirtyRef.current) return;
    try {
      const saved = await api<{ version: number }>(`/completed-processes/contracts/${selected.id}`, { method: "PUT", body: JSON.stringify({ title, content, expectedVersion: selected.currentVersion }) });
      setSelected((current) => current ? { ...current, title, currentVersion: saved.version, versions: [{ version: saved.version, content }] } : current);
      setClient((current) => current ? { ...current, contracts: current.contracts.map((item) => item.id === selected.id ? { ...item, title, currentVersion: saved.version, versions: [{ version: saved.version, content }] } : item) } : current);
      dirtyRef.current = false;
      setMessage("Contrato salvo.");
    } catch (error: unknown) { setMessage(error instanceof Error ? error.message : "Não foi possível salvar o contrato."); }
  }

  if (!client) return <main className="app-container py-12"><Link href="/operator/clientes-sem-processo" className="text-sm font-semibold text-slate">Voltar</Link><Card className="mt-6 p-6">{message ?? "Carregando..."}</Card></main>;

  return <main className="app-container flex min-h-screen flex-col gap-6 py-12">
    <Link href="/operator/clientes-sem-processo" className="text-sm font-semibold text-slate">Voltar para clientes sem processo</Link>
    <header><Logo withText /><span className="badge bg-brass/15 text-ink">Contratos independentes</span><h1 className="mt-2 text-3xl font-semibold">{client.name}</h1><p className="mt-2 text-slate">{client.tradeName ?? client.documentNumber} · {client.email ?? client.phone ?? "Sem contato informado"}</p></header>
    <Card className="p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Contratos e alterações contratuais</h2><p className="mt-1 text-sm text-slate">Este cadastro não depende de processo FundarMF.</p></div><div className="flex flex-wrap gap-2"><select aria-label="Tipo do novo documento" className="rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm" value={type} onChange={(event) => setType(event.target.value)}><option value="ALTERACAO_CONTRATUAL">Alteração contratual</option><option value="CONTRATO_SOCIAL">Contrato social</option><option value="OUTRO">Outro documento</option></select><Button variant="accent" onClick={() => void createBlank()}>Novo documento</Button><label className="inline-flex cursor-pointer items-center rounded-xl border border-ink/20 px-4 py-2 text-sm font-semibold text-ink">{uploading ? "Convertendo..." : "Enviar PDF/DOCX"}<Input className="sr-only" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => void upload(event)} disabled={uploading} /></label></div></div>{message && <p role="status" className="mt-4 text-sm text-slate">{message}</p>}<div className="mt-5 grid gap-3">{client.contracts.length === 0 ? <p className="text-sm text-slate">Nenhum documento cadastrado.</p> : client.contracts.map((contract) => <button key={contract.id} type="button" className="rounded-xl border border-ink/10 p-4 text-left hover:bg-cream" onClick={() => open(contract)}><span className="font-semibold">{contract.title}</span><span className="ml-3 text-xs text-slate">{contract.type ?? "Documento"} · {contract.status} · v{contract.currentVersion}</span></button>)}</div></Card>
    {selected && <Card className="p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Editando documento</h2><p className="mt-1 text-sm text-slate">Formate como no Word; o conteúdo é salvo como nova versão.</p></div><Button variant="accent" onClick={() => void save()}>Salvar agora</Button></div><Input className="mt-4" aria-label="Título do documento" value={title} onChange={(event) => { setTitle(event.target.value); dirtyRef.current = true; }} /><div className="mt-3"><RichTextEditor key={selected.id} value={content} onChange={(next) => { setContent(next); dirtyRef.current = true; }} /></div><Button className="mt-3" variant="ghost" onClick={() => setSelected(null)}>Fechar editor</Button></Card>}
  </main>;
}
