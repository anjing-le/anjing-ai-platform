import {
  ArrowRight,
  ArrowDownUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Copy,
  Download,
  RefreshCw,
  Search,
} from "lucide-react";
import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ActionDialog, type ActionMode, type ActionValues } from "./components/ActionDialog";
import { ConfirmDialog, type ConfirmDialogCopy } from "./components/ConfirmDialog";
import { backendPlan, consoleServiceMap, modulePages, navItems, roles, todos } from "./data/console";
import {
  activateApplication,
  activatePlan,
  activateUser,
  createApplication,
  createModelRoute,
  createPlan,
  createRoute,
  createSkillBinding,
  createUser,
  invokeLLM,
  invokeSkill,
  loadPlatformSnapshot,
  publishModelRoute,
  publishRoute,
  publishSkillBinding,
  resolveBudgetAlert,
  resolveTodo,
  rotateCredential,
  revokeAPIKey,
  rotateApplicationKey,
  type APIKey,
  type Application,
  type BudgetAlert,
  type BillingPlan,
  type ControlUser,
  type CreateModelRouteInput,
  type CreateSkillBindingInput,
  type Credential,
  type GatewayRoute,
  type LLMInvokeResponse,
  type ModelRoute,
  type PlatformSnapshot,
  type SkillInvokeInput,
  type SkillInvokeResponse,
  type SkillBinding,
} from "./lib/api";
import {
  canAccessRoute,
  canManageApplicationOnboarding,
  canRunPrimaryAction,
  primaryActionHint,
  visibleNavItems,
} from "./lib/access";
import { hydrateHomeMetrics, hydrateModulePages, hydrateTodos } from "./lib/hydrate";
import type {
  ConsoleRoute,
  MetricItem,
  ModulePageDefinition,
  NavItem,
  RoleId,
  StatusTone,
  TableRow,
  TodoItem,
} from "./types";

type ApiState = "loading" | "live" | "fallback";
type TableSortDirection = "asc" | "desc";

interface TableSortState {
  columnIndex: number;
  direction: TableSortDirection;
}

type ConfirmIntentType =
  | "application-key-rotate"
  | "route-publish"
  | "model-route-publish"
  | "skill-binding-publish"
  | "plan-activate"
  | "budget-alert-resolve"
  | "credential-rotate"
  | "api-key-revoke";

interface ConfirmIntent extends ConfirmDialogCopy {
  fallbackError: string;
  id: string;
  type: ConfirmIntentType;
}

interface WorkflowStep {
  label: string;
  note: string;
  tab?: string;
}

