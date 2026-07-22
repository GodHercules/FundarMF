import { BadRequestException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ErrorObservabilityService } from "../src/shared/error-observability.service";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe("ErrorObservabilityService", () => {
  it("builds a structured sanitized payload and preserves the stack origin", async () => {
    process.env.ERROR_WEBHOOK_ENABLED = "true";
    process.env.ERROR_WEBHOOK_URL = "https://errors.example.test/hook?token=secret";
    process.env.ERROR_WEBHOOK_MAX_RETRIES = "0";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok", { status: 200 }));
    const service = new ErrorObservabilityService();

    await service.capture(new Error("database password=do-not-send"), {
      category: "database",
      request: { method: "POST", route: "/processes/:id", url: "/processes/p1?token=secret", requestId: "corr-1" },
      additionalData: { password: "secret", nested: [{ authorization: "Bearer abc" }] }
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(payload.eventId).toEqual(expect.any(String));
    expect(payload.error.stack).toContain("Error: database");
    expect(payload.request.url).toContain("[REDACTED]");
    expect(payload.context.additionalData).toEqual({ password: "[REDACTED]", nested: [{ authorization: "[REDACTED]" }] });
  });

  it("does not notify expected 4xx business errors", async () => {
    process.env.ERROR_WEBHOOK_ENABLED = "true";
    process.env.ERROR_WEBHOOK_URL = "https://errors.example.test/hook";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok", { status: 200 }));
    const service = new ErrorObservabilityService();
    await service.capture(new BadRequestException("Dados inválidos"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries and deduplicates the same failure", async () => {
    process.env.ERROR_WEBHOOK_ENABLED = "true";
    process.env.ERROR_WEBHOOK_URL = "https://errors.example.test/hook";
    process.env.ERROR_WEBHOOK_MAX_RETRIES = "2";
    process.env.ERROR_WEBHOOK_DEDUP_WINDOW_MS = "60000";
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("no", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const service = new ErrorObservabilityService();
    await service.capture(new Error("external unavailable"));
    await service.capture(new Error("external unavailable"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps the application path working when the webhook is disabled or fails", async () => {
    process.env.ERROR_WEBHOOK_ENABLED = "false";
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const service = new ErrorObservabilityService();
    await expect(service.capture(new Error("local only"))).resolves.toEqual(expect.any(String));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
