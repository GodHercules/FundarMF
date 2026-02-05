"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getCountries, getCountryCallingCode, parsePhoneNumber } from "libphonenumber-js";
import ReactCountryFlag from "react-country-flag";
import { Input } from "@/components/Input";
import { maskPhoneNumberBR, onlyDigits } from "@/lib/masks";

const countryNames = typeof Intl !== "undefined" && "DisplayNames" in Intl
  ? new Intl.DisplayNames(["pt-BR"], { type: "region" })
  : null;

type PhoneInputProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

export function PhoneInput({ value, onChange, label, required, disabled, className }: PhoneInputProps) {
  const countries = useMemo(() => {
    return getCountries().map((code) => ({
      code,
      name: countryNames?.of(code) ?? code,
      callingCode: getCountryCallingCode(code)
    }));
  }, []);

  const [country, setCountry] = useState("BR");
  const [ddd, setDdd] = useState("");
  const [number, setNumber] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!value) return;
    const hydrate = (parsed: ReturnType<typeof parsePhoneNumber> | undefined) => {
      if (!parsed) return;
      if (parsed.country) setCountry(parsed.country);
      const national = parsed.nationalNumber ?? "";
      if (parsed.country === "BR") {
        setDdd(national.slice(0, 2));
        setNumber(national.slice(2));
      } else {
        setDdd("");
        setNumber(national);
      }
    };

    try {
      hydrate(parsePhoneNumber(value));
    } catch {
      try {
        hydrate(parsePhoneNumber(value, "BR"));
      } catch {
        // ignore legacy or invalid formats
      }
    }
  }, [value]);

  const emit = (nextCountry: string, nextDdd: string, nextNumber: string) => {
    const calling = getCountryCallingCode(nextCountry);
    const digits = nextCountry === "BR"
      ? onlyDigits(`${nextDdd}${nextNumber}`)
      : onlyDigits(nextNumber);
    const e164 = digits.length > 0 ? `+${calling}${digits}` : "";
    onChange(e164);
  };

  const onCountryChange = (next: string) => {
    setCountry(next);
    setDdd("");
    setNumber("");
    emit(next, "", "");
    setOpen(false);
  };

  const onDddChange = (value: string) => {
    const digits = onlyDigits(value).slice(0, 2);
    setDdd(digits);
    emit(country, digits, number);
  };

  const onNumberChange = (value: string) => {
    const digits = onlyDigits(value).slice(0, country === "BR" ? 9 : 15);
    setNumber(digits);
    emit(country, ddd, digits);
  };

  const selected = countries.find((item) => item.code === country);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!open) return;
      const target = event.target as Node | null;
      if (containerRef.current && target && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      {label && (
        <label className="text-sm font-semibold text-slate">
          {label}{required ? " *" : ""}
        </label>
      )}
      <div className="grid gap-3 md:grid-cols-[1fr_1.4fr]">
        <div ref={containerRef} className="relative">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-ink/15 bg-white/90 px-4 py-2.5 text-sm text-ink shadow-sm focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/30 focus-visible:ring-2 focus-visible:ring-brass/40 disabled:cursor-not-allowed disabled:border-ink/10 disabled:bg-slate/5 disabled:text-slate/70"
            onClick={() => setOpen((prev) => !prev)}
            disabled={disabled}
            aria-expanded={open}
            aria-haspopup="listbox"
          >
            <span className="flex items-center gap-2">
              {selected?.code && (
                <ReactCountryFlag
                  countryCode={selected.code}
                  svg
                  style={{ width: "1.2em", height: "1.2em" }}
                  aria-label={selected.code}
                />
              )}
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ink">
                {selected?.code ?? "BR"}
              </span>
              <span className="text-xs text-slate">+{selected?.callingCode ?? "55"}</span>
            </span>
            <span className="text-slate" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </button>
          {open && (
            <div
              role="listbox"
              className="absolute z-50 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-ink/10 bg-white p-1 shadow-soft"
            >
              {countries.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  role="option"
                  aria-selected={item.code === country}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-brass/10 ${
                    item.code === country ? "bg-brass/15" : ""
                  }`}
                  onClick={() => onCountryChange(item.code)}
                >
                  <ReactCountryFlag
                    countryCode={item.code}
                    svg
                    style={{ width: "1.2em", height: "1.2em" }}
                    aria-label={item.code}
                  />
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ink">
                    {item.code}
                  </span>
                  <span className="ml-auto text-xs text-slate">+{item.callingCode}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {country === "BR" ? (
          <div className="grid gap-3 md:grid-cols-[90px_1fr]">
            <Input
              placeholder="DDD"
              value={ddd}
              onChange={(event) => onDddChange(event.target.value)}
              inputMode="numeric"
              maxLength={2}
              disabled={disabled}
              className="text-center"
            />
            <Input
              placeholder="Número"
              value={maskPhoneNumberBR(number)}
              onChange={(event) => onNumberChange(event.target.value)}
              inputMode="numeric"
              maxLength={10}
              disabled={disabled}
            />
          </div>
        ) : (
          <Input
            placeholder={`Número (sem +${selected?.callingCode})`}
            value={number}
            onChange={(event) => onNumberChange(event.target.value)}
            inputMode="numeric"
            maxLength={16}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  );
}

