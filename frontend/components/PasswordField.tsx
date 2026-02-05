import { useState } from "react";
import clsx from "clsx";
import { Input } from "@/components/Input";

type PasswordFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  showStrength?: boolean;
  matchWith?: string;
};

function getStrength(value: string) {
  if (!value) return { label: "", percent: 0, color: "bg-slate/20" };
  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasNumber = /\d/.test(value);
  const hasSymbol = /[^A-Za-z0-9]/.test(value);
  const score = [hasUpper, hasLower, hasNumber, hasSymbol].filter(Boolean).length;

  if (value.length >= 10 && score >= 4) {
    return { label: "Forte", percent: 100, color: "bg-emerald" };
  }
  if (value.length >= 6 && score >= 2) {
    return { label: "Moderada", percent: 66, color: "bg-yellow-500" };
  }
  return { label: "Fraca", percent: 33, color: "bg-clay" };
}

export function PasswordField({
  value,
  onChange,
  placeholder,
  className,
  showStrength = true,
  matchWith
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const strength = getStrength(value);
  const showMatch = matchWith !== undefined && value.length > 0;
  const matches = showMatch ? value === matchWith : false;

  return (
    <div className={clsx("space-y-2", className)}>
      <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="pr-16"
      />
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-brass/10 p-2 text-ink"
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
      >
        {visible ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
            <path d="M9 15l6-6" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
      </div>
      {showStrength && strength.label && (
        <div className="space-y-1">
          <div className="h-1.5 w-full rounded-full bg-slate/10">
            <div className={clsx("h-1.5 rounded-full transition-all", strength.color)} style={{ width: `${strength.percent}%` }} />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate">
            Força: <span className="text-ink">{strength.label}</span>
          </p>
        </div>
      )}
      {showMatch && !showStrength && (
        <p className={clsx("text-[11px] font-semibold uppercase tracking-[0.18em]", matches ? "text-emerald" : "text-clay")}>
          {matches ? "Senhas coincidem" : "Senhas não coincidem"}
        </p>
      )}
    </div>
  );
}

