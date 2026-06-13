import { describe, expect, it } from "vitest";

import { modulePages } from "../data/console";
import { hydrateHomeMetrics, hydrateModulePages, hydrateTodos } from "./hydrate";
import type { PlatformSnapshot } from "./api";

const snapshot: PlatformSnapshot = {
  dashboard: {
    metrics: [
      { label: "今日调用", value: "12K", note: "live" },
      { label: "成功率", value: "99.9%", note: "live" },
      { label: "待处理", value: "2", note: "live" },
      { label: "今日成本", value: "$18", note: "live" },
    ],
    todos: [
      {
        id: "todo-api-key",
        title: "API Key 待审批",
        source: "用户与权限",
        owner: "管理员",
        status: "Pending",
        updatedAt: "10:20",
      },
      {
        id: "todo-budget",
        title: "预算接近阈值",
        source: "计费与配额",
        owner: "运维人员",
        status: "Warning",
        updatedAt: "10:30",
      },
    ],
    health: [],
    audit: [],
  },
  users: [
    {
      id: "user-1",
      email: "dev@anjing.ai",
      org: "Engineering",
      role: "Developer",
      mfa: "Enabled",
      status: "Active",
      createdAt: "today",
    },
  ],
  roles: [
    {
      id: "role-dev",
      name: "Developer",
      visibleEntries: "Gateway",
      configScope: "Routes",
      restriction: "No billing",
      status: "Active",
    },
  ],
  apiKeys: [],
  credentials: [],
  routes: [
    {
      id: "route-1",
      route: "/api/v1/agents/**",
      upstream: "gateway-api",
      auth: "API Key",
      limit: "600/min",
      status: "Published",
      updatedAt: "today",
    },
  ],
  modelRoutes: [],
  skills: [],
  requestLogs: [],
  plans: [
    {
      id: "plan-1",
      name: "Team",
      target: "Workspace",
      rps: "300",
      tokenPerDay: "2M",
      status: "Active",
    },
  ],
  usage: [],
  budgetAlerts: [
    {
      id: "budget-1",
      project: "aigc-lab",
      budget: "$1000",
      current: "$920",
      threshold: "90%",
      status: "Warning",
    },
  ],
};

describe("console snapshot hydration", () => {
  it("keeps the first home metric as the fixed business entry count", () => {
    const metrics = hydrateHomeMetrics(snapshot);

    expect(metrics).toHaveLength(4);
    expect(metrics[0]).toMatchObject({ label: "业务入口", value: "5" });
    expect(metrics[1]).toMatchObject({ label: "成功率", value: "99.9%", tone: "good" });
  });

  it("maps backend todo source labels to console routes", () => {
    const todos = hydrateTodos(snapshot);

    expect(todos?.map((todo) => [todo.id, todo.moduleId, todo.tone])).toEqual([
      ["todo-api-key", "iam", "watch"],
      ["todo-budget", "quota", "warn"],
    ]);
  });

  it("hydrates module tables from the live snapshot", () => {
    const pages = hydrateModulePages(modulePages, snapshot);
    const overview = pages.find((page) => page.id === "overview");
    const iam = pages.find((page) => page.id === "iam");
    const gateway = pages.find((page) => page.id === "gateway");
    const quota = pages.find((page) => page.id === "quota");

    expect(overview?.table.rows).toHaveLength(2);
    expect(iam?.metrics[0]).toMatchObject({ label: "用户", value: "1" });
    expect(gateway?.table.rows[0].cells).toContain("/api/v1/agents/**");
    expect(quota?.metrics[2]).toMatchObject({ label: "预算告警", value: "1", tone: "warn" });
  });
});
