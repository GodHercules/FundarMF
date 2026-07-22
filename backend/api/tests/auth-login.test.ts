import bcrypt from "bcryptjs";
import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AuthService } from "../src/modules/auth/auth.service";

describe("AuthService login", () => {
  it("logs in master user with correct password", async () => {
    const passwordHash = await bcrypt.hash("test-password-only-123456", 10);
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "u1",
          email: "master@fundarmf.local",
          role: "MASTER",
          active: true,
          passwordHash
        })
      }
    };
    const sessionService = {
      createSession: vi.fn().mockResolvedValue({ token: "token-123" })
    };
    const notificationService = {} as any;
    const auditService = { record: vi.fn() };
    const service = new AuthService(prisma as any, sessionService as any, notificationService, auditService as any);

    const result = await service.loginUser("master@fundarmf.local", "test-password-only-123456", "MASTER");
    expect(result.token).toBe("token-123");
  });

  it("rejects login with invalid password", async () => {
    const passwordHash = await bcrypt.hash("test-password-only-123456", 10);
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "u1",
          email: "master@fundarmf.local",
          role: "MASTER",
          active: true,
          passwordHash
        })
      }
    };
    const sessionService = {
      createSession: vi.fn()
    };
    const notificationService = {} as any;
    const auditService = { record: vi.fn() };
    const service = new AuthService(prisma as any, sessionService as any, notificationService, auditService as any);

    await expect(service.loginUser("master@fundarmf.local", "wrong", "MASTER")).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });
});
