"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import type { NotifyPayload } from "@/lib/notify";

type Toast = NotifyPayload & { id: string };

const styles: Record<NotifyPayload["type"], string> = {
  success: "border-emerald-500/30 bg-emerald-50/90 text-emerald-700",
  error: "border-red-500/30 bg-red-50/90 text-red-700",
  info: "border-brass/30 bg-white/90 text-ink"
};

export function Notifications() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    function handler(event: Event) {
      const detail = (event as CustomEvent<NotifyPayload>).detail;
      if (!detail?.message) return;
      const toast: Toast = { ...detail, id: `${Date.now()}-${Math.random()}` };
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== toast.id));
      }, 7000);
    }

    window.addEventListener("app-notify", handler as EventListener);
    return () => window.removeEventListener("app-notify", handler as EventListener);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed left-1/2 top-6 z-50 flex w-[min(560px,92vw)] -translate-x-1/2 flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={clsx(
            "pointer-events-auto rounded-2xl border px-5 py-4 text-sm font-semibold shadow-soft backdrop-blur",
            styles[toast.type]
          )}
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-current">
              {toast.type === "success" && (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              )}
              {toast.type === "error" && (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 8v5" />
                  <path d="M12 16h.01" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
              )}
              {toast.type === "info" && (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8h.01" />
                  <path d="M11 11h2v5h-2z" />
                </svg>
              )}
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-current">{toast.message}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
