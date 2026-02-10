import { Card } from "@/components/Card";
import { Logo } from "@/components/Logo";

export default function ClientSubmitted() {
  return (
    <main className="app-container flex min-h-screen flex-col gap-8 py-12">
      <div className="flex flex-col gap-3">
        <Logo withText />
        <span className="badge bg-emerald/15 text-ink">Envio concluído</span>
        <h1 className="text-3xl font-semibold">Seu processo será iniciado</h1>
        <p className="text-slate">
          Recebemos suas informações e documentos. Aguarde o contato por e-mail ou WhatsApp para acompanhar o andamento.
        </p>
      </div>
      <Card className="p-6">
        <p className="text-sm text-slate">
          Em caso de dúvidas, responda ao contato enviado pelo operador.
        </p>
      </Card>
    </main>
  );
}
