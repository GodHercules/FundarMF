import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";

import { getRequestContext } from "./request-context";
import { sanitizeCommand, sanitizeObservabilityString, sanitizeObservabilityValue } from "./observability-sanitizer";
import type { ErrorCaptureContext, ErrorCategory, ErrorEventPayload, ErrorSeverity } from "./observability.types";

type SignatureState = { at: number; count: number };

const numberEnv = (name: string, fallback: number, minimum = 0) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= minimum ? value : fallback;
};

function errorDetails(error: unknown) {
  if (error instanceof Error) return { name: error.name || "Error", message: error.message || "Unknown error", stack: error.stack ?? null };
  if (typeof error === "string") return { name: "Error", message: error, stack: null };
  return { name: "UnknownError", message: JSON.stringify(sanitizeObservabilityValue(error)) || String(error), stack: null };
}

function originFromStack(stack: string | null) {
  if (!stack) return { file: null, function: null, line: null, column: null, module: null };
  const match = stack.split("\n").find((line) => /\(?[^()\s]+:\d+:\d+\)?$/.test(line));
  if (!match) return { file: null, function: null, line: null, column: null, module: null };
  const location = match.match(/(.*?)(?:\()?([^()\s]+):(\d+):(\d+)\)?$/);
  if (!location) return { file: null, function: null, line: null, column: null, module: null };
  const file = sanitizeObservabilityString(location[2]);
  return { file, function: location[1].replace(/^\s*at\s*/, "").trim() || null, line: Number(location[3]), column: Number(location[4]), module: file.split(/[\\/]/).pop() ?? null };
}

function isExpectedHttpError(error: unknown) {
  const status = typeof error === "object" && error !== null && "getStatus" in error && typeof (error as { getStatus?: unknown }).getStatus === "function"
    ? Number((error as { getStatus: () => number }).getStatus()) : 500;
  return status >= 400 && status < 500;
}

@Injectable()
export class ErrorObservabilityService {
  private readonly recent = new Map<string, SignatureState>();
  private windowStartedAt = Date.now();
  private sentInWindow = 0;

  async capture(error: unknown, context: ErrorCaptureContext = {}): Promise<string | null> {
    const details = errorDetails(error);
    if (isExpectedHttpError(error) && !context.severity) return null;
    const requestContext = getRequestContext();
    const requestId = context.request?.requestId ?? requestContext?.correlationId ?? null;
    const category = context.category ?? this.inferCategory(details.message);
    const severity = context.severity ?? (category === "runtime" ? "fatal" : "error");
    if (!this.meetsMinimumSeverity(severity)) return null;
    const normalizedMessage = details.message.replace(/^\[[^\]]+\]\s*/, "").split("\n", 1)[0].trim();
    const signature = `${category}|${details.name}|${normalizedMessage}|${requestId ?? ""}`;
    const now = Date.now();
    const dedupWindow = numberEnv("ERROR_WEBHOOK_DEDUP_WINDOW_MS", 60_000, 0);
    const previous = this.recent.get(signature);
    if (previous && now - previous.at < dedupWindow) {
      previous.count += 1;
      return null;
    }
    this.recent.set(signature, { at: now, count: 1 });