function formatSyncTime(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

const tableSortCollator = new Intl.Collator("zh-CN", {
  numeric: true,
  sensitivity: "base",
});

const tablePageSizes = [5, 10, 20];

function compareTableCell(a: string, b: string, direction: TableSortDirection) {
  const result = tableSortCollator.compare(a, b);
  return direction === "asc" ? result : -result;
}

function escapeCsvCell(value: string) {
  const normalized = value.replace(/\r?\n/g, " ");

  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

function buildTableCsv(columns: string[], rows: TableRow[]) {
  return [columns, ...rows.map((row) => row.cells)]
    .map((cells) => cells.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\n");
}

function tableExportFilename(pageId: ConsoleRoute, tabIndex: number) {
  return `anjing-${pageId}-view-${tabIndex + 1}.csv`;
}

const routeHash: Record<ConsoleRoute, string> = {
  home: "#/console/home",
  overview: "#/console/overview",
  iam: "#/console/iam",
  gateway: "#/console/gateway",
  quota: "#/console/quota",
  docs: "#/console/docs",
};

const moduleWorkflows: Record<Exclude<ConsoleRoute, "home">, WorkflowStep[]> = {
  overview: [
    { label: "观察", note: "看整体水位", tab: "运营总览" },
    { label: "分诊", note: "定位服务健康", tab: "服务健康" },
    { label: "复盘", note: "追踪调用与审计", tab: "调用与审计" },
  ],
  iam: [
    { label: "邀请", note: "创建用户主体", tab: "用户" },
    { label: "授权", note: "定义角色权限", tab: "角色权限" },
    { label: "签发", note: "发放 API Key", tab: "API Key" },
    { label: "加固", note: "管理凭据引用", tab: "凭据" },
  ],
  gateway: [
    { label: "路由", note: "配置 API 入口", tab: "API 路由" },
    { label: "模型", note: "设置模型策略", tab: "模型路由" },
    { label: "Skill", note: "治理 Skill 调用", tab: "Skill 调用" },
    { label: "审计", note: "查看请求日志", tab: "请求日志" },
  ],
  quota: [
    { label: "套餐", note: "定义套餐配额", tab: "套餐" },
    { label: "账单", note: "汇总成本水位", tab: "账单汇总" },
    { label: "用量", note: "追踪项目用量", tab: "用量" },
    { label: "预算", note: "处理预算告警", tab: "预算告警" },
  ],
  docs: [
    { label: "Guides", note: "创建接入应用", tab: "Guides" },
    { label: "API", note: "复制最小调用", tab: "API Examples" },
    { label: "部署", note: "确认本地与镜像", tab: "Deployment" },
    { label: "排障", note: "按症状处理", tab: "Troubleshooting" },
  ],
};

function parseRoute(): ConsoleRoute | "landing" {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [, route] = hash.split("/");

  if (!hash || hash === "/") {
    return "landing";
  }

  if (route && route in routeHash) {
    return route as ConsoleRoute;
  }

  return "home";
}

function useInitialFocus<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      ref.current?.focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [enabled]);

  return ref;
}

function actionErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function App() {
  const [route, setRoute] = useState<ConsoleRoute | "landing">(parseRoute);
  const [role, setRole] = useState<RoleId>("admin");
  const [snapshot, setSnapshot] = useState<PlatformSnapshot>();
  const [apiState, setApiState] = useState<ApiState>("loading");
  const [apiDetail, setApiDetail] = useState("正在连接 Go API");
  const [apiIssue, setApiIssue] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState("");
  const [refreshingSnapshot, setRefreshingSnapshot] = useState(false);
  const [actionMode, setActionMode] = useState<ActionMode | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [confirmIntent, setConfirmIntent] = useState<ConfirmIntent | null>(null);
  const [confirmError, setConfirmError] = useState("");
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [activatingUserId, setActivatingUserId] = useState("");
  const [activatingApplicationId, setActivatingApplicationId] = useState("");
  const [rotatingApplicationId, setRotatingApplicationId] = useState("");
  const [publishingRouteId, setPublishingRouteId] = useState("");
  const [publishingModelRouteId, setPublishingModelRouteId] = useState("");
  const [publishingSkillId, setPublishingSkillId] = useState("");
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [selectedModelRouteId, setSelectedModelRouteId] = useState("");
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [activatingPlanId, setActivatingPlanId] = useState("");
  const [resolvingBudgetAlertId, setResolvingBudgetAlertId] = useState("");
  const [selectedBudgetAlertId, setSelectedBudgetAlertId] = useState("");
  const [rotatingCredentialId, setRotatingCredentialId] = useState("");
  const [revokingAPIKeyId, setRevokingAPIKeyId] = useState("");
  const [selectedAPIKeyId, setSelectedAPIKeyId] = useState("");
  const [selectedCredentialId, setSelectedCredentialId] = useState("");
  const [resolvingTodoId, setResolvingTodoId] = useState("");
  const [selectedApplicationId, setSelectedApplicationId] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const visibleItems = useMemo(
    () => visibleNavItems(role),
    [role],
  );

  const refreshSnapshot = useCallback(async () => {
    const result = await loadPlatformSnapshot(role);

    if (result.ok) {
      setSnapshot(result.snapshot);
      setApiState("live");
      setApiDetail(result.source === "aggregate" ? "聚合快照 · ops-api" : `分组接口 · ${result.loaded} 个接口已连接`);
      setApiIssue("");
    } else {
      setApiState("fallback");
      setApiDetail("本地演示数据 · 后端未连接");
      setApiIssue("无法连接 Go 后端 API，当前展示本地演示数据。启动 pnpm dev:api 后可重新同步。");
    }

    setLastSyncedAt(formatSyncTime(new Date()));

    return result;
  }, [role]);

  async function handleManualRefresh() {
    setRefreshingSnapshot(true);
    setApiState("loading");
    setApiDetail("正在刷新平台数据");
    setApiIssue("");

    try {
      const result = await refreshSnapshot();
      setNotice(result.ok ? "平台数据已刷新。" : "后端未连接，已切换到本地演示数据。");
    } catch {
      setApiState("fallback");
      setApiDetail("刷新失败 · 本地演示数据");
      setApiIssue("刷新请求失败，当前保留本地演示数据。请确认 pnpm dev:api 正在运行后重试。");
      setLastSyncedAt(formatSyncTime(new Date()));
      setNotice("刷新失败，已保留本地演示数据。");
    } finally {
      setRefreshingSnapshot(false);
    }
  }

  useEffect(() => {
    let active = true;

    refreshSnapshot()
      .then((result) => {
        if (!active) {
          return;
        }

        setApiState(result.ok ? "live" : "fallback");
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setApiState("fallback");
        setApiDetail("本地演示数据 · 后端未连接");
        setApiIssue("无法连接 Go 后端 API，当前展示本地演示数据。启动 pnpm dev:api 后可重新同步。");
      });

    return () => {
      active = false;
    };
  }, [refreshSnapshot]);

  useEffect(() => {
    if (route === "landing") {
      return;
    }

    if (!canAccessRoute(role, route)) {
      window.location.hash = routeHash.home;
    }
  }, [role, route]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => {
      setNotice("");
    }, 4500);

    return () => window.clearTimeout(timer);
  }, [notice]);

  if (route === "landing") {
    return <LandingPage />;
  }

  const activeRoute = route;
  const hydratedPages = hydrateModulePages(modulePages, snapshot);
  const activePage = hydratedPages.find((page) => page.id === activeRoute);

  async function handleModuleAction(pageId: ConsoleRoute) {
    setNotice("");
    setActionError("");

    if (!canRunPrimaryAction(role, pageId)) {
      setNotice(primaryActionHint(role, pageId));
      return;
    }

    if (pageId === "overview") {
      const pendingTodo = snapshot?.dashboard?.todos.find((todo) => todo.status !== "Resolved");
      if (!pendingTodo) {
        setNotice("当前没有待处理事项。");
        return;
      }
      await handleTodoResolve(pendingTodo);
      return;
    }

    if (pageId === "iam" || pageId === "gateway" || pageId === "quota") {
      setActionMode(pageId);
      return;
    }

    if (pageId === "docs") {
      setActionMode(pageId);
      return;
    }
  }

  async function handleActionSubmit(values: ActionValues) {
    if (!actionMode) {
      return;
    }

    setActionBusy(true);
    setActionError("");

    try {
      if (actionMode === "iam") {
        await createUser(
          {
            email: values.email,
            org: values.org,
            role: values.role,
          },
          role,
        );
        setNotice(`已邀请用户：${values.email}`);
      }

      if (actionMode === "gateway") {
        const route = await createRoute(
          {
            route: values.route,
            strategy: "ordered",
            upstream: values.upstream,
            limit: values.limit,
          },
          role,
        );
        setSelectedRouteId(route.id);
        setNotice(`已创建路由：${route.route}`);
      }

      if (actionMode === "quota") {
        const plan = await createPlan(
          {
            name: values.name,
            rps: values.rps,
            tokenPerDay: values.tokenPerDay,
          },
          role,
        );
        setSelectedPlanId(plan.id);
        setNotice(`已创建套餐：${plan.name}`);
      }

      if (actionMode === "docs") {
        const application = await createApplication(
          {
            name: values.name,
            owner: values.owner,
            environment: values.environment,
            defaultRoute: values.defaultRoute,
            plan: values.plan,
          },
          role,
        );
        setSelectedApplicationId(application.id);
        setNotice(`已创建接入应用：${application.name}`);
      }

      setActionMode(null);
      await refreshSnapshot();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "操作失败");
    } finally {
      setActionBusy(false);
    }
  }

  function openConfirm(intent: ConfirmIntent) {
    setNotice("");
    setConfirmError("");
    setConfirmIntent(intent);
  }

  async function executeConfirmedAction() {
    if (!confirmIntent) {
      return;
    }

    setConfirmBusy(true);
    setConfirmError("");

    try {
      if (confirmIntent.type === "application-key-rotate") {
        await runApplicationKeyRotate(confirmIntent.id);
      }

      if (confirmIntent.type === "route-publish") {
        await runRoutePublish(confirmIntent.id);
      }

      if (confirmIntent.type === "model-route-publish") {
        await runModelRoutePublish(confirmIntent.id);
      }

      if (confirmIntent.type === "skill-binding-publish") {
        await runSkillBindingPublish(confirmIntent.id);
      }

      if (confirmIntent.type === "plan-activate") {
        await runPlanActivate(confirmIntent.id);
      }

      if (confirmIntent.type === "budget-alert-resolve") {
        await runBudgetAlertResolve(confirmIntent.id);
      }

      if (confirmIntent.type === "credential-rotate") {
        await runCredentialRotate(confirmIntent.id);
      }

      if (confirmIntent.type === "api-key-revoke") {
        await runAPIKeyRevoke(confirmIntent.id);
      }

      setConfirmIntent(null);
    } catch (error) {
      setConfirmError(actionErrorMessage(error, confirmIntent.fallbackError));
    } finally {
      setConfirmBusy(false);
    }
  }

  async function handleUserActivate(id: string) {
    setNotice("");
    setActivatingUserId(id);

    try {
      const user = await activateUser(id, role);
      await refreshSnapshot();
      setNotice(`已激活用户：${user.email}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "用户激活失败");
    } finally {
      setActivatingUserId("");
    }
  }

  async function handleApplicationActivate(id: string) {
    setNotice("");
    setActivatingApplicationId(id);

    try {
      const application = await activateApplication(id, role);
      await refreshSnapshot();
      setSelectedApplicationId(application.id);
      setNotice(`已完成接入校验：${application.name}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "应用激活失败");
    } finally {
      setActivatingApplicationId("");
    }
  }

  async function handleApplicationKeyRotate(id: string) {
    const application = snapshot?.applications?.find((item) => item.id === id);

    openConfirm({
      confirmLabel: "确认轮换",
      description: `确认轮换 ${application?.name || "该应用"} 的接入 API Key。`,
      details: [
        `负责人：${application?.owner || "以后端记录为准"}`,
        `环境：${application?.environment || "以后端记录为准"}`,
        `默认路由：${application?.defaultRoute || "以后端记录为准"}`,
      ],
      fallbackError: "API Key 轮换失败",
      id,
      recovery: "失败时会保留当前 API Key 状态；请确认 Go API 在线、权限有效后重试。",
      title: "轮换应用 API Key",
      tone: "warning",
      type: "application-key-rotate",
    });
  }

  async function runApplicationKeyRotate(id: string) {
    setNotice("");
    setRotatingApplicationId(id);

    try {
      const application = await rotateApplicationKey(id, role);
      await refreshSnapshot();
      setSelectedApplicationId(application.id);
      setNotice(`已轮换 API Key：${application.name}`);
    } catch (error) {
      const message = actionErrorMessage(error, "API Key 轮换失败");
      setNotice(message);
      throw new Error(message);
    } finally {
      setRotatingApplicationId("");
    }
  }

  async function handleRoutePublish(id: string) {
    const route = snapshot?.routes?.find((item) => item.id === id);

    openConfirm({
      confirmLabel: "确认发布",
      description: `确认发布 ${route?.route || "该 API 路由"} 到统一网关入口。`,
      details: [
        `上游目标：${route?.upstream || "以后端记录为准"}`,
        `负载策略：${formatGatewayRouteStrategy(route?.strategy)}`,
        route?.canaryHeader
          ? `灰度规则：${route.canaryHeader}${route.canaryValue ? `=${route.canaryValue}` : " 非空"} -> ${
              route.canaryUpstream || "以后端记录为准"
            }`
          : "灰度规则：未启用",
        `鉴权策略：${route?.auth || "以后端记录为准"}`,
        `限流策略：${route?.limit || "以后端记录为准"}`,
      ],
      fallbackError: "路由发布失败",
      id,
      recovery: "失败时会保留当前路由状态；请检查上游配置、角色权限和 Go API 连接后重试。",
      title: "发布 API 路由",
      tone: "warning",
      type: "route-publish",
    });
  }

  async function runRoutePublish(id: string) {
    setNotice("");
    setPublishingRouteId(id);

    try {
      const route = await publishRoute(id, role);
      await refreshSnapshot();
      setSelectedRouteId(route.id);
      setNotice(`已发布路由：${route.route}`);
    } catch (error) {
      const message = actionErrorMessage(error, "路由发布失败");
      setNotice(message);
      throw new Error(message);
    } finally {
      setPublishingRouteId("");
    }
  }

  async function handleModelRouteCreate(input: CreateModelRouteInput) {
    setNotice("");

    try {
      const modelRoute = await createModelRoute(input, role);
      await refreshSnapshot();
      setSelectedModelRouteId(modelRoute.id);
      setNotice(`已创建模型路由：${modelRoute.alias}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "模型路由创建失败");
    }
  }

  async function handleModelRoutePublish(id: string) {
    const modelRoute = snapshot?.modelRoutes?.find((item) => item.id === id);

    openConfirm({
      confirmLabel: "确认发布",
      description: `确认发布模型路由 ${modelRoute?.alias || "该模型路由"}。`,
      details: [
        `场景：${modelRoute?.scenario || "以后端记录为准"}`,
        `主模型：${modelRoute?.primary || "以后端记录为准"}`,
        `兜底模型：${modelRoute?.fallback || "以后端记录为准"}`,
      ],
      fallbackError: "模型路由发布失败",
      id,
      recovery: "失败时不会切换当前模型路由；请确认供应商配置、Key 池和网关连接后重试。",
      title: "发布模型路由",
      tone: "warning",
      type: "model-route-publish",
    });
  }

  async function runModelRoutePublish(id: string) {
    setNotice("");
    setPublishingModelRouteId(id);

    try {
      const modelRoute = await publishModelRoute(id, role);
      await refreshSnapshot();
      setSelectedModelRouteId(modelRoute.id);
      setNotice(`已发布模型路由：${modelRoute.alias}`);
    } catch (error) {
      const message = actionErrorMessage(error, "模型路由发布失败");
      setNotice(message);
      throw new Error(message);
    } finally {
      setPublishingModelRouteId("");
    }
  }

  async function handleSkillBindingCreate(input: CreateSkillBindingInput) {
    setNotice("");

    try {
      const skill = await createSkillBinding(input, role);
      await refreshSnapshot();
      setSelectedSkillId(skill.id);
      setNotice(`已创建 Skill 绑定：${skill.name}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Skill 绑定创建失败");
    }
  }

  async function handleSkillBindingPublish(id: string) {
    const skill = snapshot?.skills?.find((item) => item.id === id);

    openConfirm({
      confirmLabel: "确认发布",
      description: `确认发布 Skill 绑定 ${skill?.name || "该 Skill"}。`,
      details: [
        `协议：${skill?.protocol || "以后端记录为准"}`,
        `调用路由：${skill?.route || "以后端记录为准"}`,
        `超时：${skill?.timeout || "以后端记录为准"}`,
      ],
      fallbackError: "Skill 绑定发布失败",
      id,
      recovery: "失败时会保留当前 Skill 绑定状态；请检查协议适配、路由配置和权限后重试。",
      title: "发布 Skill 绑定",
      tone: "warning",
      type: "skill-binding-publish",
    });
  }

  async function runSkillBindingPublish(id: string) {
    setNotice("");
    setPublishingSkillId(id);

    try {
      const skill = await publishSkillBinding(id, role);
      await refreshSnapshot();
      setSelectedSkillId(skill.id);
      setNotice(`已发布 Skill 绑定：${skill.name}`);
    } catch (error) {
      const message = actionErrorMessage(error, "Skill 绑定发布失败");
      setNotice(message);
      throw new Error(message);
    } finally {
      setPublishingSkillId("");
    }
  }

  async function handleTodoResolve(todo: { id: string; title: string; status?: string }) {
    setNotice("");

    if (todo.status === "Resolved") {
      setNotice(`已处理：${todo.title}`);
      return;
    }

    if (role !== "admin" && role !== "operator") {
      setNotice("当前角色只能查看运营事项，处理动作需要管理员或运维人员。");
      return;
    }

    setResolvingTodoId(todo.id);

    try {
      const resolved = await resolveTodo(todo.id, role);
      await refreshSnapshot();
      setNotice(`已处理：${resolved.title}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "事项处理失败");
    } finally {
      setResolvingTodoId("");
    }
  }

  async function handlePlanActivate(id: string) {
    const plan = snapshot?.plans?.find((item) => item.id === id);

    openConfirm({
      confirmLabel: "确认启用",
      description: `确认启用套餐 ${plan?.name || "该套餐"}。`,
      details: [
        `目标范围：${plan?.target || "以后端记录为准"}`,
        `RPS：${plan?.rps || "以后端记录为准"}`,
        `每日 Token：${plan?.tokenPerDay || "以后端记录为准"}`,
      ],
      fallbackError: "套餐启用失败",
      id,
      recovery: "失败时不会切换当前套餐状态；请确认计费服务连接、权限和配额字段后重试。",
      title: "启用计费套餐",
      tone: "warning",
      type: "plan-activate",
    });
  }

  async function runPlanActivate(id: string) {
    setNotice("");
    setActivatingPlanId(id);

    try {
      const plan = await activatePlan(id, role);
      await refreshSnapshot();
      setSelectedPlanId(plan.id);
      setNotice(`已启用套餐：${plan.name}`);
    } catch (error) {
      const message = actionErrorMessage(error, "套餐启用失败");
      setNotice(message);
      throw new Error(message);
    } finally {
      setActivatingPlanId("");
    }
  }

  async function handleBudgetAlertResolve(id: string) {
    const alert = snapshot?.budgetAlerts?.find((item) => item.id === id);

    openConfirm({
      confirmLabel: "确认处理",
      description: `确认将 ${alert?.project || "该项目"} 的预算告警标记为已处理。`,
      details: [
        `预算：${alert?.budget || "以后端记录为准"}`,
        `当前用量：${alert?.current || "以后端记录为准"}`,
        `阈值：${alert?.threshold || "以后端记录为准"}`,
      ],
      fallbackError: "预算告警处理失败",
      id,
      recovery: "失败时告警会保持未处理状态；请确认计费服务在线后重新处理。",
      title: "处理预算告警",
      type: "budget-alert-resolve",
    });
  }

  async function runBudgetAlertResolve(id: string) {
    setNotice("");
    setResolvingBudgetAlertId(id);

    try {
      const alert = await resolveBudgetAlert(id, role);
      await refreshSnapshot();
      setSelectedBudgetAlertId(alert.id);
      setNotice(`已处理预算告警：${alert.project}`);
    } catch (error) {
      const message = actionErrorMessage(error, "预算告警处理失败");
      setNotice(message);
      throw new Error(message);
    } finally {
      setResolvingBudgetAlertId("");
    }
  }

  async function handleCredentialRotate(id: string) {
    const credential = snapshot?.credentials?.find((item) => item.id === id);

    openConfirm({
      confirmLabel: "确认轮换",
      description: `确认轮换凭据引用 ${credential?.ref || "该凭据"}。`,
      details: [
        `用途：${credential?.purpose || "以后端记录为准"}`,
        `绑定范围：${credential?.scope || "以后端记录为准"}`,
        `到期时间：${credential?.expiresAt || "以后端记录为准"}`,
      ],
      fallbackError: "凭据轮换失败",
      id,
      recovery: "失败时原凭据引用会保留；请确认供应商 Key、权限和审计链路后重试。",
      title: "轮换凭据引用",
      tone: "warning",
      type: "credential-rotate",
    });
  }

  async function runCredentialRotate(id: string) {
    setNotice("");
    setRotatingCredentialId(id);

    try {
      const credential = await rotateCredential(id, role);
      await refreshSnapshot();
      setSelectedCredentialId(credential.id);
      setNotice(`已轮换凭据：${credential.ref}`);
    } catch (error) {
      const message = actionErrorMessage(error, "凭据轮换失败");
      setNotice(message);
      throw new Error(message);
    } finally {
      setRotatingCredentialId("");
    }
  }

  async function handleAPIKeyRevoke(id: string) {
    const apiKey = snapshot?.apiKeys?.find((item) => item.id === id);

    openConfirm({
      confirmLabel: "确认撤销",
      description: `确认撤销 API Key ${apiKey?.name || "该密钥"}。`,
      details: [
        `项目：${apiKey?.project || "以后端记录为准"}`,
        `授权范围：${apiKey?.scope || "以后端记录为准"}`,
        `到期时间：${apiKey?.expiresAt || "以后端记录为准"}`,
      ],
      fallbackError: "API Key 撤销失败",
      id,
      recovery: "失败时 API Key 会保持当前状态；如调用已受影响，请查看审计日志并重试。",
      title: "撤销 API Key",
      tone: "danger",
      type: "api-key-revoke",
    });
  }

  async function runAPIKeyRevoke(id: string) {
    setNotice("");
    setRevokingAPIKeyId(id);

    try {
      const key = await revokeAPIKey(id, role);
      await refreshSnapshot();
      setSelectedAPIKeyId(key.id);
      setNotice(`已撤销 API Key：${key.name}`);
    } catch (error) {
      const message = actionErrorMessage(error, "API Key 撤销失败");
      setNotice(message);
      throw new Error(message);
    } finally {
      setRevokingAPIKeyId("");
    }
  }

  return (
    <>
      <ConsoleShell
        apiDetail={apiDetail}
        apiIssue={apiIssue}
        apiState={apiState}
        activeRoute={activeRoute}
        lastSyncedAt={lastSyncedAt}
        onRefresh={() => void handleManualRefresh()}
        refreshing={refreshingSnapshot}
        role={role}
        setRole={setRole}
        visibleItems={visibleItems}
      >
        {activeRoute === "home" ? (
          <ConsoleHome
            metrics={hydrateHomeMetrics(snapshot)}
            notice={notice}
            onTodoResolve={handleTodoResolve}
            role={role}
            resolvingTodoId={resolvingTodoId}
            snapshot={snapshot}
            visibleItems={visibleItems}
          />
        ) : null}
        {activePage ? (
          <ModulePage
            notice={notice}
            onAPIKeyRevoke={handleAPIKeyRevoke}
            onApplicationActivate={handleApplicationActivate}
            onApplicationKeyRotate={handleApplicationKeyRotate}
            onCredentialRotate={handleCredentialRotate}
            onLLMInvoked={refreshSnapshot}
            onModelRouteCreate={handleModelRouteCreate}
            onModelRoutePublish={handleModelRoutePublish}
            onBudgetAlertResolve={handleBudgetAlertResolve}
            onPlanActivate={handlePlanActivate}
            onRoutePublish={handleRoutePublish}
            onSkillBindingCreate={handleSkillBindingCreate}
            onSkillBindingPublish={handleSkillBindingPublish}
            onUserActivate={handleUserActivate}
            activatingApplicationId={activatingApplicationId}
            activatingPlanId={activatingPlanId}
            activatingUserId={activatingUserId}
            onPrimaryAction={handleModuleAction}
            page={activePage}
            publishingModelRouteId={publishingModelRouteId}
            publishingRouteId={publishingRouteId}
            publishingSkillId={publishingSkillId}
            resolvingBudgetAlertId={resolvingBudgetAlertId}
            role={role}
            revokingAPIKeyId={revokingAPIKeyId}
            rotatingCredentialId={rotatingCredentialId}
            rotatingApplicationId={rotatingApplicationId}
            selectedApplicationId={selectedApplicationId}
            selectedAPIKeyId={selectedAPIKeyId}
            selectedBudgetAlertId={selectedBudgetAlertId}
            selectedCredentialId={selectedCredentialId}
            selectedModelRouteId={selectedModelRouteId}
            selectedPlanId={selectedPlanId}
            selectedRouteId={selectedRouteId}
            selectedSkillId={selectedSkillId}
            snapshot={snapshot}
          />
        ) : null}
      </ConsoleShell>

      {actionMode ? (
        <ActionDialog
          busy={actionBusy}
          error={actionError}
          mode={actionMode}
          onClose={() => setActionMode(null)}
          onSubmit={handleActionSubmit}
        />
      ) : null}
      {confirmIntent ? (
        <ConfirmDialog
          busy={confirmBusy}
          copy={confirmIntent}
          error={confirmError}
          onCancel={() => setConfirmIntent(null)}
          onConfirm={executeConfirmedAction}
        />
      ) : null}
    </>
  );
}

function LandingPage() {
  return (
    <main className="landing">
      <header className="landing__nav" aria-label="页面导航">
        <a className="brand" href="#">
          <span>anjing</span>
          <strong>AI Infra</strong>
        </a>
        <nav>
          <a href="#/console/home">Console</a>
          <a href="https://github.com/anjing-le/anjing-ai-platform">GitHub</a>
        </nav>
      </header>

      <section className="landing__hero" aria-labelledby="landing-title">
        <div className="landing__signal" aria-hidden="true">
          <span>Gateway</span>
          <span>IAM</span>
          <span>LLM</span>
          <span>Skill</span>
          <span>审计</span>
        </div>
        <p className="eyebrow">面向 AI 应用的开源基础设施</p>
        <h1 id="landing-title">Anjing AI Infra Platform</h1>
        <p>
          面向 AI 应用、Agent、内部工具和业务系统的基础设施底座。V1 采用
          DVSkyFolding 风格：React 统一大前端、Go 服务边界、PostgreSQL 数据底座。
        </p>
        <div className="landing__actions">
          <a className="button button--primary" href="#/console/home">
            进入控制台
            <ArrowRight size={16} />
          </a>
          <a className="button" href="https://github.com/anjing-le/anjing-ai-platform">
            查看仓库
          </a>
        </div>
      </section>

      <section className="landing__architecture" aria-labelledby="architecture-title">
        <div>
          <p className="eyebrow">Architecture</p>
          <h2 id="architecture-title">模块化单体先跑通，再按真实边界拆服务</h2>
        </div>
        <div className="architecture-grid">
          {navItems
            .filter((item) => item.id !== "home")
            .map((item) => (
              <a aria-label={`查看${item.label}架构模块`} className="architecture-card" href={routeHash[item.id]} key={item.id}>
                <item.icon aria-hidden="true" size={20} />
                <strong>{item.label}</strong>
                <p>{item.summary}</p>
                <span>{item.tags.join(" / ")}</span>
              </a>
            ))}
        </div>
      </section>
    </main>
  );
}

interface ConsoleShellProps {
  activeRoute: ConsoleRoute;
  apiDetail: string;
  apiIssue: string;
  apiState: ApiState;
  children: React.ReactNode;
  lastSyncedAt: string;
  onRefresh: () => void;
  refreshing: boolean;
  role: RoleId;
  setRole: (role: RoleId) => void;
  visibleItems: NavItem[];
}

function ConsoleShell({
  activeRoute,
  apiDetail,
  apiIssue,
  apiState,
  children,
  lastSyncedAt,
  onRefresh,
  refreshing,
  role,
  setRole,
  visibleItems,
}: ConsoleShellProps) {
  const activeItem = navItems.find((item) => item.id === activeRoute) || navItems[0];
  const activeRole = roles.find((item) => item.id === role) || roles[0];

  return (
    <div className="console-shell">
      <aside className="sidebar">
        <a className="sidebar__brand" href={routeHash.home}>
          <span>Anjing</span>
          <strong>AI Platform</strong>
        </a>
        <nav className="sidebar__nav" aria-label="后台模块">
          {visibleItems.map((item) => (
            <a
              aria-current={item.id === activeRoute ? "page" : undefined}
              aria-label={`打开${item.label}`}
              className={item.id === activeRoute ? "sidebar__link is-active" : "sidebar__link"}
              href={routeHash[item.id]}
              key={item.id}
            >
              <item.icon aria-hidden="true" size={17} />
              <span>
                <small>{item.name}</small>
                <strong>{item.label}</strong>
              </span>
            </a>
          ))}
        </nav>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{activeRole.label}视角</p>
            <h1>{activeItem.label}</h1>
            <p className="topbar__role-purpose">{activeRole.purpose}</p>
          </div>
          <div className="topbar__actions">
            <APIStateBadge detail={apiDetail} lastSyncedAt={lastSyncedAt} state={apiState} />
            <button
              aria-label={refreshing ? "正在刷新平台数据" : "刷新平台数据"}
              aria-live="polite"
              className="icon-command"
              disabled={refreshing}
              onClick={onRefresh}
              title="刷新平台数据"
              type="button"
            >
              <RefreshCw aria-hidden="true" size={16} />
              <span>{refreshing ? "刷新中" : "刷新"}</span>
            </button>
            <div className="role-switcher" aria-label="角色视角">
              {roles.map((item) => (
                <button
                  aria-label={`${item.label}视角：${item.purpose}，${item.id === role ? "当前选中" : "可切换"}`}
                  aria-pressed={item.id === role}
                  className={item.id === role ? "is-active" : ""}
                  key={item.id}
                  onClick={() => setRole(item.id)}
                  type="button"
                  title={item.purpose}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </header>
        {apiIssue || apiState === "loading" ? (
          <DataSyncBanner
            issue={apiIssue}
            loading={refreshing || apiState === "loading"}
            onRetry={onRefresh}
            state={apiState}
          />
        ) : null}
        {children}
      </div>
    </div>
  );
}

function DataSyncBanner({
  issue,
  loading,
  onRetry,
  state,
}: {
  issue: string;
  loading: boolean;
  onRetry: () => void;
  state: ApiState;
}) {
  const title = state === "loading" ? "正在同步平台数据" : "后端连接需要确认";
  const description = issue || "正在读取 Go 后端数据，页面会先保留当前可用内容。";
  const retryLabel = loading ? "同步中" : "重试同步";

  return (
    <section
      aria-label={`${title}：${description}`}
      aria-live="polite"
      className={`sync-banner sync-banner--${state}`}
      role="status"
    >
      <span aria-hidden="true" className="sync-banner__icon">
        <RefreshCw className={loading ? "is-spinning" : undefined} size={16} />
      </span>
      <div className="sync-banner__copy">
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <button
        aria-label={loading ? "正在重试同步平台数据" : "重试同步平台数据"}
        className="text-command sync-banner__action"
        disabled={loading}
        onClick={onRetry}
        type="button"
      >
        <RefreshCw aria-hidden="true" className={loading ? "is-spinning" : undefined} size={14} />
        <span>{retryLabel}</span>
      </button>
    </section>
  );
}

function APIStateBadge({ detail, lastSyncedAt, state }: { detail: string; lastSyncedAt: string; state: ApiState }) {
  const label = state === "live" ? "实时 API" : state === "loading" ? "连接中" : "本地演示";
  const note =
    state === "live"
      ? detail
      : state === "loading"
        ? "正在读取平台数据"
        : `${detail} · 使用本地演示数据`;
  const syncLabel = lastSyncedAt ? `最近同步 ${lastSyncedAt}` : "等待首次同步";

  return (
    <span
      aria-label={`数据来源：${label}，${note}，${syncLabel}`}
      aria-live="polite"
      className={`api-state api-state--${state}`}
      title={note}
    >
      <strong>{label}</strong>
      <small>{note}</small>
      <small className="api-state__sync">{syncLabel}</small>
    </span>
  );
}

function RoleAccessMatrix({ activeRole, modules }: { activeRole: RoleId; modules: NavItem[] }) {
  return (
    <div className="role-access-matrix" aria-label="角色可见矩阵">
      <div className="role-access-matrix__head">
        <span>Module</span>
        {roles.map((item) => (
          <span className={item.id === activeRole ? "is-active" : ""} key={item.id}>
            {item.label}
          </span>
        ))}
      </div>
      {modules.map((module) => {
        const activeAllowed = module.roles.includes(activeRole);
        const visibleRoleLabels = module.roles
          .map((roleId) => roles.find((item) => item.id === roleId)?.label || roleId)
          .join(" / ");

        return (
          <div
            aria-label={`${module.label}：当前角色${activeAllowed ? "可见" : "不可见"}，可见角色 ${visibleRoleLabels}`}
            className="role-access-matrix__row"
            key={module.id}
          >
            <strong>{module.label}</strong>
            {roles.map((item) => {
              const allowed = module.roles.includes(item.id);

              return (
                <span
                  aria-label={`${item.label}${allowed ? "可见" : "不可见"}`}
                  className={`${allowed ? "is-allowed" : "is-denied"} ${item.id === activeRole ? "is-active" : ""}`}
                  key={item.id}
                  title={`${item.label}${allowed ? "可见" : "不可见"}`}
                >
                  {allowed ? "●" : "—"}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function ConsoleHome({
  metrics,
  notice,
  onTodoResolve,
  role,
  resolvingTodoId,
  snapshot,
  visibleItems,
}: {
  metrics: MetricItem[];
  notice: string;
  onTodoResolve: (todo: TodoItem) => Promise<void>;
  role: RoleId;
  resolvingTodoId: string;
  snapshot?: PlatformSnapshot;
  visibleItems: NavItem[];
}) {
  const businessItems = visibleItems.filter((item) => item.id !== "home");
  const moduleAccessItems = navItems.filter((item) => item.id !== "home");
  const [moduleQuery, setModuleQuery] = useState("");
  const normalizedModuleQuery = moduleQuery.trim().toLowerCase();
  const filteredModuleItems = normalizedModuleQuery
    ? moduleAccessItems.filter((item) =>
        [item.name, item.label, item.summary, ...item.tags].join(" ").toLowerCase().includes(normalizedModuleQuery),
      )
    : moduleAccessItems;
  const visibleModuleCount = moduleAccessItems.filter((item) => item.roles.includes(role)).length;
  const lockedModuleCount = moduleAccessItems.length - visibleModuleCount;
  const roleLabel = roles.find((item) => item.id === role)?.label || "管理员";
  const liveTodos = hydrateTodos(snapshot) || todos;
  const openTodos = liveTodos.filter((todo) => todo.status !== "Resolved");
  const visibleOpenTodos = openTodos.slice(0, 4);
  const hiddenOpenTodoCount = openTodos.length - visibleOpenTodos.length;
  const resolvedTodoCount = liveTodos.length - openTodos.length;
  const canResolveTodo = role === "admin" || role === "operator";
  const primaryMetric = metrics[0] || { label: "平台状态", value: "正常", note: "Mock 数据已接入" };
  const healthMetric = metrics.find((item) => item.label.includes("成功率")) || metrics[2] || primaryMetric;
  const pendingMetric = metrics.find((item) => item.label.includes("待")) || metrics[1] || primaryMetric;
  const firstOpenTodo = openTodos[0];
  const canViewGateway = canAccessRoute(role, "gateway");
  const workbenchActions = [
    {
      href: routeHash[firstOpenTodo?.moduleId || "overview"],
      label: firstOpenTodo ? "继续处理" : "查看运营",
      note: firstOpenTodo
        ? `${firstOpenTodo.moduleLabel} · ${displayStatus(firstOpenTodo.status)}`
        : "查看平台健康、审计和调用趋势",
      title: firstOpenTodo?.title || "运营总览",
    },
    {
      href: routeHash.docs,
      label: "开始接入",
      note: role === "user" ? "创建应用、领取 API Key、查看调用方式" : "从文档入口串联应用、密钥和示例",
      title: role === "user" ? "快速接入应用" : "配置业务入口",
    },
    {
      href: canViewGateway ? routeHash.gateway : routeHash.docs,
      label: canViewGateway ? "服务边界" : "帮助中心",
      note: canViewGateway ? "查看 API 路由、模型别名和 Skill 调用" : "查看可访问模块与排障路径",
      title: canViewGateway ? "网关与模型路由" : "接入文档",
    },
  ];
  const [runtimeCommandCopyState, setRuntimeCommandCopyState] = useState<"idle" | "success" | "error">("idle");
  const [copiedServiceCommand, setCopiedServiceCommand] = useState("");
  const [failedServiceCommand, setFailedServiceCommand] = useState("");

  async function handleRuntimeCommandCopy() {
    try {
      await navigator.clipboard.writeText("pnpm dev:api");
      setRuntimeCommandCopyState("success");
    } catch {
      setRuntimeCommandCopyState("error");
    }
    window.setTimeout(() => setRuntimeCommandCopyState("idle"), 1800);
  }

  async function handleServiceCommandCopy(command: string) {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedServiceCommand(command);
      setFailedServiceCommand("");
    } catch {
      setCopiedServiceCommand("");
      setFailedServiceCommand(command);
    }
    window.setTimeout(() => {
      setCopiedServiceCommand("");
      setFailedServiceCommand("");
    }, 1800);
  }

  const runtimeCommandCopyLabel =
    runtimeCommandCopyState === "success" ? "已复制" : runtimeCommandCopyState === "error" ? "复制失败" : "复制";

  return (
    <main className="page">
      <section className="page-heading page-heading--compact">
        <div>
          <p className="eyebrow">Console Home</p>
          <h2>后台首页</h2>
          <p>
            一屏看清平台状态、当前角色可进入的模块、需要处理的事项和后端服务边界。
          </p>
        </div>
        <a aria-label="进入帮助文档开始接入" className="button button--primary" href={routeHash.docs}>
          开始接入
          <ChevronRight aria-hidden="true" size={16} />
        </a>
      </section>

      {notice ? (
        <p aria-live="polite" className="inline-notice" role="status">
          {notice}
        </p>
      ) : null}

      <section aria-label="平台关键状态" className="home-overview-strip">
        <div>
          <span>当前视角</span>
          <strong>{roleLabel}</strong>
          <p>{businessItems.length} 个可见业务入口</p>
        </div>
        <div>
          <span>{primaryMetric.label}</span>
          <strong>{primaryMetric.value}</strong>
          <p>{primaryMetric.note}</p>
        </div>
        <div>
          <span>{pendingMetric.label}</span>
          <strong>{pendingMetric.value}</strong>
          <p>{pendingMetric.note}</p>
        </div>
        <div>
          <span>{healthMetric.label}</span>
          <strong>{healthMetric.value}</strong>
          <p>{healthMetric.note}</p>
        </div>
      </section>

      <section aria-label="后台快捷工作台" className="home-workbench">
        {workbenchActions.map((action) => (
          <a aria-label={`${action.label}：${action.title}`} className="home-workbench__item" href={action.href} key={action.label}>
            <span>{action.label}</span>
            <strong>{action.title}</strong>
            <p>{action.note}</p>
            <ChevronRight aria-hidden="true" size={16} />
          </a>
        ))}
      </section>

      <section className="home-grid">
        <Panel title="模块入口" eyebrow="Modules" className="home-grid__main">
          <div className="module-search">
            <label className="search-field">
              <Search aria-hidden="true" size={16} />
              <input
                aria-label="搜索模块、能力或入口"
                onChange={(event) => setModuleQuery(event.target.value)}
                placeholder="搜索模块、能力或入口"
                value={moduleQuery}
              />
            </label>
            {normalizedModuleQuery ? (
              <button
                aria-label={`清空模块搜索：${moduleQuery}`}
                className="text-command"
                onClick={() => setModuleQuery("")}
                type="button"
              >
                清空搜索
              </button>
            ) : null}
            <span className="module-access-count">
              {filteredModuleItems.length} / {moduleAccessItems.length} 个模块 · {visibleModuleCount} 可进入 ·{" "}
              {lockedModuleCount} 受限
            </span>
          </div>
          <div className="module-grid">
            {filteredModuleItems.map((item) => {
              const allowed = item.roles.includes(role);
              const allowedRoleLabels = item.roles
                .map((roleId) => roles.find((candidate) => candidate.id === roleId)?.label || roleId)
                .join(" / ");
              const accessLabel = allowed ? "可进入" : `需 ${allowedRoleLabels}`;
              const moduleCard = (
                <>
                  <div className="module-card__top">
                    <item.icon aria-hidden="true" size={18} />
                    <span>{item.name}</span>
                  </div>
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.summary}</p>
                  </div>
                  <div className="module-card__meta">
                    <StatusBadge tone={allowed ? "good" : "neutral"}>{accessLabel}</StatusBadge>
                    <small>{allowedRoleLabels}</small>
                  </div>
                </>
              );

              if (!allowed) {
                return (
                  <article
                    aria-disabled="true"
                    aria-label={`${item.label} 当前角色不可进入，需 ${allowedRoleLabels}`}
                    className="module-card module-card--locked"
                    key={item.id}
                  >
                    {moduleCard}
                  </article>
                );
              }

              return (
                <a aria-label={`进入${item.label}`} className="module-card" href={routeHash[item.id]} key={item.id}>
                  {moduleCard}
                </a>
              );
            })}
            {!filteredModuleItems.length ? (
              <div aria-label="没有找到模块：换一个关键词，例如网关、计费、API 或权限。" className="module-empty" role="status">
                <strong>没有找到模块</strong>
                <p>换一个关键词，例如网关、计费、API 或权限。</p>
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel title="今日待办" eyebrow="重点">
          <div className="todo-summary">
            <strong>{openTodos.length} 个待处理</strong>
            <span>{resolvedTodoCount} 个已处理</span>
          </div>
          <div className="todo-list">
            {visibleOpenTodos.map((todo) => (
              <article className="todo-item" key={todo.id}>
                <div>
                  <span>{todo.moduleLabel}</span>
                  <strong>{todo.title}</strong>
                  <p>
                    {displayStatus(todo.status)} · {todo.owner}
                  </p>
                </div>
                <StatusBadge tone={todo.tone}>{todo.status}</StatusBadge>
                <div className="todo-item__actions">
                  <a aria-label={`查看待办所属模块：${todo.title}`} href={routeHash[todo.moduleId]}>
                    查看
                  </a>
                  <button
                    aria-label={
                      canResolveTodo
                        ? `处理待办：${todo.title}`
                        : `无法处理待办：${todo.title}，需要管理员或运维人员`
                    }
                    aria-live="polite"
                    disabled={!canResolveTodo || todo.status === "Resolved" || resolvingTodoId === todo.id}
                    onClick={() => void onTodoResolve(todo)}
                    type="button"
                    title={!canResolveTodo ? "需要管理员或运维人员处理待办。" : undefined}
                  >
                    {todo.status === "Resolved" ? "已处理" : resolvingTodoId === todo.id ? "处理中" : "处理"}
                  </button>
                </div>
              </article>
            ))}
            {hiddenOpenTodoCount > 0 ? (
              <div
                aria-label={`还有 ${hiddenOpenTodoCount} 个待办未在首页展示，进入运营总览查看全部。`}
                className="todo-more"
                role="status"
              >
                <span>还有 {hiddenOpenTodoCount} 个待办</span>
                <a aria-label="进入运营总览查看全部待办" href={routeHash.overview}>
                  查看全部
                </a>
              </div>
            ) : null}
            {!openTodos.length ? (
              <div aria-label="今日待办已清空：新的告警、审批或接入校验会自动出现在这里。" className="todo-empty" role="status">
                <strong>今日待办已清空</strong>
                <p>新的告警、审批或接入校验会自动出现在这里。</p>
              </div>
            ) : null}
          </div>
        </Panel>
      </section>

      <section className="split-grid">
        <Panel title="角色权限矩阵" eyebrow="访问">
          <div className="role-summary">
            <strong>{roleLabel}</strong>
            <p>{roles.find((item) => item.id === role)?.purpose}</p>
            <span>{businessItems.length} 个可见业务入口</span>
          </div>
          <RoleAccessMatrix activeRole={role} modules={moduleAccessItems} />
        </Panel>
        <Panel title="后端服务规划" eyebrow="后端">
          <div className="service-runtime">
            <span>开发运行时</span>
            <strong>platform-all</strong>
            <p>本地一键启动完整控制台和 V1 API。</p>
            <div className="service-runtime__command">
              <code>pnpm dev:api</code>
              <button
                aria-label={`复制本地运行命令：pnpm dev:api，${runtimeCommandCopyLabel}`}
                aria-live="polite"
                className="text-command"
                onClick={() => void handleRuntimeCommandCopy()}
                type="button"
                title={runtimeCommandCopyState === "error" ? "浏览器未允许剪贴板写入，请手动复制命令。" : undefined}
              >
                <Copy aria-hidden="true" size={14} />
                {runtimeCommandCopyLabel}
              </button>
            </div>
            {runtimeCommandCopyState === "error" ? (
              <p aria-live="polite" className="service-command__hint" role="status">
                浏览器未允许剪贴板写入，请手动复制命令。
              </p>
            ) : null}
          </div>
          <div className="service-plan">
            {backendPlan.map((item) => (
              <article aria-label={`${item.label}：${item.title}，${item.note}`} key={item.label}>
                <item.icon aria-hidden="true" size={18} />
                <span>{item.label}</span>
                <strong>{item.title}</strong>
                <p>{item.note}</p>
                {"command" in item ? (
                  <div className="service-command">
                    <code>{item.command}</code>
                    <button
                      aria-label={`复制 ${item.label} 运行命令：${item.command}`}
                      aria-live="polite"
                      className="text-command"
                      onClick={() => void handleServiceCommandCopy(item.command)}
                      type="button"
                      title={
                        failedServiceCommand === item.command ? "浏览器未允许剪贴板写入，请手动复制命令。" : undefined
                      }
                    >
                      <Copy aria-hidden="true" size={14} />
                      {copiedServiceCommand === item.command
                        ? "已复制"
                        : failedServiceCommand === item.command
                          ? "复制失败"
                          : "复制"}
                    </button>
                    {failedServiceCommand === item.command ? (
                      <p aria-live="polite" className="service-command__hint" role="status">
                        浏览器未允许剪贴板写入，请手动复制命令。
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {"health" in item ? <small>{item.health}</small> : null}
              </article>
            ))}
          </div>
          <div aria-label="后台入口到服务归属" className="service-map">
            <div className="service-map__head">
              <span>入口</span>
              <span>归属服务</span>
              <span>职责范围</span>
              <span>API</span>
            </div>
            {consoleServiceMap.map((item) => (
              <div
                aria-label={`${item.entry} 由 ${item.owner} 负责，范围：${item.scope}`}
                className="service-map__row"
                key={item.entry}
              >
                <strong>{item.entry}</strong>
                <span>{item.owner}</span>
                <p>{item.scope}</p>
                <code>{item.apis.join(" · ")}</code>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </main>
  );
}

function ModulePage({
  activatingApplicationId,
  notice,
  onAPIKeyRevoke,
  onApplicationActivate,
  onApplicationKeyRotate,
  onBudgetAlertResolve,
  onCredentialRotate,
  onLLMInvoked,
  onModelRouteCreate,
  onModelRoutePublish,
  onPlanActivate,
  onPrimaryAction,
  onRoutePublish,
  onSkillBindingCreate,
  onSkillBindingPublish,
  onUserActivate,
  page,
  activatingUserId,
  activatingPlanId,
  publishingRouteId,
  publishingModelRouteId,
  publishingSkillId,
  resolvingBudgetAlertId,
  revokingAPIKeyId,
  role,
  rotatingCredentialId,
  rotatingApplicationId,
  selectedApplicationId,
  selectedAPIKeyId,
  selectedBudgetAlertId,
  selectedCredentialId,
  selectedModelRouteId,
  selectedPlanId,
  selectedRouteId,
  selectedSkillId,
  snapshot,
}: {
  activatingApplicationId: string;
  activatingUserId: string;
  notice: string;
  onAPIKeyRevoke: (id: string) => Promise<void>;
  onApplicationActivate: (id: string) => Promise<void>;
  onApplicationKeyRotate: (id: string) => Promise<void>;
  onBudgetAlertResolve: (id: string) => Promise<void>;
  onCredentialRotate: (id: string) => Promise<void>;
  onLLMInvoked: () => Promise<unknown>;
  onModelRouteCreate: (input: CreateModelRouteInput) => Promise<void>;
  onModelRoutePublish: (id: string) => Promise<void>;
  onPlanActivate: (id: string) => Promise<void>;
  onPrimaryAction: (pageId: ConsoleRoute) => Promise<void>;
  onRoutePublish: (id: string) => Promise<void>;
  onSkillBindingCreate: (input: CreateSkillBindingInput) => Promise<void>;
  onSkillBindingPublish: (id: string) => Promise<void>;
  onUserActivate: (id: string) => Promise<void>;
  activatingPlanId: string;
  page: ModulePageDefinition;
  publishingModelRouteId: string;
  publishingRouteId: string;
  publishingSkillId: string;
  resolvingBudgetAlertId: string;
  revokingAPIKeyId: string;
  role: RoleId;
  rotatingCredentialId: string;
  rotatingApplicationId: string;
  selectedApplicationId: string;
  selectedAPIKeyId: string;
  selectedBudgetAlertId: string;
  selectedCredentialId: string;
  selectedModelRouteId: string;
  selectedPlanId: string;
  selectedRouteId: string;
  selectedSkillId: string;
  snapshot?: PlatformSnapshot;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("全部状态");
  const [sort, setSort] = useState<TableSortState>({ columnIndex: 0, direction: "asc" });
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);
  const [exportState, setExportState] = useState<"idle" | "success" | "error">("idle");
  const [selectedRowId, setSelectedRowId] = useState("");
  const [activeTab, setActiveTab] = useState(page.tabs[0] || "");
  const activeTabIndex = Math.max(0, page.tabs.indexOf(activeTab));

  function focusModuleTab(index: number) {
    window.setTimeout(() => {
      document.getElementById(`module-tab-${page.id}-${index}`)?.focus();
    }, 50);
  }

  function handleModuleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const lastIndex = page.tabs.length - 1;
    let nextIndex = index;

    if (event.key === "ArrowRight") {
      nextIndex = index === lastIndex ? 0 : index + 1;
    } else if (event.key === "ArrowLeft") {
      nextIndex = index === 0 ? lastIndex : index - 1;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = lastIndex;
    } else {
      return;
    }

    event.preventDefault();
    setActiveTab(page.tabs[nextIndex] || activeTab);
    focusModuleTab(nextIndex);
  }

  useEffect(() => {
    setActiveTab(page.tabs[0] || "");
    setQuery("");
    setStatus("全部状态");
    setSort({ columnIndex: 0, direction: "asc" });
    setPageIndex(0);
    setSelectedRowId("");
  }, [page.id, page.tabs]);

  useEffect(() => {
    setQuery("");
    setStatus("全部状态");
    setSort({ columnIndex: 0, direction: "asc" });
    setPageIndex(0);
    setSelectedRowId("");
  }, [activeTab]);

  const tableView = useMemo<ModulePageDefinition["table"]>(() => {
    if (page.id === "overview" && activeTab === "服务健康") {
      return {
        eyebrow: "健康",
        title: "服务健康",
        columns: ["服务", "SLO", "P95", "状态"],
        rows: (snapshot?.dashboard?.health || []).map((service) => ({
          id: service.id,
          cells: [service.name, service.slo, service.p95, service.status],
          status: service.status,
          tone: toneForStatus(service.status),
        })),
      };
    }

    if (page.id === "overview" && activeTab === "调用与审计") {
      return {
        eyebrow: "审计",
        title: "调用与审计",
        columns: ["时间", "模块", "动作", "对象", "状态"],
        rows: (snapshot?.dashboard?.audit || []).map((event) => ({
          id: event.id,
          cells: [event.time, event.module, event.action, event.object, event.status],
          status: event.status,
          tone: toneForStatus(event.status),
        })),
      };
    }

    if (page.id === "iam" && activeTab === "角色权限") {
      return {
        eyebrow: "角色",
        title: "角色权限",
        columns: ["角色", "可见入口", "配置范围", "限制", "状态"],
        rows: (snapshot?.roles || []).map((policy) => ({
          id: policy.id,
          cells: [policy.name, policy.visibleEntries, policy.configScope, policy.restriction, policy.status],
          status: policy.status,
          tone: toneForStatus(policy.status),
        })),
      };
    }

    if (page.id === "iam" && activeTab === "API Key") {
      return {
        eyebrow: "API Key",
        title: "密钥列表",
        columns: ["密钥", "项目", "授权范围", "最近使用", "状态"],
        rows: (snapshot?.apiKeys || []).map((key) => ({
          id: key.id,
          cells: [key.maskedPreview || key.name, key.project, key.scope, key.lastUsedAt || "暂无调用", key.status],
          status: key.status,
          tone: toneForStatus(key.status),
        })),
      };
    }

    if (page.id === "iam" && activeTab === "凭据") {
      return {
        eyebrow: "凭据",
        title: "凭据引用",
        columns: ["引用", "用途", "脱敏预览", "轮换时间", "状态"],
        rows: (snapshot?.credentials || []).map((credential) => ({
          id: credential.id,
          cells: [
            credential.ref,
            credential.purpose,
            credential.maskedPreview || "未配置",
            credential.rotatedAt || "未轮换",
            credential.status,
          ],
          status: credential.status,
          tone: toneForStatus(credential.status),
        })),
      };
    }

    if (page.id === "gateway" && activeTab === "模型路由") {
      return {
        eyebrow: "模型路由",
        title: "模型路由",
        columns: ["别名", "场景", "主模型", "兜底模型", "状态"],
        rows: (snapshot?.modelRoutes || []).map((route) => ({
          id: route.id,
          cells: [route.alias, route.scenario, route.primary, route.fallback, route.status],
          status: route.status,
          tone: toneForStatus(route.status),
        })),
      };
    }

    if (page.id === "gateway" && activeTab === "Skill 调用") {
      return {
        eyebrow: "Skill",
        title: "Skill 绑定",
        columns: ["名称", "协议", "路由", "超时", "状态"],
        rows: (snapshot?.skills || []).map((skill) => ({
          id: skill.id,
          cells: [skill.name, skill.protocol, skill.route, skill.timeout, skill.status],
          status: skill.status,
          tone: toneForStatus(skill.status),
        })),
      };
    }

    if (page.id === "gateway" && activeTab === "请求日志") {
      return {
        eyebrow: "请求日志",
        title: "请求日志",
        columns: ["请求", "调用方", "延迟", "结果", "状态"],
        rows: (snapshot?.requestLogs || []).map((log) => ({
          id: log.id,
          cells: [log.request, log.consumer, log.latency, log.result, log.status],
          status: log.status,
          tone: toneForStatus(log.status),
        })),
      };
    }

    if (page.id === "quota" && activeTab === "账单汇总") {
      return {
        eyebrow: "账单",
        title: "账单汇总",
        columns: ["项目", "周期", "Token", "成本", "预算", "使用率", "状态"],
        rows: (snapshot?.billingSummaries || []).map((invoice) => ({
          id: invoice.id,
          cells: [
            invoice.project,
            invoice.period,
            invoice.tokens,
            invoice.cost,
            invoice.budget,
            invoice.utilization,
            invoice.status,
          ],
          status: invoice.status,
          tone: toneForStatus(invoice.status),
        })),
      };
    }

    if (page.id === "quota" && activeTab === "用量") {
      return {
        eyebrow: "用量",
        title: "项目用量",
        columns: ["项目", "Token 用量", "Skill 调用", "成本", "状态"],
        rows: (snapshot?.usage || []).map((usage) => ({
          id: usage.id,
          cells: [usage.project, usage.tokens, usage.skillCalls, usage.cost, usage.status],
          status: usage.status,
          tone: toneForStatus(usage.status),
        })),
      };
    }

    if (page.id === "quota" && activeTab === "预算告警") {
      return {
        eyebrow: "预算",
        title: "预算告警",
        columns: ["项目", "预算", "当前用量", "阈值", "状态"],
        rows: (snapshot?.budgetAlerts || []).map((alert) => ({
          id: alert.id,
          cells: [alert.project, alert.budget, alert.current, alert.threshold, alert.status],
          status: alert.status,
          tone: toneForStatus(alert.status),
        })),
      };
    }

    if (page.id === "docs" && activeTab === "API Examples") {
      const routeRows: TableRow[] = (snapshot?.routes || []).map((route) => ({
        id: `doc-route-${route.id}`,
        cells: [
          route.route,
          "Gateway route",
          route.auth,
          `${formatGatewayRouteStrategy(route.strategy)} · ${route.limit}`,
          route.status,
        ],
        status: route.status,
        tone: toneForStatus(route.status),
      }));
      const modelRows: TableRow[] = (snapshot?.modelRoutes || []).map((route) => ({
        id: `doc-model-${route.id}`,
        cells: [route.alias, "Model route", "API Key", `${route.primary} -> ${route.fallback}`, route.status],
        status: route.status,
        tone: toneForStatus(route.status),
      }));
      const skillRows: TableRow[] = (snapshot?.skills || []).map((skill) => ({
        id: `doc-skill-${skill.id}`,
        cells: [skill.route, `Skill ${skill.protocol}`, "API Key + RBAC", `${skill.name} · ${skill.timeout}`, skill.status],
        status: skill.status,
        tone: toneForStatus(skill.status),
      }));

      return {
        eyebrow: "API Examples",
        title: "调用示例",
        columns: ["入口", "类型", "认证", "请求要点", "状态"],
        rows: [...routeRows, ...modelRows, ...skillRows],
      };
    }

    if (page.id === "docs" && activeTab === "Deployment") {
      return {
        eyebrow: "Deployment",
        title: "部署说明",
        columns: ["组件", "启动命令", "健康检查", "职责", "状态"],
        rows: backendPlan.map((item) => ({
          id: `deploy-${item.label}`,
          cells: [item.label, item.command, item.health, item.title, "已就绪"],
          status: "已就绪",
          tone: "good",
        })),
      };
    }

    if (page.id === "docs" && activeTab === "Troubleshooting") {
      return {
        eyebrow: "Troubleshooting",
        title: "排障路径",
        columns: ["症状", "处理路径", "关联模块", "状态"],
        rows: [
          {
            id: "runbook-auth",
            cells: ["调用返回 401 / 403", "检查 API Key、scope、RBAC 角色和应用状态", "用户与权限", "已就绪"],
            status: "已就绪",
            tone: "good",
          },
          {
            id: "runbook-route",
            cells: ["模型路由超时", "确认模型别名已发布、fallback 可用、供应商凭据未过期", "网关与模型", "已就绪"],
            status: "已就绪",
            tone: "good",
          },
          {
            id: "runbook-budget",
            cells: ["预算或配额超限", "查看项目用量、套餐限制和预算告警处理状态", "计费与配额", "已就绪"],
            status: "已就绪",
            tone: "good",
          },
          {
            id: "runbook-runtime",
            cells: ["本地服务不可用", "按 Deployment 启动命令和 healthz 地址逐个确认", "帮助文档", "已就绪"],
            status: "已就绪",
            tone: "watch",
          },
        ],
      };
    }

    return page.table;
  }, [
    activeTab,
    page.id,
    page.table,
    snapshot?.apiKeys,
    snapshot?.credentials,
    snapshot?.dashboard?.audit,
    snapshot?.dashboard?.health,
    snapshot?.modelRoutes,
    snapshot?.requestLogs,
    snapshot?.routes,
    snapshot?.roles,
    snapshot?.skills,
    snapshot?.billingSummaries,
    snapshot?.budgetAlerts,
    snapshot?.usage,
  ]);

  const statuses = useMemo(
    () => ["全部状态", ...Array.from(new Set(tableView.rows.map((row) => row.status)))],
    [tableView.rows],
  );

  const rows = useMemo(
    () =>
      tableView.rows.filter((row) => {
        const searchableText = [...row.cells, displayStatus(row.status), nextStepForStatus(row.status)].join(" ").toLowerCase();
        const matchesQuery = searchableText.includes(query.toLowerCase());
        const matchesStatus = status === "全部状态" || row.status === status;
        return matchesQuery && matchesStatus;
      }),
    [query, status, tableView.rows],
  );
  const filtersActive = query.trim() !== "" || status !== "全部状态";
  const sortColumnIndex = Math.min(sort.columnIndex, Math.max(tableView.columns.length - 1, 0));
  const sortedRows = useMemo(
    () =>
      [...rows].sort((first, second) => {
        const firstValue = first.cells[sortColumnIndex] || "";
        const secondValue = second.cells[sortColumnIndex] || "";
        return compareTableCell(firstValue, secondValue, sort.direction);
      }),
    [rows, sort.direction, sortColumnIndex],
  );
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const currentPageRows = useMemo(
    () => sortedRows.slice(safePageIndex * pageSize, safePageIndex * pageSize + pageSize),
    [pageSize, safePageIndex, sortedRows],
  );
  const pageStart = sortedRows.length ? safePageIndex * pageSize + 1 : 0;
  const pageEnd = Math.min(sortedRows.length, safePageIndex * pageSize + pageSize);
  const exportLabel = exportState === "success" ? "已导出" : exportState === "error" ? "导出失败" : "导出";

  useEffect(() => {
    setPageIndex(0);
  }, [pageSize, query, sort.direction, sortColumnIndex, status]);

  useEffect(() => {
    if (pageIndex !== safePageIndex) {
      setPageIndex(safePageIndex);
    }
  }, [pageIndex, safePageIndex]);

  const selectedApplication = useMemo(() => {
    if (page.id !== "docs" || !snapshot?.applications?.length) {
      return undefined;
    }

    return (
      snapshot.applications.find((application) => application.id === selectedApplicationId) ||
      snapshot.applications.find((application) => application.id === selectedRowId) ||
      snapshot.applications.find((application) => application.status === "Provisioning") ||
      snapshot.applications[0]
    );
  }, [page.id, selectedApplicationId, selectedRowId, snapshot?.applications]);

  const selectedUser = useMemo(() => {
    if (page.id !== "iam" || !snapshot?.users?.length) {
      return undefined;
    }

    const selected = snapshot.users.find((user) => user.id === selectedRowId);
    const invited = snapshot.users.find((user) => user.status === "Invited");
    if (invited && selected?.status !== "Invited") {
      return invited;
    }

    return selected || snapshot.users[0];
  }, [page.id, selectedRowId, snapshot?.users]);

  const selectedRoute = useMemo(() => {
    if (page.id !== "gateway" || !snapshot?.routes?.length) {
      return undefined;
    }

    return (
      snapshot.routes.find((route) => route.id === selectedRouteId) ||
      snapshot.routes.find((route) => route.id === selectedRowId) ||
      snapshot.routes.find((route) => route.status === "Draft") ||
      snapshot.routes[0]
    );
  }, [page.id, selectedRouteId, selectedRowId, snapshot?.routes]);

  const selectedModelRoute = useMemo(() => {
    if (page.id !== "gateway" || !snapshot?.modelRoutes?.length) {
      return undefined;
    }

    return (
      snapshot.modelRoutes.find((route) => route.id === selectedModelRouteId) ||
      snapshot.modelRoutes.find((route) => route.id === selectedRowId) ||
      snapshot.modelRoutes.find((route) => route.status === "Draft") ||
      snapshot.modelRoutes.find((route) => route.alias === "chat-default") ||
      snapshot.modelRoutes[0]
    );
  }, [page.id, selectedModelRouteId, selectedRowId, snapshot?.modelRoutes]);

  const selectedSkill = useMemo(() => {
    if (page.id !== "gateway" || !snapshot?.skills?.length) {
      return undefined;
    }

    return (
      snapshot.skills.find((skill) => skill.id === selectedSkillId) ||
      snapshot.skills.find((skill) => skill.id === selectedRowId) ||
      snapshot.skills.find((skill) => skill.status === "Draft") ||
      snapshot.skills.find((skill) => skill.status === "Published") ||
      snapshot.skills[0]
    );
  }, [page.id, selectedRowId, selectedSkillId, snapshot?.skills]);

  const selectedPlan = useMemo(() => {
    if (page.id !== "quota" || !snapshot?.plans?.length) {
      return undefined;
    }

    return (
      snapshot.plans.find((plan) => plan.id === selectedPlanId) ||
      snapshot.plans.find((plan) => plan.id === selectedRowId) ||
      snapshot.plans.find((plan) => plan.status === "Guarded") ||
      snapshot.plans.find((plan) => plan.status === "Draft") ||
      snapshot.plans[0]
    );
  }, [page.id, selectedPlanId, selectedRowId, snapshot?.plans]);

  const selectedBudgetAlert = useMemo(() => {
    if (page.id !== "quota" || !snapshot?.budgetAlerts?.length) {
      return undefined;
    }

    return (
      snapshot.budgetAlerts.find((alert) => alert.id === selectedBudgetAlertId) ||
      snapshot.budgetAlerts.find((alert) => alert.id === selectedRowId) ||
      snapshot.budgetAlerts.find((alert) => alert.status === "Warning") ||
      snapshot.budgetAlerts[0]
    );
  }, [page.id, selectedBudgetAlertId, selectedRowId, snapshot?.budgetAlerts]);

  const selectedCredential = useMemo(() => {
    if (page.id !== "iam" || !snapshot?.credentials?.length) {
      return undefined;
    }

    return (
      snapshot.credentials.find((credential) => credential.id === selectedCredentialId) ||
      snapshot.credentials.find((credential) => credential.id === selectedRowId) ||
      snapshot.credentials.find((credential) => credential.status === "Expiring") ||
      snapshot.credentials.find((credential) => credential.status === "Active") ||
      snapshot.credentials[0]
    );
  }, [page.id, selectedCredentialId, selectedRowId, snapshot?.credentials]);

  const selectedAPIKey = useMemo(() => {
    if (page.id !== "iam" || !snapshot?.apiKeys?.length) {
      return undefined;
    }

    return (
      snapshot.apiKeys.find((key) => key.id === selectedAPIKeyId) ||
      snapshot.apiKeys.find((key) => key.id === selectedRowId) ||
      snapshot.apiKeys.find((key) => key.status === "Active") ||
      snapshot.apiKeys[0]
    );
  }, [page.id, selectedAPIKeyId, selectedRowId, snapshot?.apiKeys]);

  const selectableTable =
    page.id === "overview" || page.id === "iam" || page.id === "docs" || page.id === "gateway" || page.id === "quota";
  const selectedGenericRow = sortedRows.find((row) => row.id === selectedRowId) || currentPageRows[0] || sortedRows[0];
  const primaryAllowed = canRunPrimaryAction(role, page.id);
  const primaryHint = primaryActionHint(role, page.id);
  let selectedTableRowId: string | undefined;
  if (page.id === "overview") {
    selectedTableRowId = selectedRowId;
  }
  if (page.id === "iam" && activeTab === "用户") {
    selectedTableRowId = selectedUser?.id;
  }
  if (page.id === "iam" && activeTab === "API Key") {
    selectedTableRowId = selectedAPIKey?.id;
  }
  if (page.id === "iam" && activeTab === "凭据") {
    selectedTableRowId = selectedCredential?.id;
  }
  if (page.id === "iam" && activeTab === "角色权限") {
    selectedTableRowId = selectedRowId;
  }
  if (page.id === "docs" && activeTab === "Guides") {
    selectedTableRowId = selectedApplication?.id;
  }
  if (page.id === "docs" && activeTab !== "Guides") {
    selectedTableRowId = selectedRowId;
  }
  if (page.id === "gateway" && activeTab === "API 路由") {
    selectedTableRowId = selectedRoute?.id;
  }
  if (page.id === "gateway" && activeTab === "模型路由") {
    selectedTableRowId = selectedModelRoute?.id;
  }
  if (page.id === "gateway" && activeTab === "Skill 调用") {
    selectedTableRowId = selectedSkill?.id;
  }
  if (page.id === "gateway" && activeTab === "请求日志") {
    selectedTableRowId = selectedRowId;
  }
  if (page.id === "quota" && activeTab === "套餐") {
    selectedTableRowId = selectedPlan?.id;
  }
  if (page.id === "quota" && activeTab === "账单汇总") {
    selectedTableRowId = selectedRowId;
  }
  if (page.id === "quota" && activeTab === "用量") {
    selectedTableRowId = selectedRowId;
  }
  if (page.id === "quota" && activeTab === "预算告警") {
    selectedTableRowId = selectedBudgetAlert?.id;
  }

  useEffect(() => {
    if (!sortedRows.length) {
      setSelectedRowId("");
      return;
    }

    const stillVisible = sortedRows.some((row) => row.id === selectedRowId);
    if (!stillVisible) {
      setSelectedRowId(currentPageRows[0]?.id || sortedRows[0].id);
      return;
    }

    if (currentPageRows.length && !currentPageRows.some((row) => row.id === selectedRowId)) {
      setSelectedRowId(currentPageRows[0].id);
    }
  }, [currentPageRows, selectedRowId, sortedRows]);

  async function handleSelectedUserActivate(id: string) {
    await onUserActivate(id);
    setSelectedRowId(id);
  }

  function handleTableSort(columnIndex: number) {
    setSort((current) => ({
      columnIndex,
      direction: current.columnIndex === columnIndex && current.direction === "asc" ? "desc" : "asc",
    }));
    setPageIndex(0);
  }

  function handlePageSizeChange(nextPageSize: number) {
    setPageSize(nextPageSize);
    setPageIndex(0);
  }

  function handleTableExport() {
    if (!sortedRows.length) {
      return;
    }

    try {
      const csv = buildTableCsv(tableView.columns, sortedRows);
      const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = tableExportFilename(page.id, activeTabIndex);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      setExportState("success");
    } catch {
      setExportState("error");
    }

    window.setTimeout(() => setExportState("idle"), 1800);
  }

  return (
    <main className="page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{page.eyebrow}</p>
          <h2>{page.title}</h2>
          <p>{page.description}</p>
        </div>
        <div className="page-heading__action">
          <button
            aria-label={
              primaryAllowed
                ? `${page.title}：${page.primaryAction}`
                : `${page.title}：无法执行 ${page.primaryAction}，${primaryHint}`
            }
            className="button button--primary"
            disabled={!primaryAllowed}
            onClick={() => void onPrimaryAction(page.id)}
            title={primaryAllowed ? undefined : primaryHint}
            type="button"
          >
            {page.primaryAction}
            <ChevronRight aria-hidden="true" size={16} />
          </button>
          {!primaryAllowed ? <ActionHint>{primaryHint}</ActionHint> : null}
        </div>
      </section>

      {notice ? (
        <p aria-live="polite" className="inline-notice" role="status">
          {notice}
        </p>
      ) : null}

      <ModuleWorkflow activeTab={activeTab} steps={moduleWorkflows[page.id]} />

      <div className="tab-row" aria-label={`${page.title} 页面视图`} role="tablist">
        {page.tabs.map((tab, index) => (
          <button
            aria-controls={`module-panel-${page.id}`}
            aria-selected={tab === activeTab}
            className={tab === activeTab ? "is-active" : ""}
            id={`module-tab-${page.id}-${index}`}
            key={tab}
            onClick={() => setActiveTab(tab)}
            onKeyDown={(event) => handleModuleTabKeyDown(event, index)}
            role="tab"
            type="button"
          >
            {tab}
          </button>
        ))}
      </div>

      <ModuleActionStrip
        activeTab={activeTab}
        onPrimaryAction={onPrimaryAction}
        page={page}
        primaryAllowed={primaryAllowed}
        primaryHint={primaryHint}
        recordCount={tableView.rows.length}
        visibleCount={sortedRows.length}
      />

      <ModuleFocusBar
        activeTab={activeTab}
        recordCount={tableView.rows.length}
        steps={moduleWorkflows[page.id]}
        visibleCount={sortedRows.length}
      />

      <ModuleSummaryStrip
        activeTab={activeTab}
        metrics={page.metrics}
        recordCount={tableView.rows.length}
        visibleCount={sortedRows.length}
      />

      <section
        aria-labelledby={`module-tab-${page.id}-${activeTabIndex}`}
        className="content-grid"
        id={`module-panel-${page.id}`}
        role="tabpanel"
      >
        <Panel className="content-grid__main" eyebrow={tableView.eyebrow} title={tableView.title}>
          <div className="table-toolbar">
            <label className="search-field">
              <Search aria-hidden="true" size={16} />
              <input
                aria-label={`${page.title} 表格搜索`}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索表格"
                value={query}
              />
            </label>
            <div className="table-toolbar__filters">
              <select aria-label={`${page.title} 状态筛选`} onChange={(event) => setStatus(event.target.value)} value={status}>
                {statuses.map((item) => (
                  <option key={item} value={item}>
                    {item === "全部状态" ? item : displayStatus(item)}
                  </option>
                ))}
              </select>
              <select
                aria-label={`${page.title} 排序字段`}
                onChange={(event) => handleTableSort(Number(event.target.value))}
                value={sortColumnIndex}
              >
                {tableView.columns.map((column, index) => (
                  <option key={column} value={index}>
                    按{column}
                  </option>
                ))}
              </select>
              <button
                aria-label={`${page.title} 表格排序方向：${sort.direction === "asc" ? "升序" : "降序"}`}
                className="text-command"
                onClick={() => handleTableSort(sortColumnIndex)}
                type="button"
              >
                <ArrowDownUp aria-hidden="true" size={14} />
                {sort.direction === "asc" ? "升序" : "降序"}
              </button>
              <button
                aria-label={`导出${page.title} ${tableView.title} CSV，共 ${sortedRows.length} 条记录`}
                className="text-command"
                disabled={!sortedRows.length}
                onClick={handleTableExport}
                type="button"
              >
                <Download aria-hidden="true" size={14} />
                {exportLabel}
              </button>
              {filtersActive ? (
                <button
                  aria-label={`清空${page.title}表格筛选`}
                  className="text-command"
                  onClick={() => {
                    setQuery("");
                    setStatus("全部状态");
                  }}
                  type="button"
                >
                  清空筛选
                </button>
              ) : null}
              <span className="table-result-count">
                {sortedRows.length} / {tableView.rows.length} 条记录
              </span>
            </div>
          </div>
          <DataTable
            ariaLabel={`${page.title}：${tableView.title}`}
            columns={tableView.columns}
            emptyDescription={
              filtersActive ? "清空搜索或状态筛选后，可以回到完整列表。" : "连接后端数据源后，这里会展示当前模块的关键记录。"
            }
            emptyTitle={filtersActive ? "当前筛选没有结果" : "暂无模块记录"}
            onRowSelect={selectableTable ? setSelectedRowId : undefined}
            onSort={handleTableSort}
            rows={currentPageRows}
            selectedRowId={selectedTableRowId}
            sort={{ columnIndex: sortColumnIndex, direction: sort.direction }}
          />
          <TablePagination
            onPageChange={setPageIndex}
            onPageSizeChange={handlePageSizeChange}
            pageCount={pageCount}
            pageEnd={pageEnd}
            pageIndex={safePageIndex}
            pageSize={pageSize}
            pageStart={pageStart}
            rowCount={sortedRows.length}
          />
        </Panel>

        <div className="side-panels">
          <ModuleSideBrief
            activeTab={activeTab}
            pageTitle={page.title}
            rows={tableView.rows}
            visibleRows={sortedRows}
          />
          {page.id === "overview" ? (
            <SelectedRowPanel columns={tableView.columns} row={selectedGenericRow} title={tableView.title} />
          ) : null}
          {page.id === "iam" && activeTab === "用户" ? (
            <UserAccessPanel
              activating={activatingUserId === selectedUser?.id}
              onActivate={handleSelectedUserActivate}
              role={role}
              user={selectedUser}
            />
          ) : null}
          {page.id === "iam" && activeTab === "API Key" ? (
            <APIKeyPanel
              apiKey={selectedAPIKey}
              onRevoke={onAPIKeyRevoke}
              revoking={revokingAPIKeyId === selectedAPIKey?.id}
              role={role}
            />
          ) : null}
          {page.id === "iam" && activeTab === "凭据" ? (
            <CredentialRefPanel
              credential={selectedCredential}
              onRotate={onCredentialRotate}
              role={role}
              rotating={rotatingCredentialId === selectedCredential?.id}
            />
          ) : null}
          {page.id === "gateway" && activeTab === "API 路由" ? (
            <GatewayRoutePanel
              onPublish={onRoutePublish}
              publishing={publishingRouteId === selectedRoute?.id}
              route={selectedRoute}
            />
          ) : null}
          {page.id === "gateway" && activeTab === "模型路由" ? (
            <ModelRoutePanel
              modelRoute={selectedModelRoute}
              onCreate={onModelRouteCreate}
              onPublish={onModelRoutePublish}
              publishing={publishingModelRouteId === selectedModelRoute?.id}
              role={role}
            />
          ) : null}
          {page.id === "gateway" && activeTab === "Skill 调用" ? (
            <SkillBindingPanel
              onCreate={onSkillBindingCreate}
              onInvoked={onLLMInvoked}
              onPublish={onSkillBindingPublish}
              publishing={publishingSkillId === selectedSkill?.id}
              role={role}
              skill={selectedSkill}
            />
          ) : null}
          {page.id === "gateway" && activeTab === "模型路由" ? (
            <LLMInvokePanel modelRoutes={snapshot?.modelRoutes} onInvoked={onLLMInvoked} role={role} />
          ) : null}
          {page.id === "gateway" && activeTab === "请求日志" ? (
            <SelectedRowPanel columns={tableView.columns} row={selectedGenericRow} title={tableView.title} />
          ) : null}
          {page.id === "quota" && activeTab === "套餐" ? (
            <BillingPlanPanel
              activating={activatingPlanId === selectedPlan?.id}
              onActivate={onPlanActivate}
              plan={selectedPlan}
              role={role}
            />
          ) : null}
          {page.id === "quota" && activeTab === "预算告警" ? (
            <BudgetAlertPanel
              alert={selectedBudgetAlert}
              onResolve={onBudgetAlertResolve}
              resolving={resolvingBudgetAlertId === selectedBudgetAlert?.id}
              role={role}
            />
          ) : null}
          {page.id === "quota" && (activeTab === "账单汇总" || activeTab === "用量") ? (
            <SelectedRowPanel columns={tableView.columns} row={selectedGenericRow} title={tableView.title} />
          ) : null}
          {page.id === "docs" && activeTab === "Guides" ? (
            <ApplicationJourneyPanel
              activating={activatingApplicationId === selectedApplication?.id}
              application={selectedApplication}
              onActivate={onApplicationActivate}
              onRotateKey={onApplicationKeyRotate}
              rotating={rotatingApplicationId === selectedApplication?.id}
              role={role}
              snapshot={snapshot}
            />
          ) : null}
          {page.id === "docs" && activeTab !== "Guides" ? (
            <DocsReferencePanel activeTab={activeTab} row={selectedGenericRow} />
          ) : null}
          {page.id === "overview" ? <OperationsSignalPanel snapshot={snapshot} /> : null}
          {page.panels.map((panel) => (
            <Panel eyebrow={panel.eyebrow} key={panel.title} title={panel.title}>
              <div className="key-list">
                {panel.items.map((item) => (
                  <article key={`${item.label}-${item.value}`}>
                    <span>{item.label}</span>
                    <strong>{displayStatus(item.value)}</strong>
                    <p>{item.note}</p>
                  </article>
                ))}
              </div>
            </Panel>
          ))}
        </div>
      </section>
    </main>
  );
}

function ModuleActionStrip({
  activeTab,
  onPrimaryAction,
  page,
  primaryAllowed,
  primaryHint,
  recordCount,
  visibleCount,
}: {
  activeTab: string;
  onPrimaryAction: (pageId: ConsoleRoute) => Promise<void>;
  page: ModulePageDefinition;
  primaryAllowed: boolean;
  primaryHint: string;
  recordCount: number;
  visibleCount: number;
}) {
  return (
    <section aria-label={`${page.title} 模块操作摘要`} className="module-action-strip">
      <div className="module-action-strip__intro">
        <span>模块</span>
        <strong>{page.title}</strong>
        <p>{page.description}</p>
      </div>
      <div>
        <span>当前视图</span>
        <strong>{activeTab}</strong>
        <p>
          {visibleCount} / {recordCount} 条记录 · {visibleCount === recordCount ? "完整列表" : "已筛选"}
        </p>
      </div>
      <div className="module-action-strip__action">
        <span>{primaryAllowed ? "可执行" : "只读"}</span>
        <button
          aria-label={
            primaryAllowed
              ? `${page.title}：${page.primaryAction}`
              : `${page.title}：无法执行 ${page.primaryAction}，${primaryHint}`
          }
          className="button button--primary"
          disabled={!primaryAllowed}
          onClick={() => void onPrimaryAction(page.id)}
          title={primaryAllowed ? undefined : primaryHint}
          type="button"
        >
          {page.primaryAction}
          <ChevronRight aria-hidden="true" size={16} />
        </button>
        <p>{primaryAllowed ? "当前角色可以执行关键动作。" : primaryHint}</p>
      </div>
    </section>
  );
}

function ModuleSideBrief({
  activeTab,
  pageTitle,
  rows,
  visibleRows,
}: {
  activeTab: string;
  pageTitle: string;
  rows: TableRow[];
  visibleRows: TableRow[];
}) {
  const recentRow = visibleRows[0] || rows[0];
  const riskRow =
    visibleRows.find((row) => row.tone === "warn" || row.tone === "watch") ||
    rows.find((row) => row.tone === "warn" || row.tone === "watch");
  const riskTone = riskRow?.tone || "good";

  return (
    <Panel eyebrow="Context" title="模块概览">
      <div className="module-side-brief">
        <article>
          <span>当前视图</span>
          <strong>{activeTab}</strong>
          <p>
            {pageTitle} 当前展示 {visibleRows.length} / {rows.length} 条关键记录。
          </p>
        </article>
        <article>
          <span>最近变化</span>
          <strong>{recentRow?.cells[0] || "等待数据"}</strong>
          <p>
            {recentRow
              ? `${displayStatus(recentRow.status)} · 进入详情可继续处理`
              : "连接后端后展示最新记录。"}
          </p>
        </article>
        <article>
          <span>风险提示</span>
          <strong>{riskRow?.cells[0] || "暂无风险"}</strong>
          <p>
            {riskRow
              ? `${displayStatus(riskRow.status)} · 优先检查配置与审计链路`
              : "当前视图没有需要优先处理的异常。"}
          </p>
          <StatusDot tone={riskTone} />
        </article>
      </div>
    </Panel>
  );
}

function OperationsSignalPanel({ snapshot }: { snapshot?: PlatformSnapshot }) {
  const health = snapshot?.dashboard?.health?.slice(0, 3) || [];
  const audit = snapshot?.dashboard?.audit?.slice(0, 4) || [];

  return (
    <>
      <Panel eyebrow="健康" title="服务健康">
        {health.length ? (
          <div className="operations-signal-list">
            {health.map((item) => (
              <article key={item.id}>
                <div>
                  <span>{item.name}</span>
                  <strong>{item.p95}</strong>
                  <p>SLO {item.slo}</p>
                </div>
                <StatusBadge tone={toneForStatus(item.status)}>{item.status}</StatusBadge>
              </article>
            ))}
          </div>
        ) : (
          <EmptyPanel description="连接 ops-api 后，这里会展示核心服务的 SLO、P95 和状态。" title="暂无健康数据" />
        )}
      </Panel>

      <Panel eyebrow="审计" title="最近审计">
        {audit.length ? (
          <div className="audit-event-list">
            {audit.map((item) => (
              <article key={item.id}>
                <span>{item.module}</span>
                <strong>{item.action}</strong>
                <p>{item.object}</p>
                <small>{item.requestId}</small>
              </article>
            ))}
          </div>
        ) : (
          <EmptyPanel description="配置变更、权限操作和运行期动作会写入这里。" title="暂无审计事件" />
        )}
      </Panel>
    </>
  );
}

function SelectedRowPanel({
  columns,
  row,
  title,
}: {
  columns: string[];
  row?: TableRow;
  title: string;
}) {
  if (!row) {
    return (
      <Panel eyebrow="选择" title="选中详情">
        <EmptyPanel description="切换筛选条件或选择表格行后，这里会展示关键字段。" title="暂无选中记录" />
      </Panel>
    );
  }

  const fields = columns.map((column, index) => ({
    label: column,
    value: column === "状态" ? displayStatus(row.cells[index] || "-") : row.cells[index] || "-",
  }));
  const headline = row.cells[0] || title;
  const description = fields
    .slice(1, 3)
    .map((field) => `${field.label}: ${field.value}`)
    .join(" · ");
  const nextStep = nextStepForStatus(row.status);

  return (
    <Panel eyebrow="选择" title="选中详情">
      <div className="selected-row-summary">
        <div>
          <span>{title}</span>
          <strong>{headline}</strong>
          <p>{description || "查看当前记录的关键字段和状态。"}</p>
        </div>
        <StatusBadge tone={row.tone}>{row.status}</StatusBadge>
      </div>

      <div className="selected-row-fields">
        {fields.map((field, index) => (
          <article key={`${row.id}-${field.label}`}>
            <span>{field.label}</span>
            <strong>{field.value}</strong>
            {index === fields.length - 1 ? <StatusDot tone={row.tone} /> : null}
          </article>
        ))}
      </div>

      <div aria-label={`下一步：${nextStep}，当前状态 ${displayStatus(row.status)}`} className="selected-row-next">
        <span>下一步</span>
        <strong>{nextStep}</strong>
        <p>先看状态，再进入对应模块处理配置、调用、预算或审计问题。</p>
      </div>
    </Panel>
  );
}

interface DocsReferenceArticle {
  label: string;
  title: string;
  note: string;
}

interface DocsReferencePath {
  label: string;
  title: string;
  note: string;
  status: string;
}

interface DocsReferenceConfig {
  eyebrow: string;
  title: string;
  summary: string;
  focus: string;
  outcome: string;
  snippetEyebrow: string;
  snippetTitle: string;
  snippetAriaLabel: string;
  snippet: string;
  articles: DocsReferenceArticle[];
  paths: DocsReferencePath[];
}

function normalizeDocsEndpoint(value?: string) {
  if (!value?.startsWith("/")) {
    return "/api/v1/llm/chat";
  }

  return value.replace("/**", "/chat").replace(/\*+/g, "chat");
}

function docsReferenceFor(activeTab: string, row?: TableRow): DocsReferenceConfig {
  if (activeTab === "API Examples") {
    const endpoint = normalizeDocsEndpoint(row?.cells[0]);
    const entry = row?.cells[0] || endpoint;

    return {
      eyebrow: "API Examples",
      title: "调用示例详情",
      summary: "围绕当前入口给出最小请求、认证方式和验证路径，方便开发人员直接复制后接入。",
      focus: entry,
      outcome: row?.cells[3] || "确认请求格式、认证头和状态返回。",
      snippetEyebrow: "API Examples",
      snippetTitle: "最小调用示例",
      snippetAriaLabel: "API Examples curl 调用示例",
      snippet: [
        `curl -X POST http://localhost:18080${endpoint} \\`,
        '  -H "Authorization: Bearer ak_live_xxx" \\',
        '  -H "Content-Type: application/json" \\',
        '  -d \'{"appId":"app_demo","message":"hello"}\'',
      ].join("\n"),
      articles: [
        { label: "Auth", title: "统一认证头", note: row?.cells[2] || "API Key + RBAC" },
        { label: "Request", title: "请求体保持最小", note: "先验证 appId、message 和 route，再接业务字段。" },
        { label: "Observe", title: "验证用量与日志", note: "成功后回到运营总览和计费模块确认链路。" },
      ],
      paths: [
        { label: "01", title: "复制示例", note: "替换 API Key 与 appId。", status: "Ready" },
        { label: "02", title: "发送请求", note: "先打本地 platform-all，再接入真实调用方。", status: "Ready" },
        { label: "03", title: "查看结果", note: "确认请求日志、Token 用量和预算状态。", status: "Ready" },
      ],
    };
  }

  if (activeTab === "Deployment") {
    const component = row?.cells[0] || "platform-all";
    const command = row?.cells[1] || "pnpm dev:api";
    const health = row?.cells[2] || "http://localhost:18080/healthz";

    return {
      eyebrow: "Deployment",
      title: "部署说明详情",
      summary: "把本地预览、单服务启动和健康检查放在同一视图，便于从前端直接对齐后端运行边界。",
      focus: component,
      outcome: row?.cells[3] || "确认服务启动命令、健康检查和职责范围。",
      snippetEyebrow: "Deployment",
      snippetTitle: "本地验证命令",
      snippetAriaLabel: "Deployment 本地验证命令",
      snippet: [command, `curl ${health}`, "pnpm verify:smoke-api", "pnpm verify:console-copy"].join("\n"),
      articles: [
        { label: "Local", title: "本地优先", note: "V1 先用轻量命令跑通控制台与 Go API。" },
        { label: "Image", title: "单镜像预留", note: "成熟后按 control / gateway / billing / ops 拆容器。" },
        { label: "Health", title: "健康检查", note: health },
      ],
      paths: [
        { label: "01", title: "安装依赖", note: "pnpm install 后再启动服务。", status: "Ready" },
        { label: "02", title: "启动组件", note: command, status: "Ready" },
        { label: "03", title: "运行校验", note: "执行 smoke 和 copy gate，避免界面与服务边界漂移。", status: "Ready" },
      ],
    };
  }

  const symptom = row?.cells[0] || "调用失败";
  const resolution = row?.cells[1] || "先确认认证、路由、预算和服务健康。";

  return {
    eyebrow: "Troubleshooting",
    title: "排障路径详情",
    summary: "按症状把排查顺序固定下来，优先定位认证、路由、预算和本地运行状态。",
    focus: symptom,
    outcome: resolution,
    snippetEyebrow: "Troubleshooting",
    snippetTitle: "排障检查命令",
    snippetAriaLabel: "Troubleshooting 排障检查命令",
    snippet: [
      "curl http://localhost:18080/healthz",
      "pnpm verify:smoke-api",
      "pnpm verify:console-copy",
      "pnpm verify",
    ].join("\n"),
    articles: [
      { label: "Auth", title: "先看身份", note: "API Key、scope、RBAC 和应用状态决定是否能进网关。" },
      { label: "Route", title: "再看路由", note: "确认 API 路由、模型别名、fallback 和供应商凭据。" },
      { label: "Quota", title: "最后看预算", note: "预算、套餐和 Token 用量会影响真实调用结果。" },
    ],
    paths: [
      { label: "01", title: "确认健康", note: "先确认 platform-all 或对应服务 healthz。", status: "Ready" },
      { label: "02", title: "复现请求", note: "复制 API Examples 的最小调用。", status: "Ready" },
      { label: "03", title: "回看日志", note: "在运营总览和请求日志中确认失败点。", status: "Ready" },
    ],
  };
}

