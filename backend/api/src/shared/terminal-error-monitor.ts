import os from "node:os";
import { NotificationService } from "../modules/notification/notification.service";

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

export const installTerminalErrorMonitor = (notificationService: NotificationService) => {
  const dedupeWindowMs = Number(process.env.N8N_ERROR_DEDUPE_WINDOW_MS ?? 5000);
  const lastBySignature = new Map<string, number>();

  const shouldSend = (signature: string) => {
    const now = Date.now();
    const previous = lastBySignature.get(signature);
    if (previous && now - previous < dedupeWindowMs) return false;
    lastBySignature.set(signature, now);
    return true;
  };

  const send = (source: ErrorSource, raw: string) => {
    if (!raw || !raw.trim()) return;
    const message = raw.length > 20_000 ? `${raw.slice(0, 20_000)}\n...truncated` : raw;
    const signature = `${source}:${message}`;
    if (!shouldSend(signature)) return;

    void notificationService.sendWebhook({
      reason: "server_terminal_error",
      channel: "system",
      audience: "Error",
      body: message,
      process: {
        source,
        pid: process.pid,
        host: os.hostname(),
        timestamp: new Date().toISOString()
      }
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
