import { homeMetrics } from "../data/console";
import type { PlatformSnapshot } from "./api";
import { metricFromApi } from "./api";
import type {
  ConsoleRoute,
  MetricItem,
  ModulePageDefinition,
  StatusTone,
  TableRow,
  TodoItem,
} from "../types";

const sourceToRoute: Record<string, ConsoleRoute> = {
  "运营总览": "overview",
  "用户与权限": "iam",
  "网关与模型": "gateway",
  "计费与配额": "quota",
  "帮助文档": "docs",
};

export function hydrateHomeMetrics(snapshot?: PlatformSnapshot): MetricItem[] {
  if (!snapshot?.dashboard?.metrics?.length) {
    return homeMetrics;
  }

  return [
    { label: "业务入口", value: "5", note: "按角色显示", tone: "neutral" },
    ...snapshot.dashboard.metrics.slice(1, 4).map((metric, index) =>
      metricFromApi(metric, index === 0 ? "good" : index === 1 ? "watch" : "neutral"),
    ),
  ];
}

export function hydrateTodos(snapshot?: PlatformSnapshot): TodoItem[] | undefined {
  if (!snapshot?.dashboard?.todos?.length) {
    return undefined;
  }

  return snapshot.dashboard.todos.map((todo) => ({
    id: todo.id,
    moduleId: sourceToRoute[todo.source] || "overview",
    moduleLabel: todo.source,
    title: todo.title,
    status: todo.status,
    owner: todo.owner,
    tone: toneForStatus(todo.status),
  }));
}

export function hydrateModulePages(
  pages: ModulePageDefinition[],
  snapshot?: PlatformSnapshot,
): ModulePageDefinition[] {
  if (!snapshot) {
    return pages;
  }

  return pages.map((page) => {
    if (page.id === "overview" && snapshot.dashboard) {
      return {
        ...page,
        metrics: snapshot.dashboard.metrics.map((metric) =>
          metricFromApi(metric, toneForMetric(metric.label, metric.value)),
        ),
        table: {
          ...page.table,
          rows: snapshot.dashboard.todos.map((todo) => ({
            id: todo.id,
            cells: [todo.title, todo.source, todo.owner, todo.status],
            status: todo.status,
            tone: toneForStatus(todo.status),
          })),
        },
      };
    }

    if (page.id === "iam" && snapshot.users) {
      return {
        ...page,
        metrics: [
          metric("用户", `${snapshot.users.length}`, "Go API live"),
          metric("角色", `${snapshot.roles?.length || 0}`, "admin / user / developer / operator"),
          metric("API Key", `${snapshot.apiKeys?.length || 0}`, "有效密钥", "good"),
          metric("凭据引用", `${snapshot.credentials?.length || 0}`, "credentialRef", "watch"),
        ],
        table: {
          ...page.table,
          rows: snapshot.users.map((user) => ({
            id: user.id,
            cells: [user.email, user.org, user.role, user.mfa, user.status],
            status: user.status,
            tone: toneForStatus(user.status),
          })),
        },
      };
    }

    if (page.id === "gateway" && snapshot.routes) {
      return {
        ...page,
        metrics: [
          metric("API 路由", `${snapshot.routes.length}`, "Go API live"),
          metric("模型别名", `${snapshot.modelRoutes?.length || 0}`, "chat / embedding / rerank"),
          metric("Skill", `${snapshot.skills?.length || 0}`, "published / draft", "good"),
          metric("请求日志", `${snapshot.requestLogs?.length || 0}`, "latest events", "watch"),
        ],
        table: {
          ...page.table,
          rows: snapshot.routes.map((route) => ({
            id: route.id,
            cells: [route.route, route.upstream, route.auth, route.limit, route.status],
            status: route.status,
            tone: toneForStatus(route.status),
          })),
        },
      };
    }

    if (page.id === "quota" && snapshot.plans) {
      const warningCount = snapshot.budgetAlerts?.filter((alert) => alert.status !== "Normal").length || 0;
      return {
        ...page,
        metrics: [
          metric("套餐", `${snapshot.plans.length}`, "Go API live"),
          metric("用量项目", `${snapshot.usage?.length || 0}`, "usage records"),
          metric("预算告警", `${warningCount}`, "near limit", warningCount > 0 ? "warn" : "good"),
          metric("预算规则", `${snapshot.budgetAlerts?.length || 0}`, "active budgets"),
        ],
        table: {
          ...page.table,
          rows: snapshot.plans.map((plan) => ({
            id: plan.id,
            cells: [plan.name, plan.target, plan.rps, plan.tokenPerDay, plan.status],
            status: plan.status,
            tone: toneForStatus(plan.status),
          })),
        },
      };
    }

    if (page.id === "docs" && snapshot.applications) {
      const activeCount = snapshot.applications.filter((app) => app.status === "Active").length;
      const productionCount = snapshot.applications.filter((app) => app.environment === "Production").length;
      return {
        ...page,
        metrics: [
          metric("接入应用", `${snapshot.applications.length}`, "Go API live"),
          metric("生产应用", `${productionCount}`, "production"),
          metric("Active", `${activeCount}`, "ready to call", activeCount > 0 ? "good" : "watch"),
          metric("API Key", `${snapshot.apiKeys?.length || 0}`, "issued keys"),
        ],
        table: {
          ...page.table,
          eyebrow: "Applications",
          title: "接入应用",
          columns: ["应用", "Owner", "环境", "默认路由", "套餐", "状态"],
          rows: snapshot.applications.map((app) => ({
            id: app.id,
            cells: [app.name, app.owner, app.environment, app.defaultRoute, app.plan, app.status],
            status: app.status,
            tone: toneForStatus(app.status),
          })),
        },
      };
    }

    return page;
  });
}

function metric(label: string, value: string, note: string, tone: StatusTone = "neutral"): MetricItem {
  return { label, value, note, tone };
}

function toneForMetric(label: string, value: string): StatusTone {
  if (label.includes("成功") || value.includes("99")) {
    return "good";
  }

  if (label.includes("待") || label.includes("告警")) {
    return "watch";
  }

  return "neutral";
}

function toneForStatus(status: string): StatusTone {
  const normalized = status.toLowerCase();

  if (["active", "success", "normal", "ready", "published"].includes(normalized)) {
    return "good";
  }

  if (["warning", "degraded", "expiring"].includes(normalized)) {
    return "warn";
  }

  if (["watching", "pending", "draft", "guarded", "invited"].includes(normalized)) {
    return "watch";
  }

  return "neutral";
}
