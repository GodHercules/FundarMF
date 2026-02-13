export const API_BASE = "/api";
export const DOCS_API_BASE = "/apix";

import { notifyError } from "@/lib/notify";
import { logClientPerf } from "@/lib/perf";

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    const base = path.startsWith("/documents/") ? DOCS_API_BASE : API_BASE;
    const requestUrl = `${base}${path}`;
    const perfUrl =
      typeof window !== "undefined" ? new URL(requestUrl, window.location.origin).toString() : requestUrl;
    const start = typeof performance !== "undefined" ? performance.now() : Date.now();
    const response = await fetch(requestUrl, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {})
      }
    });
    const end = typeof performance !== "undefined" ? performance.now() : Date.now();
    const method = options.method ?? "GET";
    let ttfbMs: number | undefined;
    if (typeof performance !== "undefined" && "getEntriesByName" in performance) {
      const entries = performance.getEntriesByName(perfUrl);
      const lastEntry = entries[entries.length - 1] as PerformanceResourceTiming | undefined;
      if (lastEntry && "responseStart" in lastEntry) {
        ttfbMs = Math.round(lastEntry.responseStart - lastEntry.startTime);
      }
    }
    logClientPerf("api_request", {
      path,
      method,
      status: response.status,
      totalMs: Math.round(end - start),
      ttfbMs,
      correlationId: response.headers.get("x-correlation-id") ?? undefined
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = errorText || "Erro na API";
      let errorCode: string | undefined;

      try {
        const parsed = JSON.parse(errorText);
        if (Array.isArray(parsed?.message)) {
          errorMessage = parsed.message.join(" ");
        } else if (parsed?.message && typeof parsed.message === "string") {
          errorMessage = parsed.message;
        }
        if (parsed?.message && typeof parsed.message === "object" && parsed.message.code) {
          errorCode = parsed.message.code as string;
          errorMessage = errorCode;
        }
        if (parsed?.code) {
          errorCode = parsed.code as string;
          errorMessage = parsed.code as string;
        }
      } catch {
        // ignore
      }

      const codeMessages: Record<string, string> = {
        OTP_INVALID: "OTP inválido.",
        OTP_EXPIRED: "OTP expirado.",
        OTP_REQUIRED: "OTP obrigatório.",
        LINK_INVALID: "Link inválido ou expirado."
      };

      if (errorCode && codeMessages[errorCode]) {
        errorMessage = codeMessages[errorCode];
      }

      notifyError(errorMessage);
      const err = new Error(errorMessage);
      (err as any).handled = true;
      (err as any).code = errorCode;
      (err as any).raw = errorText;
      throw err;
    }

    return response.json();
  } catch (error: any) {
    if (error?.message && !error?.handled) {
      notifyError(error.message);
    }
    throw error;
  }
}
