import os from "node:os";

import { ErrorObservabilityService } from "./error-observability.service";

type ErrorSource = "console.error" | "uncaughtException" | "unhandledRejection";

const toErrorText = (value: unknown) => {
  if (value instanceof Error) {
    return value.stack || `${value.name}: ${value.message}`;
  }

  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const formatArgs = (args: unknown[]) => args.map((arg) => toErrorText(arg)).join(" ");

const isExpectedTerminalError = (raw: string) => /(?:BadRequestException|UnauthorizedException|ForbiddenException|NotFoundException|\bOTP_INVALID\b|\bLINK_INVALID\b)/i.test(raw);

export const installTerminalErrorMonitor = (observability: ErrorObservabilityService) => {
  const send = (source: ErrorSource, raw: string) => {
    if (!raw || !raw.trim()) return;
    if (isExpectedTerminalError(raw)) return;
    void observability.capture(new Error(raw), {
      service: "backend",
      processType: "api",
      category: "runtime",
      severity: source === "uncaughtException" ? "fatal" : "error",
      operation: source,
      execution: { processId: process.pid, stderr: source === "console.error" ? raw : undefined, command: process.argv.join(" ") },
      additionalData: { source, host: os.hostname() }
    });
  };

  const originalConsoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    originalConsoleError(...args);
    try {
      send("console.error", formatArgs(args));
    } catch {
      // Ignore monitor failures to avoid breaking runtime logging.
    }
  };

  process.on("uncaughtException", (error) => {
    try {
      send("uncaughtException", toErrorText(error));
    } catch {
      // Ignore monitor failures.
    }
  });

  process.on("unhandledRejection", (reason) => {
    try {
      send("unhandledRejection", toErrorText(reason));
    } catch {
      // Ignore monitor failures.
    }
  });
};
