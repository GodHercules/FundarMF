"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/observability";

export function ClientErrorMonitor() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => reportClientError({ message: event.message, stack: event.error?.stack, operation: "window.error", route: window.location.pathname });
    const onRejection = (event: PromiseRejectionEvent) => reportClientError({ message: event.reason instanceof Error ? event.reason.message : String(event.reason), stack: event.reason instanceof Error ? event.reason.stack : undefined, operation: "unhandledrejection", route: window.location.pathname });
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onRejection); };
  }, []);
  return null;
}
