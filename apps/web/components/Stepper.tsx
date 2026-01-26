import clsx from "clsx";

const statusColor: Record<string, string> = {
  CONCLUIDO: "bg-emerald",
  EM_ANDAMENTO: "bg-sky",
  AGUARDANDO_CLIENTE: "bg-brass",
  AGUARDANDO_FUNCIONARIO: "bg-sky",
  CORRECAO_SOLICITADA: "bg-clay",
  CANCELADO: "bg-slate"
};

export function Stepper({ steps, current }: { steps: string[]; current: string }) {
  return (
    <div className="flex flex-col gap-4">
      {steps.map((step) => (
        <div key={step} className="flex items-center gap-3">
          <span className={clsx("step-dot", step === current ? "bg-brass" : "bg-slate/30")} />
          <span className="text-sm font-semibold text-slate">{step}</span>
        </div>
      ))}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={clsx("badge text-white", statusColor[status] ?? "bg-slate")}>
      {status.replaceAll("_", " ")}
    </span>
  );
}
