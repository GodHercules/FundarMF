import Link from "next/link";
import { Logo } from "@/components/Logo";

type Metrics = {
  criticalSteps: number;
  avgCompletionDays: number;
  activeAlerts: number;
  auditedDocuments: number;
};

async function getMetrics(): Promise<Metrics> {
  const fallback = { criticalSteps: 0, avgCompletionDays: 0, activeAlerts: 0, auditedDocuments: 0 };
  try {
    const baseUrl = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    const response = await fetch(`${baseUrl}/public/metrics`, { next: { revalidate: 60 } });
    if (!response.ok) return fallback;
    const data = (await response.json()) as Metrics;
    return { ...fallback, ...data };
  } catch {
    return fallback;
  }
}

export default async function Home() {
  const metrics = await getMetrics();
  const avgDays = Math.max(0, Math.round(metrics.avgCompletionDays));
  const indicatorItems = [
    { label: "Etapas críticas monitoradas", value: String(metrics.criticalSteps).padStart(2, "0") },
    { label: "Tempo médio de conclusão", value: `${avgDays}d` },
    { label: "Alertas SLA ativos", value: String(metrics.activeAlerts).padStart(2, "0") },
    { label: "Documentos auditados", value: String(metrics.auditedDocuments).padStart(2, "0") }
  ];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-screen-2xl flex-col gap-12 px-4 py-16 sm:px-6 lg:px-10 2xl:px-16">
      <header className="grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-center">
        <div className="flex flex-col gap-6">
          <Logo withText size={64} />
          <span className="badge bg-brass/15 text-ink">FundarMF</span>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            Contabilidade guiada para abrir sua empresa com segurança
          </h1>
          <p className="max-w-3xl text-lg text-slate">
            Um fluxo claro, com etapas validadas, documentos auditáveis e SLA controlado. Tudo em um painel
            com linguagem de escritório contábil e rastreio completo.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link href="/client" className="inline-flex items-center gap-2 text-sm font-semibold text-brass">
              Acessar portal do cliente →
            </Link>
            <Link href="/operator" className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
              Área interna →
            </Link>
          </div>
        </div>
        <div className="card relative overflow-hidden p-6">
          <div className="absolute inset-0 bg-gradient-to-br from-brass/10 via-transparent to-emerald/10" />
          <div className="relative flex flex-col gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate">Resumo contábil</p>
              <h2 className="mt-2 text-2xl font-semibold">Painel de indicadores</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {indicatorItems.map((item) => (
                <div key={item.label} className="rounded-xl border border-ink/10 bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-ink">{item.value}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-slate">
              Todas as etapas e documentos ficam registrados com rastreio completo e responsáveis definidos.
            </p>
          </div>
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-3">
        {[
          {
            title: "Portal do Cliente",
            desc: "Solicite o link seguro, acompanhe a evolução e envie documentos.",
            href: "/client"
          },
          {
            title: "Portal do Operador",
            desc: "Valide etapas, controle SLAs e registre ocorrências.",
            href: "/operator"
          },
          {
            title: "Portal Master",
            desc: "Auditoria completa, gestão de equipe e configuração de SLA.",
            href: "/master"
          }
        ].map((card) => (
          <Link key={card.title} href={card.href} className="card group p-6 transition hover:-translate-y-1">
            <div className="flex flex-col gap-3">
              <h2 className="text-xl font-semibold">{card.title}</h2>
              <p className="text-sm text-slate">{card.desc}</p>
              <span className="text-sm font-semibold text-brass">Acessar →</span>
            </div>
          </Link>
        ))}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="card p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate">Fluxo fiscal</p>
          <h3 className="mt-2 text-lg font-semibold">Controle de etapas e conformidade</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate">
            <li>• Trava de aprovação por etapa + correções assistidas</li>
            <li>• SLA configurável com alertas automáticos</li>
            <li>• Checklist fiscal por etapa e responsável</li>
            <li>• Upload seguro com versionamento</li>
          </ul>
        </div>
        <div className="card p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate">Governança</p>
          <h3 className="mt-2 text-lg font-semibold">Segurança e auditoria contabilista</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate">
            <li>• Sessões rotativas e cookies HttpOnly</li>
            <li>• Rate limit no login/OTP</li>
            <li>• Logs de eventos e trilhas por ator</li>
            <li>• Atribuição de dono com histórico</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
