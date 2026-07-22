const SECRET_KEY = /(password|senha|token|access.?token|refresh.?token|authorization|cookie|api.?key|secret|connection.?string|credential|otp|session.?id)/i;
const MAX_STRING_LENGTH = 8_000;

export function sanitizeObservabilityValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[truncated-depth]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return sanitizeObservabilityString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Error) return { name: value.name, message: sanitizeObservabilityString(value.message), stack: sanitizeObservabilityString(value.stack ?? "") };
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeObservabilityValue(item, depth + 1));
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 100)) {
      output[key] = SECRET_KEY.test(key) ? "[REDACTED]" : sanitizeObservabilityValue(item, depth + 1);
    }
    return output;
  }
  return String(value);
}

export function sanitizeObservabilityString(value: string): string {
  let output = value;
  output = output.replace(/([?&](?:token|access_token|refresh_token|api_key|key|secret|password|code)=)[^&\s]+/gi, "$1[REDACTED]");
  output = output.replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1[REDACTED]");
  output = output.replace(/(postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s]+/gi, "$1://[REDACTED]");
  return output.length > MAX_STRING_LENGTH ? `${output.slice(0, MAX_STRING_LENGTH)}\n...[truncated]` : output;
}

export function sanitizeCommand(command?: string | null) {
  return command ? sanitizeObservabilityString(command).slice(0, 2_000) : null;
}
