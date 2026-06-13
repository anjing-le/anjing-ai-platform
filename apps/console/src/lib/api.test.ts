import { afterEach, describe, expect, it, vi } from "vitest";

import { loadPlatformSnapshot, type PlatformSnapshot } from "./api";

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
});