function DocsReferencePanel({ activeTab, row }: { activeTab: string; row?: TableRow }) {
  const reference = docsReferenceFor(activeTab, row);
  const status = row?.status || "已就绪";
  const tone: StatusTone = row?.tone || "good";

  return (
    <Panel eyebrow={reference.eyebrow} title={reference.title}>
      <div className="docs-reference-summary">
        <div>
          <span>当前资料</span>
          <strong>{reference.focus}</strong>
          <p>{reference.summary}</p>
        </div>
        <StatusBadge tone={tone}>{status}</StatusBadge>
      </div>

      <div className="docs-reference-grid">
        {reference.articles.map((article) => (
          <article aria-label={`${article.label}：${article.title}，${article.note}`} key={article.label}>
            <span>{article.label}</span>
            <strong>{article.title}</strong>
            <p>{article.note}</p>
          </article>
        ))}
      </div>

      <QuickstartSnippet
        ariaLabel={reference.snippetAriaLabel}
        curl={reference.snippet}
        eyebrow={reference.snippetEyebrow}
        title={reference.snippetTitle}
      />

      <div className="docs-path-list">
        <article>
          <span aria-hidden="true">00</span>
          <div>
            <strong>当前结论</strong>
            <p>{reference.outcome}</p>
          </div>
          <StatusBadge tone={tone}>{status}</StatusBadge>
        </article>
        {reference.paths.map((path) => (
          <article aria-label={`${path.title}：${path.status}，${path.note}`} key={path.label}>
            <span aria-hidden="true">{path.label}</span>
            <div>
              <strong>{path.title}</strong>
              <p>{path.note}</p>
            </div>
            <StatusBadge tone={toneForStatus(path.status)}>{path.status}</StatusBadge>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function ApplicationJourneyPanel({
  activating,
  application,
  onActivate,
  onRotateKey,
  rotating,
  role,
  snapshot,
}: {
  activating: boolean;
  application?: Application;
  onActivate: (id: string) => Promise<void>;
  onRotateKey: (id: string) => Promise<void>;
  rotating: boolean;
  role: RoleId;
  snapshot?: PlatformSnapshot;
}) {
  if (!application) {
    const placeholderCurl = [
      "curl -X POST http://localhost:18080/api/v1/llm/chat \\",
      '  -H "Authorization: Bearer ak_live_xxx" \\',
      '  -H "Content-Type: application/json" \\',
      '  -d \'{"appId":"app_demo","route":"/api/v1/llm/chat","message":"hello"}\'',
    ].join("\n");

    return (
      <Panel eyebrow="接入" title="应用接入详情">
        <EmptyPanel description="创建接入应用后，这里会展示 API Key、路由、用量和审计链路。" title="暂无应用" />
        <QuickstartChecklist />
        <QuickstartSnippet curl={placeholderCurl} />
      </Panel>
    );
  }

  const apiKey = snapshot?.apiKeys?.find(
    (item) => item.project === application.name || item.name === application.apiKey,
  );
  const usage = snapshot?.usage?.find((item) => item.project === application.name);
  const budget = snapshot?.budgetAlerts?.find((item) => item.project === application.name);
  const logs = snapshot?.requestLogs?.filter((item) => item.consumer === application.name).slice(0, 3) || [];
  const canManage = canManageApplicationOnboarding(role);
  const quickstartCurl = [
    "curl -X POST http://localhost:18080/api/v1/llm/chat \\",
    `  -H "Authorization: Bearer ${application.apiKey}" \\`,
    '  -H "Content-Type: application/json" \\',
    `  -d '{"appId":"${application.id}","route":"${application.defaultRoute}","message":"hello"}'`,
  ].join("\n");

  const steps = [
    {
      label: "Application",
      value: application.name,
      note: `${application.environment} · ${application.status}`,
      tone: application.status,
    },
    {
      label: "API Key",
      value: apiKey?.name || application.apiKey,
      note: apiKey?.scope || "llm:chat skill:invoke",
      tone: apiKey?.status || application.status,
    },
    {
      label: "Gateway",
      value: application.defaultRoute,
      note: "API Key auth · model/skill route",
      tone: "Active",
    },
    {
      label: "Quota",
      value: application.plan,
      note: budget ? `${budget.current} / ${budget.budget}` : "等待首次用量",
      tone: budget?.status || "Ready",
    },
  ];

  return (
    <Panel eyebrow="接入" title="应用接入详情">
      <div className="application-summary">
        <div>
          <span>当前应用</span>
          <strong>{application.name}</strong>
          <p>{application.owner}</p>
        </div>
        <StatusBadge tone={toneForStatus(application.status)}>{application.status}</StatusBadge>
      </div>

      <div className="journey-list">
        {steps.map((step, index) => (
          <article key={step.label}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <small>{step.label}</small>
              <strong>{step.value}</strong>
              <p>{step.note}</p>
            </div>
            <StatusBadge tone={toneForStatus(step.tone)}>{step.tone}</StatusBadge>
          </article>
        ))}
      </div>

      <div className="application-usage">
        <article>
          <span>Token 用量</span>
          <strong>{usage?.tokens || "0"}</strong>
          <p>{usage?.status || "等待首次用量"}</p>
        </article>
        <article>
          <span>Skill 调用</span>
          <strong>{usage?.skillCalls || "0"}</strong>
          <p>{usage?.cost || "$0"}</p>
        </article>
      </div>

      <QuickstartChecklist application={application} apiKey={apiKey} hasRequestLogs={logs.length > 0} />

      <QuickstartSnippet curl={quickstartCurl} />

      <div className="mini-log-list">
        {logs.length ? (
          logs.map((log) => (
            <article key={log.id}>
              <span>{log.request}</span>
              <strong>{log.result}</strong>
              <p>
                {log.latency} · {log.status}
              </p>
            </article>
          ))
        ) : (
          <article>
            <span>请求日志</span>
            <strong>等待调用</strong>
            <p>首次调用后这里会出现最近请求。</p>
          </article>
        )}
      </div>

      <div className="application-actions">
        <button
          aria-label={
            canManage
              ? `轮换 ${application.name} 的 API Key`
              : `无法轮换 ${application.name} 的 API Key，当前角色不能处理接入应用`
          }
          className="button"
          disabled={!canManage || rotating}
          onClick={() => void onRotateKey(application.id)}
          title={!canManage ? "当前角色不能轮换接入应用 API Key。" : undefined}
          type="button"
        >
          {rotating ? "轮换中" : "轮换 API Key"}
        </button>
        <button
          aria-label={
            canManage
              ? `${application.status === "Active" ? "已完成" : "完成"} ${application.name} 的接入校验`
              : `无法完成 ${application.name} 的接入校验，当前角色不能处理接入应用`
          }
          className="button button--primary"
          disabled={!canManage || activating || application.status === "Active"}
          onClick={() => void onActivate(application.id)}
          title={!canManage ? "当前角色不能完成接入应用校验。" : undefined}
          type="button"
        >
          {application.status === "Active" ? "已完成校验" : activating ? "校验中" : "完成接入校验"}
          <ChevronRight aria-hidden="true" size={16} />
        </button>
        {!canManage ? <ActionHint>需要管理员、使用用户或开发人员处理接入应用。</ActionHint> : null}
      </div>
    </Panel>
  );
}

function QuickstartChecklist({
  apiKey,
  application,
  hasRequestLogs = false,
}: {
  apiKey?: APIKey;
  application?: Application;
  hasRequestLogs?: boolean;
}) {
  const steps = [
    {
      label: "01",
      title: "创建接入应用",
      note: "确定 owner、环境、默认路由和套餐。",
      status: application?.status || "Waiting",
    },
    {
      label: "02",
      title: "发放 API Key",
      note: "绑定最小 scope，用 credentialRef 管理供应商凭据。",
      status: apiKey?.status || "Waiting",
    },
    {
      label: "03",
      title: "确认网关路由",
      note: "先走模型别名和 Skill 入口，再看 fallback 与限流。",
      status: application?.defaultRoute ? "Ready" : "Waiting",
    },
    {
      label: "04",
      title: "发送最小调用",
      note: "复制 curl 后验证用量、请求日志和预算状态。",
      status: hasRequestLogs ? "Ready" : "Waiting",
    },
  ];

  return (
    <div aria-label="快速接入最小清单" className="quickstart-checklist">
      {steps.map((step) => (
        <article aria-label={`${step.title}：${step.status}，${step.note}`} key={step.label}>
          <span aria-hidden="true">{step.label}</span>
          <div>
            <strong>{step.title}</strong>
            <p>{step.note}</p>
          </div>
          <StatusBadge tone={toneForStatus(step.status)}>{step.status}</StatusBadge>
        </article>
      ))}
    </div>
  );
}

function QuickstartSnippet({
  ariaLabel = "快速接入 curl 调用示例",
  curl,
  eyebrow = "快速接入",
  title = "最小调用示例",
}: {
  ariaLabel?: string;
  curl: string;
  eyebrow?: string;
  title?: string;
}) {
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">("idle");

  async function handleSnippetCopy() {
    try {
      await navigator.clipboard.writeText(curl);
      setCopyState("success");
    } catch {
      setCopyState("error");
    }
    window.setTimeout(() => setCopyState("idle"), 1800);
  }

  const copyLabel =
    copyState === "success" ? "已复制" : copyState === "error" ? "复制失败" : "复制调用示例";

  return (
    <div className="quickstart-snippet">
      <div>
        <span>{eyebrow}</span>
        <strong>{title}</strong>
      </div>
      <button
        aria-label={`${copyLabel}：${ariaLabel}`}
        className="text-command"
        onClick={() => void handleSnippetCopy()}
        type="button"
        aria-live="polite"
        title={copyState === "error" ? "浏览器未允许剪贴板写入，请手动复制代码片段。" : undefined}
      >
        <Copy aria-hidden="true" size={14} />
        {copyLabel}
      </button>
      {copyState === "error" ? (
        <p aria-live="polite" className="quickstart-snippet__hint" role="status">
          浏览器未允许剪贴板写入，请手动复制代码片段。
        </p>
      ) : null}
      <pre aria-label={ariaLabel}>
        <code>{curl}</code>
      </pre>
    </div>
  );
}

function formatGatewayRouteStrategy(strategy?: GatewayRoute["strategy"]) {
  if (strategy === "round_robin") {
    return "Round robin";
  }
  if (strategy === "weighted") {
    return "Weighted";
  }
  return "Ordered";
}

function formatGatewayRouteWeights(weights?: Record<string, number>) {
  const entries = Object.entries(weights || {}).filter(([, value]) => value > 0);

  if (!entries.length) {
    return "默认权重";
  }

  return entries.map(([upstream, weight]) => `${shortenUpstream(upstream)} ${weight}`).join(" / ");
}

function formatGatewayRouteCanary(route?: GatewayRoute) {
  if (!route?.canaryHeader) {
    return "未启用";
  }

  return `${route.canaryHeader}${route.canaryValue ? `=${route.canaryValue}` : " 非空"} -> ${shortenUpstream(
    route.canaryUpstream || "",
  )}`;
}

function shortenUpstream(value: string) {
  try {
    const url = new URL(value);
    return url.host;
  } catch {
    return value || "未配置";
  }
}

function GatewayRoutePanel({
  onPublish,
  publishing,
  route,
}: {
  onPublish: (id: string) => Promise<void>;
  publishing: boolean;
  route?: GatewayRoute;
}) {
  if (!route) {
    return (
      <Panel eyebrow="Route" title="路由详情">
        <EmptyPanel description="新增路由后，这里会展示策略、灰度、鉴权、限流、发布状态和上线动作。" title="暂无路由" />
      </Panel>
    );
  }

  const strategy = route.strategy || "ordered";
  const checks = [
    {
      label: "策略",
      value: formatGatewayRouteStrategy(strategy),
      note: formatGatewayRouteWeights(route.upstreamWeights),
      tone: strategy === "weighted" ? "watch" : "neutral",
    },
    {
      label: "灰度",
      value: formatGatewayRouteCanary(route),
      note: route.canaryHeader ? "Header 命中后优先上游" : "未启用 canary",
      tone: route.canaryHeader ? "watch" : "neutral",
    },
    {
      label: "鉴权",
      value: route.auth,
      note: "入口鉴权策略",
      tone: route.auth === "API Key" ? "good" : "watch",
    },
    { label: "限流", value: route.limit, note: "限流窗口", tone: "neutral" },
    { label: "上游", value: route.upstream, note: "服务入口", tone: "neutral" },
  ] as const;
  const publishLabel =
    route.status === "Active" ? `路由 ${route.route} 已发布` : publishing ? `正在发布路由 ${route.route}` : `发布路由 ${route.route}`;

  return (
    <Panel eyebrow="Route" title="路由详情">
      <div className="route-summary">
        <div>
          <span>当前路由</span>
          <strong>{route.route}</strong>
          <p>Updated {route.updatedAt}</p>
        </div>
        <StatusBadge tone={toneForStatus(route.status)}>{route.status}</StatusBadge>
      </div>

      <div className="route-checks">
        {checks.map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.note}</p>
            <StatusDot tone={item.tone} />
          </article>
        ))}
      </div>

      <div className="application-actions">
        <button
          aria-label={publishLabel}
          className="button button--primary"
          disabled={publishing || route.status === "Active"}
          onClick={() => void onPublish(route.id)}
          type="button"
        >
          {route.status === "Active" ? "已发布" : publishing ? "发布中" : "发布路由"}
          <ChevronRight aria-hidden="true" size={16} />
        </button>
      </div>
    </Panel>
  );
}

function ModelRoutePanel({
  modelRoute,
  onCreate,
  onPublish,
  publishing,
  role,
}: {
  modelRoute?: ModelRoute;
  onCreate: (input: CreateModelRouteInput) => Promise<void>;
  onPublish: (id: string) => Promise<void>;
  publishing: boolean;
  role: RoleId;
}) {
  const [alias, setAlias] = useState("agent-default");
  const [scenario, setScenario] = useState("Agent");
  const [primary, setPrimary] = useState("gpt-4.1-mini");
  const [fallback, setFallback] = useState("local-fallback");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const aliasInputRef = useInitialFocus<HTMLInputElement>(role !== "operator");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await onCreate({ alias, scenario, primary, fallback });
      setAlias(`${alias}-next`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "模型路由创建失败");
    } finally {
      setBusy(false);
    }
  }

  const publishLabel = modelRoute
    ? role === "operator"
      ? `无法发布模型路由 ${modelRoute.alias}，需要管理员或开发人员`
      : modelRoute.status === "Active"
        ? `模型路由 ${modelRoute.alias} 已发布`
        : publishing
          ? `正在发布模型路由 ${modelRoute.alias}`
          : `发布模型路由 ${modelRoute.alias}`
    : undefined;
  const createLabel =
    role === "operator"
      ? "无法创建模型路由，需要管理员或开发人员"
      : busy
        ? `正在创建模型路由 ${alias}`
        : `创建模型路由 ${alias}`;

  return (
    <Panel eyebrow="Model Route" title="模型路由">
      {modelRoute ? (
        <>
          <div className="model-summary">
            <div>
              <span>默认别名</span>
              <strong>{modelRoute.alias}</strong>
              <p>{modelRoute.scenario}</p>
            </div>
            <StatusBadge tone={toneForStatus(modelRoute.status)}>{modelRoute.status}</StatusBadge>
          </div>

          <div className="model-checks">
            <article>
              <span>主模型</span>
              <strong>{modelRoute.primary}</strong>
              <p>默认供应商模型</p>
              <StatusDot tone="good" />
            </article>
            <article>
              <span>兜底模型</span>
              <strong>{modelRoute.fallback}</strong>
              <p>失败切换目标</p>
              <StatusDot tone="watch" />
            </article>
          </div>

          <div className="application-actions">
            <button
              aria-label={publishLabel}
              className="button button--primary"
              disabled={publishing || modelRoute.status === "Active" || role === "operator"}
              onClick={() => void onPublish(modelRoute.id)}
              title={role === "operator" ? "运维人员只读模型路由发布配置" : undefined}
              type="button"
            >
              {modelRoute.status === "Active" ? "已发布" : publishing ? "发布中" : "发布模型路由"}
              <ChevronRight aria-hidden="true" size={16} />
            </button>
            {role === "operator" ? <ActionHint>需要管理员或开发人员发布模型路由。</ActionHint> : null}
          </div>
        </>
      ) : (
        <EmptyPanel description="创建模型别名后，LLM 调用会通过 alias 进入路由策略。" title="暂无模型路由" />
      )}

      <form aria-busy={busy} className="model-route-form" onSubmit={handleSubmit}>
        <fieldset disabled={busy || role === "operator"}>
          <label>
            <span>别名</span>
            <input ref={aliasInputRef} onChange={(event) => setAlias(event.target.value)} required value={alias} />
          </label>
          <label>
            <span>场景</span>
            <input onChange={(event) => setScenario(event.target.value)} required value={scenario} />
          </label>
          <label>
            <span>主模型</span>
            <input onChange={(event) => setPrimary(event.target.value)} required value={primary} />
          </label>
          <label>
            <span>兜底模型</span>
            <input onChange={(event) => setFallback(event.target.value)} required value={fallback} />
          </label>
        </fieldset>
        {error ? (
          <p aria-live="polite" className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button
          aria-label={createLabel}
          aria-live="polite"
          className="button button--primary"
          disabled={busy || role === "operator"}
          title={role === "operator" ? "运维人员只读模型路由创建配置" : undefined}
          type="submit"
        >
          {busy ? "创建中" : "创建模型路由"}
        </button>
        {role === "operator" ? <ActionHint>需要管理员或开发人员创建模型路由。</ActionHint> : null}
      </form>
    </Panel>
  );
}

function buildSkillInvokeInput(skill: SkillBinding, text: string): SkillInvokeInput["input"] {
  switch (skill.name) {
    case "search-knowledge":
      return { query: text };
    case "generate-image":
      return { prompt: text };
    default:
      return { text };
  }
}

function SkillBindingPanel({
  onCreate,
  onInvoked,
  onPublish,
  publishing,
  role,
  skill,
}: {
  onCreate: (input: CreateSkillBindingInput) => Promise<void>;
  onInvoked: () => Promise<unknown>;
  onPublish: (id: string) => Promise<void>;
  publishing: boolean;
  role: RoleId;
  skill?: SkillBinding;
}) {
  const [name, setName] = useState("summarize-ticket");
  const [protocol, setProtocol] = useState("HTTP");
  const [route, setRoute] = useState("/api/v1/skills/summarize");
  const [timeout, setTimeoutValue] = useState("8s");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [invokeText, setInvokeText] = useState("查询客户退款政策");
  const [invokeBusy, setInvokeBusy] = useState(false);
  const [invokeError, setInvokeError] = useState("");
  const [invokeResult, setInvokeResult] = useState<SkillInvokeResponse>();
  const nameInputRef = useInitialFocus<HTMLInputElement>(role !== "operator");
  const publishLabel = skill
    ? role === "operator"
      ? `无法发布 Skill ${skill.name}，需要管理员或开发人员`
      : skill.status === "Published"
        ? `Skill ${skill.name} 已发布`
        : publishing
          ? `正在发布 Skill ${skill.name}`
          : `发布 Skill ${skill.name}`
    : undefined;
  const createLabel =
    role === "operator"
      ? "无法创建 Skill 绑定，需要管理员或开发人员"
      : busy
        ? `正在创建 Skill 绑定 ${name}`
        : `创建 Skill 绑定 ${name}`;
  const canInvokeSkill = Boolean(skill && skill.status === "Published" && role !== "operator");
  const invokeDisabledReason = !skill
    ? "暂无可调用 Skill"
    : role === "operator"
      ? "运维人员只读 Skill 调用结果与日志"
      : skill.status !== "Published"
        ? "发布后才能调用 Skill"
        : undefined;
  const invokeLabel = !skill
    ? "暂无可调用 Skill"
    : invokeBusy
      ? `正在调用 Skill ${skill.name}`
      : `调用 Skill ${skill.name}`;
  const invokeSummary =
    typeof invokeResult?.output.summary === "string" ? invokeResult.output.summary : "Skill 调用已完成";
  const invokeInputKeys = Array.isArray(invokeResult?.output.inputKeys)
    ? invokeResult.output.inputKeys.filter((key): key is string => typeof key === "string").join(", ")
    : "";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await onCreate({ name, protocol, route, timeout });
      setName(`${name}-next`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Skill 绑定创建失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleInvokeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!skill || !canInvokeSkill) {
      return;
    }

    setInvokeBusy(true);
    setInvokeError("");

    try {
      const response = await invokeSkill({ name: skill.name, input: buildSkillInvokeInput(skill, invokeText) }, role);
      setInvokeResult(response);
      await onInvoked();
    } catch (err) {
      setInvokeError(err instanceof Error ? err.message : "Skill 调用失败");
    } finally {
      setInvokeBusy(false);
    }
  }

  return (
    <Panel eyebrow="Skill" title="Skill 绑定">
      {skill ? (
        <>
          <div className="skill-summary">
            <div>
              <span>当前 Skill</span>
              <strong>{skill.name}</strong>
              <p>{skill.route}</p>
            </div>
            <StatusBadge tone={toneForStatus(skill.status)}>{skill.status}</StatusBadge>
          </div>

          <div className="skill-checks">
            <article>
              <span>协议</span>
              <strong>{skill.protocol}</strong>
              <p>调用协议</p>
              <StatusDot tone="neutral" />
            </article>
            <article>
              <span>超时</span>
              <strong>{skill.timeout}</strong>
              <p>治理超时</p>
              <StatusDot tone="watch" />
            </article>
            <article>
              <span>Schema</span>
              <strong>{skill.schemaVersion || "0.1"}</strong>
              <p>输入版本</p>
              <StatusDot tone="neutral" />
            </article>
          </div>

          <div className="application-actions">
            <button
              aria-label={publishLabel}
              className="button button--primary"
              disabled={publishing || skill.status === "Published" || role === "operator"}
              onClick={() => void onPublish(skill.id)}
              title={role === "operator" ? "运维人员只读 Skill 发布配置" : undefined}
              type="button"
            >
              {skill.status === "Published" ? "已发布" : publishing ? "发布中" : "发布 Skill"}
              <ChevronRight aria-hidden="true" size={16} />
            </button>
            {role === "operator" ? <ActionHint>需要管理员或开发人员发布 Skill。</ActionHint> : null}
          </div>

          <form aria-busy={invokeBusy} className="skill-invoke-form" onSubmit={handleInvokeSubmit}>
            <fieldset disabled={invokeBusy || !canInvokeSkill}>
              <label>
                <span>调用输入</span>
                <textarea onChange={(event) => setInvokeText(event.target.value)} rows={3} value={invokeText} />
              </label>
            </fieldset>
            {invokeError ? (
              <p aria-live="polite" className="form-error" role="alert">
                {invokeError}
              </p>
            ) : null}
            <button
              aria-label={invokeLabel}
              aria-live="polite"
              className="button button--primary"
              disabled={invokeBusy || !canInvokeSkill}
              title={invokeDisabledReason}
              type="submit"
            >
              {invokeBusy ? "调用中" : "调用 Skill"}
              <ChevronRight aria-hidden="true" size={16} />
            </button>
            {invokeDisabledReason ? <ActionHint>{invokeDisabledReason}</ActionHint> : null}
          </form>

          {invokeResult ? (
            <div
              aria-label={`Skill 调用结果：${invokeResult.name} ${invokeResult.protocol}，${invokeResult.usage.skillCalls} calls`}
              className="invoke-result"
              role="status"
            >
              <span>{invokeResult.protocol}</span>
              <strong>{invokeResult.name}</strong>
              <p>{invokeSummary}</p>
              <small>
                {invokeResult.route} · {invokeResult.usage.skillCalls} calls
                {invokeInputKeys ? ` · ${invokeInputKeys}` : ""}
              </small>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyPanel description="创建 Skill 绑定后，网关会把它纳入统一调用和治理入口。" title="暂无 Skill" />
      )}

      <form aria-busy={busy} className="skill-binding-form" onSubmit={handleSubmit}>
        <fieldset disabled={busy || role === "operator"}>
          <label>
            <span>名称</span>
            <input ref={nameInputRef} onChange={(event) => setName(event.target.value)} required value={name} />
          </label>
          <label>
            <span>协议</span>
            <select onChange={(event) => setProtocol(event.target.value)} value={protocol}>
              <option value="HTTP">HTTP</option>
              <option value="MCP">MCP</option>
            </select>
          </label>
          <label>
            <span>路由</span>
            <input onChange={(event) => setRoute(event.target.value)} required value={route} />
          </label>
          <label>
            <span>超时</span>
            <input onChange={(event) => setTimeoutValue(event.target.value)} required value={timeout} />
          </label>
        </fieldset>
        {error ? (
          <p aria-live="polite" className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button
          aria-label={createLabel}
          aria-live="polite"
          className="button button--primary"
          disabled={busy || role === "operator"}
          title={role === "operator" ? "运维人员只读 Skill 创建配置" : undefined}
          type="submit"
        >
          {busy ? "创建中" : "创建 Skill 绑定"}
        </button>
        {role === "operator" ? <ActionHint>需要管理员或开发人员创建 Skill 绑定。</ActionHint> : null}
      </form>
    </Panel>
  );
}

function BillingPlanPanel({
  activating,
  onActivate,
  plan,
  role,
}: {
  activating: boolean;
  onActivate: (id: string) => Promise<void>;
  plan?: BillingPlan;
  role: RoleId;
}) {
  if (!plan) {
    return (
      <Panel eyebrow="Plan" title="套餐详情">
        <EmptyPanel description="新增套餐后，这里会展示限流、Token 配额和启用状态。" title="暂无套餐" />
      </Panel>
    );
  }

  const canActivate = role === "admin";
  const checks = [
    { label: "Target", value: plan.target, note: "适用对象", tone: "neutral" },
    { label: "RPS", value: plan.rps, note: "请求速率", tone: "neutral" },
    { label: "Token / day", value: plan.tokenPerDay, note: "每日额度", tone: "watch" },
  ] as const;
  const activateLabel = !canActivate
    ? `无法启用套餐 ${plan.name}，需要管理员权限`
    : plan.status === "Active"
      ? `套餐 ${plan.name} 已启用`
      : activating
        ? `正在启用套餐 ${plan.name}`
        : `启用套餐 ${plan.name}`;

  return (
    <Panel eyebrow="Plan" title="套餐详情">
      <div className="plan-summary">
        <div>
          <span>当前套餐</span>
          <strong>{plan.name}</strong>
          <p>{canActivate ? "管理员可启用套餐" : "当前角色只读计费配置"}</p>
        </div>
        <StatusBadge tone={toneForStatus(plan.status)}>{plan.status}</StatusBadge>
      </div>

      <div className="plan-checks">
        {checks.map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.note}</p>
            <StatusDot tone={item.tone} />
          </article>
        ))}
      </div>

      <div className="application-actions">
        <button
          aria-label={activateLabel}
          className="button button--primary"
          disabled={!canActivate || activating || plan.status === "Active"}
          onClick={() => void onActivate(plan.id)}
          title={!canActivate ? "启用套餐需要管理员权限" : undefined}
          type="button"
        >
          {plan.status === "Active" ? "已启用" : activating ? "启用中" : "启用套餐"}
          <ChevronRight aria-hidden="true" size={16} />
        </button>
        {!canActivate ? <ActionHint>需要管理员启用或变更套餐。</ActionHint> : null}
      </div>
    </Panel>
  );
}

function BudgetAlertPanel({
  alert,
  onResolve,
  resolving,
  role,
}: {
  alert?: BudgetAlert;
  onResolve: (id: string) => Promise<void>;
  resolving: boolean;
  role: RoleId;
}) {
  if (!alert) {
    return (
      <Panel eyebrow="预算" title="预算告警">
        <EmptyPanel description="创建套餐或预算规则后，这里会展示水位和处理动作。" title="暂无预算规则" />
      </Panel>
    );
  }

  const canResolve = role === "admin" || role === "operator";
  const resolved = alert.status === "Resolved" || alert.status === "Normal";
  const resolveLabel = !canResolve
    ? `无法处理 ${alert.project} 的预算告警，需要管理员或运维人员`
    : resolved
      ? `${alert.project} 的预算告警已处理`
      : resolving
        ? `正在处理 ${alert.project} 的预算告警`
        : `处理 ${alert.project} 的预算告警`;

  return (
    <Panel eyebrow="预算" title="预算告警">
      <div className="budget-alert-summary">
        <div>
          <span>当前告警</span>
          <strong>{alert.project}</strong>
          <p>{alert.current} / {alert.budget}</p>
        </div>
        <StatusBadge tone={toneForStatus(alert.status)}>{alert.status}</StatusBadge>
      </div>

      <div className="budget-alert-checks">
        <article>
          <span>阈值</span>
          <strong>{alert.threshold}</strong>
          <p>触发阈值</p>
          <StatusDot tone={alert.status === "Warning" ? "warn" : "neutral"} />
        </article>
        <article>
          <span>当前用量</span>
          <strong>{alert.current}</strong>
          <p>当前消耗</p>
          <StatusDot tone={alert.status === "Warning" ? "watch" : "good"} />
        </article>
      </div>

      <div className="application-actions">
        <button
          aria-label={resolveLabel}
          className="button button--primary"
          disabled={!canResolve || resolving || resolved}
          onClick={() => void onResolve(alert.id)}
          title={!canResolve ? "处理预算告警需要管理员或运维人员权限" : undefined}
          type="button"
        >
          {resolved ? "已处理" : resolving ? "处理中" : "处理预算告警"}
          <ChevronRight aria-hidden="true" size={16} />
        </button>
        {!canResolve ? <ActionHint>需要管理员或运维人员处理预算告警。</ActionHint> : null}
      </div>
    </Panel>
  );
}

function UserAccessPanel({
  activating,
  onActivate,
  role,
  user,
}: {
  activating: boolean;
  onActivate: (id: string) => Promise<void>;
  role: RoleId;
  user?: ControlUser;
}) {
  if (!user) {
    return (
      <Panel eyebrow="User" title="用户详情">
        <EmptyPanel description="邀请用户后，这里会展示角色、MFA、状态和激活动作。" title="暂无用户" />
      </Panel>
    );
  }

  const canActivate = role === "admin";
  const checks = [
    { label: "组织", value: displayOrg(user.org), note: "组织归属", tone: "neutral" },
    { label: "角色", value: displayRoleName(user.role), note: "访问边界", tone: "neutral" },
    { label: "MFA", value: displayStatus(user.mfa), note: "登录安全", tone: user.mfa === "Enabled" ? "good" : "watch" },
  ] as const;
  const activateLabel = !canActivate
    ? `无法激活用户 ${user.email}，需要管理员权限`
    : user.status === "Active"
      ? `用户 ${user.email} 已激活`
      : activating
        ? `正在激活用户 ${user.email}`
        : `激活用户 ${user.email}`;

  return (
    <Panel eyebrow="User" title="用户详情">
      <div className="user-summary">
        <div>
          <span>当前用户</span>
          <strong>{user.email}</strong>
          <p>{canActivate ? "管理员可激活邀请用户" : "当前角色只读用户配置"}</p>
        </div>
        <StatusBadge tone={toneForStatus(user.status)}>{user.status}</StatusBadge>
      </div>

      <div className="user-checks">
        {checks.map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.note}</p>
            <StatusDot tone={item.tone} />
          </article>
        ))}
      </div>

      <div className="application-actions">
        <button
          aria-label={activateLabel}
          className="button button--primary"
          disabled={!canActivate || activating || user.status === "Active"}
          onClick={() => void onActivate(user.id)}
          title={!canActivate ? "激活用户需要管理员权限" : undefined}
          type="button"
        >
          {user.status === "Active" ? "已激活" : activating ? "激活中" : "激活用户"}
          <ChevronRight aria-hidden="true" size={16} />
        </button>
        {!canActivate ? <ActionHint>需要管理员激活用户邀请。</ActionHint> : null}
      </div>
    </Panel>
  );
}

