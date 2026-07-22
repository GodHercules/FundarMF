export const API_BASE = "/api";
export const DOCS_API_BASE = "/apix";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
    public readonly correlationId?: string,
    public readonly raw?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

import { notifyError } from "@/lib/notify";
import { logClientPerf } from "@/lib/perf";
import { reportClientError } from "@/lib/observability";

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
        OTP_TOO_SOON: "Aguarde alguns minutos para solicitar um novo OTP.",
        OTP_LIMIT_REACHED: "Limite de reenvios de OTP atingido para este link.",
        LINK_INVALID: "Link inválido ou expirado."
      };

      if (errorCode && codeMessages[errorCode]) {
        errorMessage = codeMessages[errorCode];
      }

      if (response.status >= 500) {
        errorMessage = "Serviço temporariamente indisponível. Tente novamente em instantes.";
        reportClientError({ message: `API ${response.status}: ${path}`, operation: `${method} ${path}`, route: typeof window !== "undefined" ? window.location.pathname : undefined, correlationId: response.headers.get("x-correlation-id") ?? undefined });
      }

      notifyError(errorMessage);
      const err = new ApiError(
        errorMessage,
        response.status,
        errorCode,
        response.headers.get("x-correlation-id") ?? undefined,
        errorText
      );
      (err as ApiError & { handled?: boolean }).handled = true;
      throw err;
    }

    return response.json();
  } catch (error: unknown) {
    const message = error instanceof ApiError
      ? error.message
      : "Não foi possível conectar ao serviço. Tente novamente em instantes.";
    const handled = error instanceof Error && "handled" in error && error.handled === true;
    if (!handled) {
      notifyError(message);
    }
    throw error;
  }
}
