import { InputHTMLAttributes } from "react";
import clsx from "clsx";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const accessibleProps = props.type === "file" && !props["aria-label"] ? { ...props, "aria-label": "Selecionar arquivos" } : props;

  return (
    <input
      className={clsx(
        "input-control w-full min-h-11 rounded-lg border border-ink/15 bg-white px-4 py-2.5 text-sm text-ink placeholder:text-slate/60 focus:border-brass focus:outline-none focus:ring-4 focus:ring-brass/15 focus-visible:ring-2 focus-visible:ring-brass/40 disabled:cursor-not-allowed disabled:border-ink/10 disabled:bg-slate/5 disabled:text-slate/70 file:mr-4 file:rounded-md file:border-0 file:bg-brass/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink",
        className
      )}
      {...accessibleProps}
    />
  );
}