function APIKeyPanel({
  apiKey,
  onRevoke,
  revoking,
  role,
}: {
  apiKey?: APIKey;
  onRevoke: (id: string) => Promise<void>;
  revoking: boolean;
  role: RoleId;
}) {
  if (!apiKey) {
    return (
      <Panel eyebrow="API Key" title="密钥详情">
        <EmptyPanel description="创建接入应用后，这里会展示 API Key、scope、项目归属和撤销动作。" title="暂无 API Key" />
      </Panel>
    );
  }

  const canRevoke = role === "admin";
  const keyLabel = apiKey.maskedPreview || apiKey.name;
  const lifecycleValue = apiKey.revokedAt || apiKey.rotatedAt || apiKey.expiresAt || "未设置";
  const lifecycleNote = apiKey.revokedAt ? "吊销时间" : apiKey.rotatedAt ? "轮换时间" : "到期时间";
  const checks = [
    { label: "项目", value: apiKey.project, note: "项目归属", tone: "neutral" },
    { label: "授权范围", value: apiKey.scope, note: "API Key scope", tone: "neutral" },
    { label: "到期时间", value: apiKey.expiresAt || "未设置", note: "失效控制", tone: "neutral" },
    { label: "最近使用", value: apiKey.lastUsedAt || "暂无调用", note: "调用审计", tone: "neutral" },
    { label: "生命周期", value: lifecycleValue, note: lifecycleNote, tone: "watch" },
  ] as const;
  const revokeLabel = !canRevoke
    ? `无法撤销 API Key ${keyLabel}，需要管理员权限`
    : apiKey.status === "Revoked"
      ? `API Key ${keyLabel} 已撤销`
      : revoking
        ? `正在撤销 API Key ${keyLabel}`
        : `撤销 API Key ${keyLabel}`;

  return (
    <Panel eyebrow="API Key" title="密钥详情">
      <div className="api-key-summary">
        <div>
          <span>当前密钥</span>
          <strong>{keyLabel}</strong>
          <p>{canRevoke ? "管理员可撤销密钥" : "当前角色只读 API Key"}</p>
        </div>
        <StatusBadge tone={toneForStatus(apiKey.status)}>{apiKey.status}</StatusBadge>
      </div>

      <div className="api-key-checks">
        {checks.map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.note}</p>
            <StatusDot tone={item.tone} />
          </article>
        ))}
      </div>

      <div className="application-actions">
        <button
          aria-label={revokeLabel}
          className="button button--primary"
          disabled={!canRevoke || revoking || apiKey.status === "Revoked"}
          onClick={() => void onRevoke(apiKey.id)}
          title={!canRevoke ? "撤销 API Key 需要管理员权限" : undefined}
          type="button"
        >
          {apiKey.status === "Revoked" ? "已撤销" : revoking ? "撤销中" : "撤销 API Key"}
          <ChevronRight aria-hidden="true" size={16} />
        </button>
        {!canRevoke ? <ActionHint>需要管理员撤销 API Key。</ActionHint> : null}
      </div>
    </Panel>
  );
}

