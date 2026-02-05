import { ReactNode } from "react";
import clsx from "clsx";

type FieldProps = {
  label: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

export function Field({ label, hint, required, className, children }: FieldProps) {
  return (
    <label className={clsx("flex flex-col gap-2 text-sm text-ink", className)}>
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate">
        {label}
        {required && (
          <span className="ml-2 rounded-full bg-brass/10 px-2 py-0.5 text-[10px] text-ink">
            Obrigatório
          </span>
        )}
      </span>
      {children}
      {hint && <span className="text-xs text-slate/80">{hint}</span>}
    </label>
  );
}
