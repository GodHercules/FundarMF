type ClientErrorInput = { message: string; stack?: string; operation?: string; route?: string; correlationId?: string };

let lastSignature = "";
let lastAt = 0;

export function reportClientError(input: ClientErrorInput) {
  const message = String(input.message || "Unknown frontend error").slice(0, 2_000);
  const signature = `${message}|${input.operation ?? ""}|${input.route ?? ""}`;
  const now = Date.now();
  if (signature === lastSignature && now - lastAt < 60_000) return;
  lastSignature = signature;
  lastAt = now;
  void fetch("/api/observability/frontend", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message,
      stack: input.stack?.slice(0, 8_000),
      operation: input.operation?.slice(0, 300),
      route: input.route?.slice(0, 500),
      correlationId: input.correlationId?.slice(0, 128)
    })
  }).catch(() => undefined);
}
