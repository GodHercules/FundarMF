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
    <div className="flex flex-col gap-4">
      {steps.map((step) => (
        <div key={step} className="flex items-center gap-3">
          <span className={clsx("step-dot", step === current ? "bg-brass" : "bg-slate/30")} />
          <span className="text-sm font-semibold text-slate">{stepLabels[step] ?? step}</span>
        </div>
      ))}
    </div>
  );
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={clsx("badge text-white", statusColor[status] ?? "bg-slate")}>
      {(label ?? status).replaceAll("_", " ")}
    </span>
  );
}