function CredentialRefPanel({
  credential,
  onRotate,
  role,
  rotating,
}: {
  credential?: Credential;
  onRotate: (id: string) => Promise<void>;
  role: RoleId;
  rotating: boolean;
}) {
  if (!credential) {
    return (
      <Panel eyebrow="Credential" title="凭据详情">
        <EmptyPanel description="接入供应商 Key 后，这里会展示 credentialRef、scope、脱敏预览和轮换动作。" title="暂无凭据引用" />
      </Panel>
    );
  }

  const canRotate = role === "admin";
  const credentialPreview = credential.maskedPreview || "未配置";
  const checks = [
    { label: "用途", value: credential.purpose, note: "凭据用途", tone: "neutral" },
    { label: "绑定范围", value: credential.scope, note: "credential scope", tone: "neutral" },
    { label: "脱敏预览", value: credentialPreview, note: "安全展示", tone: "watch" },
    { label: "轮换时间", value: credential.rotatedAt || "未轮换", note: "生命周期", tone: "neutral" },
  ] as const;
  const rotateLabel = !canRotate
    ? `无法轮换凭据 ${credential.ref}，需要管理员权限`
    : credential.status === "Rotated"
      ? `凭据 ${credential.ref} 已轮换`
      : rotating
        ? `正在轮换凭据 ${credential.ref}`
        : `轮换凭据 ${credential.ref}`;

  return (
    <Panel eyebrow="Credential" title="凭据详情">
      <div className="credential-summary">
        <div>
          <span>当前凭据</span>
          <strong>{credential.ref}</strong>
          <p>{credential.expiresAt ? `到期时间 ${credential.expiresAt}` : "未配置到期时间"}</p>
        </div>
        <StatusBadge tone={toneForStatus(credential.status)}>{credential.status}</StatusBadge>
      </div>

      <div className="credential-checks">
        {checks.map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.note}</p>
            <StatusDot tone={item.tone} />
          </article>
        ))}
      </div>

      <div className="application-actions">
        <button
          aria-label={rotateLabel}
          className="button button--primary"
          disabled={!canRotate || rotating || credential.status === "Rotated"}
          onClick={() => void onRotate(credential.id)}
          title={!canRotate ? "轮换凭据需要管理员权限" : undefined}
          type="button"
        >
          {credential.status === "Rotated" ? "已轮换" : rotating ? "轮换中" : "轮换凭据"}
          <ChevronRight aria-hidden="true" size={16} />
        </button>
        {!canRotate ? <ActionHint>需要管理员轮换供应商凭据。</ActionHint> : null}
      </div>
    </Panel>
  );
}

