export const API_BASE = "/api";

import { notifyError } from "@/lib/notify";

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {})
      }
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

