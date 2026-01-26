import { InputHTMLAttributes } from "react";
import clsx from "clsx";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "w-full rounded-xl border border-ink/15 bg-white/90 px-4 py-2 text-sm shadow-sm focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/30",
        className
      )}
      {...props}
    />
  );
}