function LLMInvokePanel({
  autoFocus = false,
  modelRoutes,
  onInvoked,
  role,
}: {
  autoFocus?: boolean;
  modelRoutes?: ModelRoute[];
  onInvoked: () => Promise<unknown>;
  role: RoleId;
}) {
  const [modelAlias, setModelAlias] = useState("chat-default");
  const [input, setInput] = useState("帮我生成一段客服欢迎语");
  const [result, setResult] = useState<LLMInvokeResponse>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const modelAliasSelectRef = useInitialFocus<HTMLSelectElement>(autoFocus);
  const aliases = modelRoutes?.length
    ? modelRoutes.map((route) => route.alias)
    : ["chat-default", "embedding-default"];
  const invokeLabel = busy ? `正在调用模型 ${modelAlias}` : `调用模型 ${modelAlias}`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await invokeLLM({ modelAlias, input }, role);
      setResult(response);
      await onInvoked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "调用失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel eyebrow="LLM" title="调用测试">
      <form aria-busy={busy} className="invoke-form" onSubmit={handleSubmit}>
        <fieldset disabled={busy}>
          <label>
            <span>模型别名</span>
            <select ref={modelAliasSelectRef} onChange={(event) => setModelAlias(event.target.value)} value={modelAlias}>
              {aliases.map((alias) => (
                <option key={alias} value={alias}>
                  {alias}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>输入内容</span>
            <textarea onChange={(event) => setInput(event.target.value)} rows={4} value={input} />
          </label>
        </fieldset>
        {error ? (
          <p aria-live="polite" className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button aria-label={invokeLabel} aria-live="polite" className="button button--primary" disabled={busy} type="submit">
          {busy ? "调用中" : "发送调用"}
        </button>
      </form>

      {result ? (
        <div
          aria-label={`LLM 调用结果：${result.provider} ${result.model}，兜底 ${result.fallback}，${result.usage.totalTokens} tokens`}
          className="invoke-result"
          role="status"
        >
          <span>{result.provider}</span>
          <strong>{result.model}</strong>
          <p>{result.content}</p>
          <small>
            兜底 {result.fallback} · {result.usedFallback ? "已启用" : "待命"} ·{" "}
            {result.usage.totalTokens} tokens
          </small>
        </div>
      ) : null}
    </Panel>
  );
}

function MetricGrid({ metrics }: { metrics: MetricItem[] }) {
  return (
    <section className="metric-grid" aria-label="关键指标">
      {metrics.map((metric) => (
        <article
          aria-label={`${metric.label}：${metric.value}，${metric.note}，状态 ${metric.tone || "neutral"}`}
          className="metric-card"
          key={metric.label}
        >
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
          <p>{metric.note}</p>
          {metric.tone ? <StatusDot tone={metric.tone} /> : null}
        </article>
      ))}
    </section>
  );
}

function ModuleSummaryStrip({
  activeTab,
  metrics,
  recordCount,
  visibleCount,
}: {
  activeTab: string;
  metrics: MetricItem[];
  recordCount: number;
  visibleCount: number;
}) {
  const primaryMetric = metrics[0] || { label: "模块状态", value: "正常", note: "等待后端同步" };
  const secondaryMetric = metrics[1] || primaryMetric;
  const summaryItems = [
    { label: "当前视图", value: activeTab, note: `${visibleCount} / ${recordCount} 条记录` },
    primaryMetric,
    secondaryMetric,
  ];

  return (
    <section aria-label="模块状态摘要" className="module-summary-strip">
      {summaryItems.map((item) => (
        <article aria-label={`${item.label}：${item.value}，${item.note}`} key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <p>{item.note}</p>
        </article>
      ))}
    </section>
  );
}

function ModuleFocusBar({
  activeTab,
  recordCount,
  steps,
  visibleCount,
}: {
  activeTab: string;
  recordCount: number;
  steps: WorkflowStep[];
  visibleCount: number;
}) {
  const activeIndex = Math.max(
    0,
    steps.findIndex((step) => step.tab === activeTab),
  );
  const activeStep = steps[activeIndex] || steps[0];
  const nextStep = steps[activeIndex + 1];
  const progress = `${activeIndex + 1} / ${steps.length}`;

  return (
    <section
      aria-label={`当前视图重点：${activeStep?.label || activeTab}，${activeStep?.note || "查看模块记录"}`}
      className="module-focus-bar"
    >
      <div>
        <span>{progress}</span>
        <strong>{activeStep?.label || activeTab}</strong>
        <p>{activeStep?.note || "查看模块记录与详情动作。"}</p>
      </div>
      <div>
        <span>记录</span>
        <strong>
          {visibleCount} / {recordCount}
        </strong>
        <p>{visibleCount === recordCount ? "当前为完整列表" : "已应用搜索或状态筛选"}</p>
      </div>
      <div>
        <span>下一步</span>
        <strong>{nextStep?.label || "完成"}</strong>
        <p>{nextStep?.note || "当前视图已覆盖主要处理动作。"}</p>
      </div>
    </section>
  );
}

function ModuleWorkflow({ activeTab, steps }: { activeTab: string; steps: WorkflowStep[] }) {
  const activeIndex = Math.max(
    0,
    steps.findIndex((step) => step.tab === activeTab),
  );

  return (
    <section className="workflow-strip" aria-label="模块工作流">
      {steps.map((step, index) => {
        const state = index < activeIndex ? "done" : index === activeIndex ? "active" : "next";
        const stateLabel = state === "done" ? "已完成" : state === "active" ? "当前步骤" : "下一步";

        return (
          <article
            aria-label={`${step.label}：${stateLabel}，${step.note}`}
            aria-current={state === "active" ? "step" : undefined}
            className={`workflow-step workflow-step--${state}`}
            key={step.label}
          >
            <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <strong>{step.label}</strong>
              <p>{step.note}</p>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function Panel({
  children,
  className = "",
  eyebrow,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <section aria-label={`${eyebrow}：${title}`} className={`panel ${className}`}>
      <div className="panel__heading">
        <span>{eyebrow}</span>
        <strong>{title}</strong>
      </div>
      {children}
    </section>
  );
}

function EmptyPanel({ description, title }: { description: string; title: string }) {
  return (
    <div aria-label={`${title}：${description}`} className="empty-panel" role="status">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function DataTable({
  ariaLabel,
  columns,
  emptyDescription,
  emptyTitle,
  onRowSelect,
  onSort,
  rows,
  selectedRowId,
  sort,
}: {
  ariaLabel: string;
  columns: string[];
  emptyDescription: string;
  emptyTitle: string;
  onRowSelect?: (id: string) => void;
  onSort: (columnIndex: number) => void;
  rows: TableRow[];
  selectedRowId?: string;
  sort: TableSortState;
}) {
  return (
    <div className="table-wrap">
      <table aria-label={ariaLabel}>
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th
                aria-sort={
                  sort.columnIndex === index ? (sort.direction === "asc" ? "ascending" : "descending") : "none"
                }
                key={column}
              >
                <button
                  aria-label={`${column} 排序，当前${
                    sort.columnIndex === index ? (sort.direction === "asc" ? "升序" : "降序") : "未排序"
                  }`}
                  className={sort.columnIndex === index ? "table-sort-button is-active" : "table-sort-button"}
                  onClick={() => onSort(index)}
                  type="button"
                >
                  <span>{column}</span>
                  <ArrowDownUp aria-hidden="true" size={13} />
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const selected = row.id === selectedRowId;

            return (
              <tr
                aria-label={onRowSelect ? `选择 ${row.cells[0]}${selected ? "，当前选中" : ""}` : undefined}
                aria-selected={onRowSelect ? selected : undefined}
                className={selected ? "is-selected" : ""}
                key={row.id}
                onClick={onRowSelect ? () => onRowSelect(row.id) : undefined}
                onKeyDown={
                  onRowSelect
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onRowSelect(row.id);
                        }
                      }
                    : undefined
                }
                tabIndex={onRowSelect ? 0 : undefined}
              >
                {row.cells.map((cell, index) => (
                  <td className={index === 0 ? "table-cell--primary" : undefined} key={`${row.id}-${cell}`}>
                    {index === row.cells.length - 1 ? (
                      <StatusBadge tone={row.tone}>{cell}</StatusBadge>
                    ) : (
                      cell
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
          {rows.length === 0 ? (
            <tr>
              <td className="empty-cell" colSpan={columns.length}>
                <div aria-label={`${emptyTitle}：${emptyDescription}`} role="status">
                  <strong>{emptyTitle}</strong>
                  <p>{emptyDescription}</p>
                </div>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function TablePagination({
  onPageChange,
  onPageSizeChange,
  pageCount,
  pageEnd,
  pageIndex,
  pageSize,
  pageStart,
  rowCount,
}: {
  onPageChange: (pageIndex: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageCount: number;
  pageEnd: number;
  pageIndex: number;
  pageSize: number;
  pageStart: number;
  rowCount: number;
}) {
  const previousDisabled = pageIndex <= 0 || rowCount === 0;
  const nextDisabled = pageIndex >= pageCount - 1 || rowCount === 0;

  return (
    <div aria-label="表格分页" className="table-pagination">
      <p className="table-pagination__summary" role="status">
        {rowCount ? `第 ${pageStart}-${pageEnd} 条，共 ${rowCount} 条` : "没有符合条件的记录"}
      </p>
      <div className="table-pagination__controls">
        <label>
          <span>每页</span>
          <select
            aria-label="每页记录数"
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            value={pageSize}
          >
            {tablePageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <button
          aria-label="上一页"
          className="pagination-button"
          disabled={previousDisabled}
          onClick={() => onPageChange(Math.max(0, pageIndex - 1))}
          type="button"
        >
          <ChevronLeft aria-hidden="true" size={15} />
        </button>
        <span aria-label={`当前第 ${pageIndex + 1} 页，共 ${pageCount} 页`} className="table-pagination__page">
          {pageIndex + 1} / {pageCount}
        </span>
        <button
          aria-label="下一页"
          className="pagination-button"
          disabled={nextDisabled}
          onClick={() => onPageChange(Math.min(pageCount - 1, pageIndex + 1))}
          type="button"
        >
          <ChevronRight aria-hidden="true" size={15} />
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ children, tone }: { children: React.ReactNode; tone: StatusTone }) {
  const label = typeof children === "string" ? displayStatus(children) : children;

  return (
    <span aria-label={`状态：${label}`} className={`status status--${tone}`}>
      {label}
    </span>
  );
}

function StatusDot({ tone }: { tone: StatusTone }) {
  if (tone === "good") {
    return <CheckCircle2 aria-hidden="true" className={`status-dot status-dot--${tone}`} size={16} />;
  }

  return <CircleAlert aria-hidden="true" className={`status-dot status-dot--${tone}`} size={16} />;
}

function ActionHint({ children }: { children: React.ReactNode }) {
  return (
    <p aria-label={`权限提示：${children}`} className="action-hint" role="note">
      {children}
    </p>
  );
}

function toneForStatus(status = ""): StatusTone {
  const normalized = status.toLowerCase();

  if (["active", "success", "normal", "ready", "published", "resolved", "已就绪"].includes(normalized)) {
    return "good";
  }

  if (["warning", "degraded", "expiring"].includes(normalized)) {
    return "warn";
  }

  if (["watching", "pending", "draft", "guarded", "invited", "provisioning"].includes(normalized)) {
    return "watch";
  }

  return "neutral";
}

function displayStatus(status = "") {
  const labels: Record<string, string> = {
    Active: "运行中",
    Blocked: "已阻断",
    Degraded: "降级中",
    Draft: "草稿",
    Enabled: "已启用",
    Error: "异常",
    Expiring: "即将过期",
    Failed: "失败",
    Guarded: "受保护",
    Healthy: "健康",
    Invited: "已邀请",
    Normal: "正常",
    Pending: "待处理",
    Provisioning: "配置中",
    Published: "已发布",
    Ready: "已就绪",
    Required: "需配置",
    Resolved: "已处理",
    Success: "成功",
    Suspended: "已暂停",
    Waiting: "等待中",
    Warning: "预警",
    Watching: "观察中",
    "已就绪": "已就绪",
  };

  return labels[status] || status;
}

function displayRoleName(role = "") {
  const labels: Record<string, string> = {
    Administrator: "管理员",
    Developer: "开发人员",
    Operator: "运维人员",
    User: "使用用户",
  };

  return labels[role] || role;
}

function displayOrg(org = "") {
  const labels: Record<string, string> = {
    Engineering: "工程团队",
    Operations: "运维团队",
    Platform: "平台管理",
  };

  return labels[org] || org;
}

function nextStepForStatus(status = "") {
  const normalized = status.toLowerCase();

  if (["warning", "degraded", "expiring"].includes(normalized)) {
    return "优先处理";
  }

  if (["pending", "draft", "invited", "provisioning", "watching", "guarded"].includes(normalized)) {
    return "继续推进";
  }

  if (["active", "success", "normal", "ready", "published", "resolved", "已就绪"].includes(normalized)) {
    return "保持观察";
  }

  return "查看上下文";
}

export default App;
