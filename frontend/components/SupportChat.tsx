"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/Button";

function normalizeWhatsapp(raw?: string) {
  if (!raw) return "";
  const cleaned = raw.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) return cleaned.slice(1);
  if (cleaned.startsWith("00")) return cleaned.slice(2);
  return cleaned;
}

export function SupportChat() {
  const [open, setOpen] = useState(false);

  const whatsappHref = useMemo(() => {
    const number = normalizeWhatsapp(process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP);
    if (!number) return "";
    return `https://wa.me/${number}`;
  }, []);

  const emailHref = useMemo(() => {
    const email = (process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "").trim();
    if (!email) return "";
    return `mailto:${email}`;
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-ink text-white shadow-soft hover:opacity-90"
        aria-label="Abrir chat de suporte"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9.09 9a3 3 0 0 1 5.82 1c0 2-3 2-3 4" />
          <circle cx="12" cy="12" r="9" />
          <path d="M12 17h.01" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center lg:justify-end">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-soft lg:mr-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-ink">Chat de suporte</h4>
                <p className="mt-1 text-xs text-slate">Fale com nosso time durante todo o processo.</p>
              </div>
              <button
                type="button"
                className="rounded-full bg-slate/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate"
                onClick={() => setOpen(false)}
              >
                Fechar
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {whatsappHref && (
                <a href={whatsappHref} target="_blank" rel="noreferrer" className="block">
                  <Button className="w-full bg-emerald">Abrir chat no WhatsApp</Button>
                </a>
              )}
              {emailHref && (
                <a href={emailHref} className="block">
                  <Button className="w-full bg-ink">Enviar e-mail ao suporte</Button>
                </a>
              )}
              {!whatsappHref && !emailHref && (
                <p className="text-xs text-slate">
                  Suporte indisponível no momento. Solicite ao operador o canal de atendimento.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
