import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { AuthGuard } from "../src/common/auth/auth.guard";

function contextWithActor(actor?: unknown) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ actor }) })
  } as any;
}

describe("AuthGuard", () => {
  it("returns 401 when the session is missing", () => {
    expect(() => new AuthGuard().canActivate(contextWithActor())).toThrow(UnauthorizedException);
  });

  it("allows an authenticated actor to continue", () => {
    expect(new AuthGuard().canActivate(contextWithActor({ role: "OPERADOR", userId: "operator-1" }))).toBe(true);
  });
});
