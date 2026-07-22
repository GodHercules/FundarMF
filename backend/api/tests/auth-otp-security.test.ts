import crypto from "node:crypto";

import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AuthService } from "../src/modules/auth/auth.service";

const hash = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

function exceptionCode(error: unknown) {
  expect(error).toBeInstanceOf(BadRequestException);
  const response = (error as BadRequestException).getResponse();
  return typeof response === "object" && response !== null && "code" in response
    ? (response as { code: string }).code
    : undefined;
}

function createHarness(overrides: Partial<Record<string, unknown>> = {}) {
  const token = "link-token";
  const otp = "123456";
  const link = {
    id: "link-1",
    tokenHash: hash(token),
    email: "cliente@example.com",
    whatsapp: null,
    usedAt: null,
    tokenExpiresAt: new Date(Date.now() + 60_000),
    otpHash: hash(otp),
    otpExpiresAt: new Date(Date.now() + 60_000),
    otpFailedAttempts: 0,
    otpBlockedUntil: null
  };

  const state = { ...link, ...overrides };
  const customerLinkToken = {
    findUnique: vi.fn(async () => ({ ...state })),
    update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      Object.assign(state, data);
      return { ...state };
    }),
    updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      if (state.usedAt) return { count: 0 };
      Object.assign(state, data);
      return { count: 1 };
    })
  };
  const tx = {
    customerLinkToken,
    $queryRaw: vi.fn(async () => [])
  };

  let transactionTail = Promise.resolve();
  const prisma = {
    $transaction: vi.fn(async <T>(callback: (transaction: typeof tx) => Promise<T>) => {
      const previous = transactionTail;
      let release!: () => void;
      transactionTail = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        return await callback(tx);
      } finally {
        release();
      }
    })
  };
  const sessionService = {
    createSession: vi.fn(async () => ({ token: "session-token" }))
  };
  const service = new AuthService(
    prisma as any,
    sessionService as any,
    { sendEmail: vi.fn(), sendWhatsApp: vi.fn(), sendWebhook: vi.fn() } as any,
    { record: vi.fn() } as any,
    { execute: vi.fn() } as any
  );

  return { service, token, otp, state, prisma, customerLinkToken, sessionService };
}

describe("AuthService OTP security", () => {
  it("accepts a valid OTP and consumes the link exactly once", async () => {
    const harness = createHarness();

    await expect(harness.service.verifyCustomerLink(harness.token, harness.otp)).resolves.toEqual({
      sessionToken: "session-token"
    });
    await expect(harness.service.verifyCustomerLink(harness.token, harness.otp)).rejects.toSatisfy(
      (error: unknown) => exceptionCode(error) === "LINK_INVALID"
    );

    expect(harness.customerLinkToken.updateMany).toHaveBeenCalledTimes(1);
    expect(harness.sessionService.createSession).toHaveBeenCalledTimes(1);
    expect(harness.state.usedAt).toBeInstanceOf(Date);
  });

  it("rejects an expired OTP without consuming the link or creating a session", async () => {
    const harness = createHarness({ otpExpiresAt: new Date(Date.now() - 1) });

    await expect(harness.service.verifyCustomerLink(harness.token, harness.otp)).rejects.toSatisfy(
      (error: unknown) => exceptionCode(error) === "OTP_EXPIRED"
    );

    expect(harness.customerLinkToken.updateMany).not.toHaveBeenCalled();
    expect(harness.sessionService.createSession).not.toHaveBeenCalled();
  });

  it("counts invalid OTP attempts and blocks after the fifth failure", async () => {
    const harness = createHarness();

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await expect(harness.service.verifyCustomerLink(harness.token, "000000")).rejects.toSatisfy(
        (error: unknown) => exceptionCode(error) === (attempt === 5 ? "OTP_LIMIT_REACHED" : "OTP_INVALID")
      );
    }

    expect(harness.state.otpFailedAttempts).toBe(5);
    expect(harness.state.otpBlockedUntil).toBeInstanceOf(Date);
    await expect(harness.service.verifyCustomerLink(harness.token, harness.otp)).rejects.toSatisfy(
      (error: unknown) => exceptionCode(error) === "OTP_LIMIT_REACHED"
    );
    expect(harness.sessionService.createSession).not.toHaveBeenCalled();
  });

  it("serializes concurrent invalid attempts so the limit cannot be bypassed", async () => {
    const harness = createHarness();

    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => harness.service.verifyCustomerLink(harness.token, "000000"))
    );

    expect(results).toHaveLength(8);
    expect(results.every((result) => result.status === "rejected")).toBe(true);
    expect(harness.state.otpFailedAttempts).toBe(5);
    expect(harness.state.otpBlockedUntil).toBeInstanceOf(Date);
    expect(harness.sessionService.createSession).not.toHaveBeenCalled();
  });
});
