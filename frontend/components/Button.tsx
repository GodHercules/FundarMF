import { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "accent";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variants: Record<ButtonVariant, string> = {
  primary: "bg-ink text-paper hover:bg-navy",
  secondary: "bg-brass text-white hover:bg-brass/90",
  accent: "bg-emerald text-white hover:bg-emerald/90",
  ghost: "border border-ink/15 bg-white/60 text-ink hover:border-brass hover:bg-brass/5",
  danger: "bg-clay text-white hover:bg-clay/90"
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "group relative isolate inline-flex min-h-11 items-center justify-center gap-2 overflow-hidden rounded-xl px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] shadow-lift transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/40 disabled:cursor-not-allowed disabled:bg-slate/40 disabled:text-white/80 disabled:shadow-none disabled:hover:translate-y-0",
        variants[variant],
        className
      )}
      {...props}
    ><span className="button-shimmer" aria-hidden="true" />{props.children}</button>
  );
}
