import { afterEach, describe, expect, it, vi } from "vitest";

import {
  loadCurrentSession,
  loadPlatformSnapshot,
  loginSession,
  logoutSession,
  updateModelRoute,
  updateRoute,
  type AuthSession,
  type PlatformSnapshot,
} from "./api";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const snapshot: PlatformSnapshot = {
  dashboard: {
    metrics: [{ label: "成功率", value: "99.9%", note: "test" }],
    todos: [],
    health: [],
    audit: [],
  },
  users: [],
  applications: [],
  roles: [],
  apiKeys: [],
  credentials: [],
  routes: [],
  modelRoutes: [],
  skills: [],
  requestLogs: [],
  plans: [],
  usage: [],
  billingSummaries: [],
  budgetAlerts: [],
};

describe("console API client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the aggregate platform snapshot first", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, data: snapshot }),
    );

    const result = await loadPlatformSnapshot("admin");

    expect(result).toMatchObject({ ok: true, loaded: 1, failed: 0, source: "aggregate" });
    expect(result.snapshot.dashboard?.metrics[0].value).toBe("99.9%");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/ops/platform-snapshot");
  });

  it("falls back to granular endpoints when the aggregate endpoint is unavailable", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (input === "/api/ops/platform-snapshot") {
        return jsonResponse({ success: false, error: { code: "not_found", message: "missing" } }, 404);
      }

      if (input === "/api/ops/dashboard") {
        return jsonResponse({ success: true, data: snapshot.dashboard });
      }

      return jsonResponse({ success: true, data: [] });
    });

    const result = await loadPlatformSnapshot("developer");

    expect(result.ok).toBe(true);
    expect(result.source).toBe("granular");
    expect(result.loaded).toBeGreaterThan(1);
    expect(result.snapshot.dashboard?.metrics[0].label).toBe("成功率");
    expect(fetchMock.mock.calls.map((call) => call[0])).toContain("/api/control/users");
  });

  it("reports none when aggregate and granular endpoints are unavailable", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: false, error: { code: "offline", message: "offline" } }, 503),
    );

    const result = await loadPlatformSnapshot("operator");

    expect(result).toMatchObject({ ok: false, loaded: 0, failed: 14, source: "none" });
    expect(result.snapshot).toEqual({});
    expect(fetchMock.mock.calls[0][0]).toBe("/api/ops/platform-snapshot");
  });

  it("uses session tokens after login and clears them on logout", async () => {
    const session: AuthSession = {
      token: "sess_test",
      principal: {
        subject: "lin.chen@anjing.ai",
        role: "Administrator",
        method: "session",
      },
      expiresAt: "2026-06-28T00:00:00Z",
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (input === "/api/control/auth/login") {
        return jsonResponse({ success: true, data: session });
      }
      if (input === "/api/control/auth/session") {
        return jsonResponse({
          success: true,
          data: { authenticated: true, principal: session.principal },
        });
      }
      if (input === "/api/control/auth/logout") {
        return jsonResponse({ success: true, data: { revoked: true } });
      }
      return jsonResponse({ success: false, error: { code: "not_found", message: "missing" } }, 404);
    });

    await loginSession("admin");
    const current = await loadCurrentSession("admin");
    const logout = await logoutSession("admin");

    expect(current.principal.subject).toBe("lin.chen@anjing.ai");
    expect(logout.revoked).toBe(true);
    expect(fetchMock.mock.calls[1][1]?.headers).toMatchObject({
      Authorization: "Bearer sess_test",
    });
    expect(fetchMock.mock.calls[2][1]?.headers).toMatchObject({
      Authorization: "Bearer sess_test",
    });
  });

  it("updates a gateway route policy", async () => {
    const route = {
      id: "route_llm",
      route: "/api/v1/llm/**",
      upstream: "gateway-api",
      auth: "API Key",
      limit: "900/min",
      strategy: "ordered" as const,
      status: "Draft",
      updatedAt: "2026-06-27T00:00:00Z",
    };
    const input = {
      id: "route_llm",
      route: "/api/v1/llm/**",
      upstream: "gateway-api",
      limit: "900/min",
      strategy: "ordered" as const,
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, data: route }),
    );

    const result = await updateRoute(input, "developer");

    expect(result.id).toBe("route_llm");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/gateway/routes/update");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
    expect(fetchMock.mock.calls[0][1]?.body).toBe(JSON.stringify(input));
  });

  it("updates a model route policy", async () => {
    const route = {
      id: "model_route_agent",
      alias: "agent-default",
      scenario: "Agent",
      primary: "gpt-4.1-mini",
      fallback: "local-fallback",
      status: "Draft",
      updatedAt: "2026-06-27T00:00:00Z",
    };
    const input = {
      id: "model_route_agent",
      alias: "agent-premium",
      scenario: "Premium Agent",
      primary: "gpt-4.1",
      fallback: "claude-haiku",
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, data: route }),
    );

    const result = await updateModelRoute(input, "developer");

    expect(result.id).toBe("model_route_agent");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/gateway/model-routes/update");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
    expect(fetchMock.mock.calls[0][1]?.body).toBe(JSON.stringify(input));
  });
});
