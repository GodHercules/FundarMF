import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const notifyErrorMock = vi.fn();
const reportClientErrorMock = vi.fn();
const logClientPerfMock = vi.fn();

vi.mock("@/lib/notify", () => ({ notifyError: notifyErrorMock }));
vi.mock("@/lib/observability", () => ({ reportClientError: reportClientErrorMock }));
vi.mock("@/lib/perf", () => ({ logClientPerf: logClientPerfMock }));

function stubLocationAssign() {
  const assignMock = vi.fn();
  const replaceMock = vi.fn();
  const testWindow = {
    location: {
      pathname: window.location.pathname,
      origin: window.location.origin,
      assign: assignMock,
      replace: replaceMock
    },
    sessionStorage: window.sessionStorage
  } as unknown as Window & typeof globalThis;

  vi.stubGlobal("window", testWindow);
  return { assignMock, replaceMock };
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
    const { assignMock, replaceMock } = stubLocationAssign();

    const { api } = await import("@/lib/api");

    await expect(api("/processes")).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      message: "Sessão expirada. Faça novamente o login."
    });

    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/auth/logout", expect.objectContaining({
      method: "POST",
      credentials: "include"
    }));
    expect(window.sessionStorage.getItem("fundarmf:session-message")).toBe("Sessão expirada. Faça novamente o login.");
    expect(replaceMock).toHaveBeenCalledWith("/?reason=session-expired");
    expect(assignMock).not.toHaveBeenCalled();
    expect(notifyErrorMock).toHaveBeenCalledWith("Sessão expirada. Faça novamente o login.");
  });

  it("keeps the session and uses a safe message for a legitimate 403", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Forbidden resource" }), { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    const { assignMock, replaceMock } = stubLocationAssign();
    const { api } = await import("@/lib/api");

    await expect(api("/processes/kanban")).rejects.toMatchObject({
      name: "ApiError",
      status: 403,
      message: "Você não tem permissão para acessar este recurso."
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(assignMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
    expect(notifyErrorMock).toHaveBeenCalledWith("Você não tem permissão para acessar este recurso.");
  });

  it("runs only one recovery flow for simultaneous 401 responses", async () => {
    const fetchMock = vi.fn((request: RequestInfo | URL) => {
      if (String(request) === "/api/auth/logout") {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ message: "Sessão expirada." }), { status: 401 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const { replaceMock } = stubLocationAssign();
    const { api } = await import("@/lib/api");

    await Promise.allSettled([api("/processes"), api("/notifications")]);

    expect(fetchMock.mock.calls.filter(([request]) => String(request) === "/api/auth/logout")).toHaveLength(1);
    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(notifyErrorMock).toHaveBeenCalledTimes(1);
  });

  it("keeps invalid login credentials on the login screen", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Credenciais inválidas." }), { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
const { assignMock } = stubLocationAssign();

    const { api } = await import("@/lib/api");
    await expect(api("/auth/operator/login", { method: "POST", body: "{}" })).rejects.toMatchObject({
      status: 401,
      message: "Credenciais inválidas."
    });

expect(fetchMock).toHaveBeenCalledTimes(1);
expect(assignMock).not.toHaveBeenCalled();
  });
});
