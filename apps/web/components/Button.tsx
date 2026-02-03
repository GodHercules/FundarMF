import { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center rounded-lg bg-ink px-5 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-paper shadow-soft transition hover:-translate-y-0.5 hover:bg-navy disabled:cursor-not-allowed disabled:bg-slate/50 disabled:text-white/80 disabled:shadow-none disabled:hover:translate-y-0",
        className
      )}
      {...props}
    />
  );
}
