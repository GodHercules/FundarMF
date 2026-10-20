import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const notifyErrorMock = vi.fn();
const reportClientErrorMock = vi.fn();
const logClientPerfMock = vi.fn();

vi.mock("@/lib/notify", () => ({ notifyError: notifyErrorMock }));
vi.mock("@/lib/observability", () => ({ reportClientError: reportClientErrorMock }));
vi.mock("@/lib/perf", () => ({ logClientPerf: logClientPerfMock }));

function stubLocationAssign() {
  const assignMock = vi.fn();
  const testWindow = {
    location: {
      pathname: window.location.pathname,
      origin: window.location.origin,
      assign: assignMock
    },
    sessionStorage: window.sessionStorage
  } as unknown as Window & typeof globalThis;

  vi.stubGlobal("window", testWindow);
  return assignMock;
}

describe("api session expiry", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/operator/dashboard");
    window.sessionStorage.clear();
  });

afterEach(() => {
vi.unstubAllGlobals();
});

  it("logs out and redirects staff to login when access is revoked", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Sessão expirada." }), { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
const assignMock = stubLocationAssign();

    const { api } = await import("@/lib/api");

    await expect(api("/processes")).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      message: "Sessão expirada. Faça login novamente."
    });

    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/auth/logout", expect.objectContaining({
      method: "POST",
      credentials: "include"
    }));
    expect(window.sessionStorage.getItem("fundarmf:session-message")).toBe("Sessão expirada. Faça login novamente.");
    expect(assignMock).toHaveBeenCalledWith("/?reason=session-expired");
expect(notifyErrorMock).toHaveBeenCalledWith("Sessão expirada. Faça login novamente.");
  });

  it("keeps invalid login credentials on the login screen", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Credenciais inválidas." }), { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
const assignMock = stubLocationAssign();

    const { api } = await import("@/lib/api");
    await expect(api("/auth/operator/login", { method: "POST", body: "{}" })).rejects.toMatchObject({
      status: 401,
      message: "Credenciais inválidas."
    });

expect(fetchMock).toHaveBeenCalledTimes(1);
expect(assignMock).not.toHaveBeenCalled();
  });
});
