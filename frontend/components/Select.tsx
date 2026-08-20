import { SelectHTMLAttributes } from "react";
import clsx from "clsx";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={clsx(
        "w-full min-h-11 rounded-xl border border-ink/15 bg-white/90 px-4 py-2.5 text-sm text-ink shadow-sm focus:border-brass focus:outline-none focus:ring-4 focus:ring-brass/15 focus-visible:ring-2 focus-visible:ring-brass/40 disabled:cursor-not-allowed disabled:border-ink/10 disabled:bg-slate/5 disabled:text-slate/70",
        className
      )}
      {...props}
    />
  );
}