    const payload = this.buildPayload(details, context, { category, severity, requestId });
    await this.dispatch(payload);
    return payload.eventId;
  }

  async captureFrontendEvent(input: { message: string; stack?: string; operation?: string; route?: string; correlationId?: string }) {
    const error = new Error(input.message);
    if (input.stack) error.stack = input.stack;
    return this.capture(error, {
      service: "frontend",
      processType: "frontend",
      category: "runtime",
      severity: "error",
      operation: input.operation,
      request: { route: input.route, requestId: input.correlationId },
      additionalData: { stack: input.stack ? sanitizeObservabilityString(input.stack) : null }
    });
  }

  private buildPayload(details: ReturnType<typeof errorDetails>, context: ErrorCaptureContext, values: { category: ErrorCategory; severity: ErrorSeverity; requestId: string | null }): ErrorEventPayload {
    const request = context.request ?? {};
    const execution = context.execution ?? {};
    const stack = details.stack ? sanitizeObservabilityString(details.stack) : null;
    return {
      audience: "Error",
      eventId: randomUUID(), eventType: "application_error", timestamp: new Date().toISOString(), severity: values.severity,
      environment: process.env.NODE_ENV ?? "development", application: process.env.ERROR_WEBHOOK_APPLICATION ?? "fundarmf",
      service: context.service ?? "backend", version: process.env.APP_VERSION ?? process.env.RENDER_GIT_COMMIT ?? null,
      error: {
        name: details.name, message: sanitizeObservabilityString(details.message), code: null, category: values.category,
        summary: `${details.name}: ${sanitizeObservabilityString(details.message)}`, possibleCause: null, stack
      },
      origin: originFromStack(stack),
      execution: { processId: execution.processId ?? process.pid, processType: context.processType ?? "api", command: sanitizeCommand(execution.command ?? process.argv.join(" ")), exitCode: execution.exitCode ?? null, stderr: execution.stderr ? sanitizeObservabilityString(execution.stderr) : null },
      request: { method: request.method ?? null, route: request.route ?? null, url: request.url ? sanitizeObservabilityString(request.url) : null, statusCode: request.statusCode ?? null, requestId: values.requestId, userId: request.userId ?? null, tenantId: request.tenantId ?? null, ip: request.ip ?? null },
      context: { operation: context.operation ?? null, entity: context.entity ?? null, entityId: context.entityId ?? null, jobId: execution.jobId ?? null, attempt: execution.attempt ?? null, additionalData: sanitizeObservabilityValue(context.additionalData ?? null) },
      diagnosis: { impact: context.retriable === false ? "A operação técnica falhou; o impacto exato depende do fluxo." : "A operação pode ter sido interrompida e requer verificação do correlationId.", retriable: context.retriable ?? false, suggestedAction: "Consultar a stack trace e o correlationId no log local antes de repetir a operação." }
    };
  }

  private async dispatch(payload: ErrorEventPayload) {
    const enabled = (process.env.ERROR_WEBHOOK_ENABLED ?? "false").toLowerCase() === "true";
    const url = process.env.ERROR_WEBHOOK_URL?.trim();
    if (!enabled || !url || !this.allowRate()) return;
    const serialized = JSON.stringify(payload);
    const maxBytes = numberEnv("ERROR_WEBHOOK_MAX_PAYLOAD_BYTES", 262_144, 1);
    if (Buffer.byteLength(serialized, "utf8") > maxBytes) {
      payload.error.stack = payload.error.stack?.slice(0, 2_000) ?? null;
      payload.context.additionalData = "[payload-truncated]";
    }
    const timeoutMs = numberEnv("ERROR_WEBHOOK_TIMEOUT_MS", 5_000, 100);
    const maxRetries = Math.min(numberEnv("ERROR_WEBHOOK_MAX_RETRIES", 3, 0), 5);
    let lastFailure = "unknown";
    try {
      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-error-event-id": payload.eventId }, body: JSON.stringify(payload), signal: controller.signal });
          if (response.ok) return;
          lastFailure = `http_${response.status}`;
        } catch {
          // Notification failures are isolated from the application and never recursively captured.
          lastFailure = "network_or_timeout";
        } finally { clearTimeout(timeout); }
        if (attempt < maxRetries) await new Promise((resolve) => setTimeout(resolve, Math.min(1_000 * 2 ** attempt, 8_000) + Math.floor(Math.random() * 100)));
      }
      process.stderr.write(`[observability] error webhook delivery failed (${lastFailure}) eventId=${payload.eventId}\n`);
    } finally { /* webhook failures are intentionally isolated */ }
  }

  private allowRate() {
    const now = Date.now();
    const windowMs = numberEnv("ERROR_WEBHOOK_RATE_WINDOW_MS", 60_000, 1_000);
    const limit = numberEnv("ERROR_WEBHOOK_RATE_LIMIT", 60, 1);
    if (now - this.windowStartedAt >= windowMs) {
      this.windowStartedAt = now;
      this.sentInWindow = 0;
    }
    if (this.sentInWindow >= limit) return false;
    this.sentInWindow += 1;
    return true;
  }

  private meetsMinimumSeverity(severity: ErrorSeverity) {
    const order: ErrorSeverity[] = ["info", "warn", "error", "fatal"];
    const configured = (process.env.ERROR_WEBHOOK_MIN_SEVERITY ?? "error") as ErrorSeverity;
    const minimumIndex = order.indexOf(configured);
    return order.indexOf(severity) >= (minimumIndex >= 0 ? minimumIndex : 2);
  }

  private inferCategory(message: string): ErrorCategory {
    if (/prisma|database|postgres|sql/i.test(message)) return "database";
    if (/fetch|timeout|webhook|http|socket|ECONN|ENOTFOUND/i.test(message)) return "integration";
    if (/file|pdf|upload|image|mime/i.test(message)) return "file_processing";
    if (/config|environment|DATABASE_URL|SECRET/i.test(message)) return "configuration";
    return "unknown";
  }
}
