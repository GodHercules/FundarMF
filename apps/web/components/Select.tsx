import { SelectHTMLAttributes } from "react";
import clsx from "clsx";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={clsx(
        "w-full rounded-xl border border-ink/15 bg-white px-4 py-2 text-sm text-ink shadow-sm focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/30 disabled:cursor-not-allowed disabled:border-ink/10 disabled:bg-slate/5 disabled:text-slate/70",
        className
      )}
      {...props}
    />
  );
}
