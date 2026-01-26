"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Stepper, StatusBadge } from "@/components/Stepper";

const steps = ["ETAPA_1", "ETAPA_2", "ETAPA_3", "ETAPA_4", "ETAPA_5", "ETAPA_6"];

export default function ClientProcess() {
  const params = useParams();
  const processId = params?.id as string;
  const [process, setProcess] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [ticketMessage, setTicketMessage] = useState("");

  async function load() {
    const data = await api(`/processes/${processId}`);
    setProcess(data);
  }

  useEffect(() => {
    if (processId) {
      load();
    }
  }, [processId]);

  async function updateStep(stepKey: string, data: Record<string, unknown>) {
    setMessage(null);
    await api(`/processes/${processId}/steps`, {
      method: "PUT",
      body: JSON.stringify({ stepKey, data })
    });
    setMessage("Dados salvos.");
    load();
  }

  async function submitStep(stepKey: string) {
    setMessage(null);
    await api(`/processes/${processId}/submit-step`, {
      method: "POST",
      body: JSON.stringify({ stepKey })
    });
    setMessage("Etapa enviada para validação.");
    load();
  }

  async function cancelProcess() {
    setMessage(null);
    await api(`/processes/${processId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: "Cancelado pelo cliente" })
    });
    setMessage("Processo cancelado.");
    load();
  }

  async function openTicket() {
    if (!ticketMessage) return;
    await api(`/chats/${processId}/messages`, {
      method: "POST",
      body: JSON.stringify({ body: ticketMessage })
    });
    setTicketMessage("");
    setMessage("Chamado enviado ao funcionário responsável.");
  }

  if (!process) {
    return <div className="p-8">Carregando...</div>;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-12">
      <Link href="/client/dashboard" className="text-sm font-semibold text-slate">
        ← Voltar
      </Link>
      <header className="flex flex-col gap-3">
        <span className="badge bg-brass/15 text-ink">Acompanhamento</span>
        <h1 className="text-3xl font-semibold">Processo {process.id}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={process.status} />
          <span className="text-sm text-slate">Etapa atual: {process.currentStep}</span>
        </div>
        <div>
          <Button className="bg-clay" onClick={cancelProcess}>
            Cancelar processo
          </Button>
        </div>
      </header>

      {message && <p className="text-sm text-slate">{message}</p>}

      <section className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Card className="p-6">
          <h2 className="text-lg font-semibold">Etapas</h2>
          <div className="mt-4">
            <Stepper steps={steps} current={process.currentStep} />
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold">ETAPA 2 · Dados empresariais</h3>
            <p className="mt-2 text-sm text-slate">
              Campos marcados como “Nós e o cliente” podem ser discutidos via chamado.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Input placeholder="Razão Social 1" />
              <Input placeholder="Razão Social 2" />
              <Input placeholder="Razão Social 3" />
              <Input placeholder="Município" />
              <Input placeholder="CNAE" />
              <Input placeholder="E-mail CNPJ" />
              <Input placeholder="Telefone CNPJ" />
              <Input placeholder="Tributação" />
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={() => updateStep("ETAPA_2", { atualizadoEm: new Date().toISOString() })}>
                Salvar
              </Button>
              <Button className="bg-emerald" onClick={() => submitStep("ETAPA_2")}
                >Enviar para validação</Button
              >
            </div>
            <div className="mt-4 rounded-xl border border-brass/30 bg-brass/5 p-4">
              <p className="text-sm font-semibold text-slate">Abrir chamado para o funcionário responsável</p>
              <div className="mt-2 flex flex-col gap-3 md:flex-row">
                <Input
                  placeholder="Escreva sua dúvida sobre CNAE/Tributação"
                  value={ticketMessage}
                  onChange={(event) => setTicketMessage(event.target.value)}
                />
                <Button onClick={openTicket} className="bg-ink">
                  Abrir chamado
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold">ETAPA 4 · Quadro societário</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Input placeholder="Nome do sócio" />
              <Input placeholder="Percentual" />
              <Input placeholder="Administrador" />
              <Input placeholder="Responsável CNPJ" />
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={() => updateStep("ETAPA_4", { atualizadoEm: new Date().toISOString() })}>
                Salvar
              </Button>
              <Button className="bg-emerald" onClick={() => submitStep("ETAPA_4")}
                >Enviar para validação</Button
              >
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold">ETAPA 5 · Endereço</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Input placeholder="Endereço" />
              <Input placeholder="IPTU" />
              <Input placeholder="Foto fachada" />
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={() => updateStep("ETAPA_5", { atualizadoEm: new Date().toISOString() })}>
                Salvar
              </Button>
              <Button className="bg-emerald" onClick={() => submitStep("ETAPA_5")}
                >Enviar para validação</Button
              >
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold">ETAPA 6 · Documentos</h3>
            <p className="text-sm text-slate">
              Faça upload dos documentos exigidos. O funcionário irá validar cada item.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={() => submitStep("ETAPA_6")} className="bg-emerald">
                Enviar documentos para validação
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}
