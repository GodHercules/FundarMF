import { InputHTMLAttributes } from "react";
import clsx from "clsx";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "w-full rounded-xl border border-ink/15 bg-white px-4 py-2 text-sm text-ink shadow-sm placeholder:text-slate/60 focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/30 disabled:cursor-not-allowed disabled:border-ink/10 disabled:bg-slate/5 disabled:text-slate/70 file:mr-4 file:rounded-lg file:border-0 file:bg-brass/10 file:px-4 file:py-2 file:text-xs file:font-semibold file:uppercase file:tracking-[0.18em] file:text-ink",
        className
      )}
      {...props}
    />
  );
}
