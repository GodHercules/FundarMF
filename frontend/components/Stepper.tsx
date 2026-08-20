import clsx from "clsx";

const statusColor: Record<string, string> = {
  CONCLUIDO: "bg-emerald",
  EM_ANDAMENTO: "bg-brass",
  AGUARDANDO_CLIENTE: "bg-gold",
  AGUARDANDO_OPERADOR: "bg-brass",
  CORRECAO_SOLICITADA: "bg-clay",
  CANCELADO: "bg-slate"
};

const stepLabels: Record<string, string> = {
  ETAPA_1: "Início",
  ETAPA_2: "Preenchimento de dados e informações",
  ETAPA_3: "Estrutura Jurídica",
  ETAPA_4: "Checklist",
  ETAPA_5: "Endereço",
  ETAPA_6: "Documentos"
};

export function Stepper({ steps, current }: { steps: string[]; current: string }) {
  return (
    <ol className="flex flex-col gap-4" aria-label="Etapas do processo">
      {steps.map((step, index) => {
        const currentIndex = steps.indexOf(current);
        const done = currentIndex >= 0 && index < currentIndex;
        return (
          <li key={step} className="flex items-center gap-3" aria-current={step === current ? "step" : undefined}>
            <span className={clsx("step-dot", done ? "bg-emerald" : step === current ? "bg-brass" : "bg-slate/30")} aria-hidden="true" />
            <span className={clsx("text-sm font-semibold", step === current ? "text-ink" : "text-slate")}>{stepLabels[step] ?? step}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={clsx("badge text-white", statusColor[status] ?? "bg-slate")}>
      {(label ?? status).replaceAll("_", " ")}
    </span>
  );
}
