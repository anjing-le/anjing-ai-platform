import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Copy,
  RefreshCw,
  Search,
} from "lucide-react";
import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ActionDialog, type ActionMode, type ActionValues } from "./components/ActionDialog";
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
    { label: "用量", note: "追踪项目用量", tab: "用量" },
    { label: "预算", note: "处理预算告警", tab: "预算告警" },
  ],
  docs: [
    { label: "开始", note: "创建接入应用", tab: "Quickstart" },
    { label: "边界", note: "确认服务归属", tab: "服务边界" },
    { label: "参考", note: "查看 API 边界", tab: "API 文档" },
    { label: "帮助", note: "排查常见问题", tab: "FAQ" },
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

function App() {
  const [route, setRoute] = useState<ConsoleRoute | "landing">(parseRoute);
  const [role, setRole] = useState<RoleId>("admin");
  const [snapshot, setSnapshot] = useState<PlatformSnapshot>();
  const [apiState, setApiState] = useState<ApiState>("loading");
  const [apiDetail, setApiDetail] = useState("正在连接 Go API");
  const [lastSyncedAt, setLastSyncedAt] = useState("");
  const [refreshingSnapshot, setRefreshingSnapshot] = useState(false);
  const [actionMode, setActionMode] = useState<ActionMode | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
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
      setApiDetail(result.source === "aggregate" ? "聚合快照 · ops-api" : `分组接口 · ${result.loaded} connected`);
    } else {
      setApiState("fallback");
      setApiDetail("本地演示数据 · console fallback");
    }

    setLastSyncedAt(formatSyncTime(new Date()));

    return result;
  }, [role]);

  async function handleManualRefresh() {
    setRefreshingSnapshot(true);
    setApiState("loading");
    setApiDetail("正在刷新平台数据");

    try {
      const result = await refreshSnapshot();
      setNotice(result.ok ? "平台数据已刷新。" : "后端未连接，已切换到本地演示数据。");
    } catch {
      setApiState("fallback");
      setApiDetail("刷新失败 · 本地演示数据");
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
        setApiDetail("本地演示数据 · console fallback");
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
    setNotice("");
    setRotatingApplicationId(id);

    try {
      const application = await rotateApplicationKey(id, role);
      await refreshSnapshot();
      setSelectedApplicationId(application.id);
      setNotice(`已轮换 API Key：${application.name}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "API Key 轮换失败");
    } finally {
      setRotatingApplicationId("");
    }
  }

  async function handleRoutePublish(id: string) {
    setNotice("");
    setPublishingRouteId(id);

    try {
      const route = await publishRoute(id, role);
      await refreshSnapshot();
      setSelectedRouteId(route.id);
      setNotice(`已发布路由：${route.route}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "路由发布失败");
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
    setNotice("");
    setPublishingModelRouteId(id);

    try {
      const modelRoute = await publishModelRoute(id, role);
      await refreshSnapshot();
      setSelectedModelRouteId(modelRoute.id);
      setNotice(`已发布模型路由：${modelRoute.alias}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "模型路由发布失败");
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
    setNotice("");
    setPublishingSkillId(id);

    try {
      const skill = await publishSkillBinding(id, role);
      await refreshSnapshot();
      setSelectedSkillId(skill.id);
      setNotice(`已发布 Skill 绑定：${skill.name}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Skill 绑定发布失败");
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
    setNotice("");
    setActivatingPlanId(id);

    try {
      const plan = await activatePlan(id, role);
      await refreshSnapshot();
      setSelectedPlanId(plan.id);
      setNotice(`已启用套餐：${plan.name}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "套餐启用失败");
    } finally {
      setActivatingPlanId("");
    }
  }

  async function handleBudgetAlertResolve(id: string) {
    setNotice("");
    setResolvingBudgetAlertId(id);

    try {
      const alert = await resolveBudgetAlert(id, role);
      await refreshSnapshot();
      setSelectedBudgetAlertId(alert.id);
      setNotice(`已处理预算告警：${alert.project}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "预算告警处理失败");
    } finally {
      setResolvingBudgetAlertId("");
    }
  }

  async function handleCredentialRotate(id: string) {
    setNotice("");
    setRotatingCredentialId(id);

    try {
      const credential = await rotateCredential(id, role);
      await refreshSnapshot();
      setSelectedCredentialId(credential.id);
      setNotice(`已轮换凭据：${credential.ref}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "凭据轮换失败");
    } finally {
      setRotatingCredentialId("");
    }
  }

  async function handleAPIKeyRevoke(id: string) {
    setNotice("");
    setRevokingAPIKeyId(id);

    try {
      const key = await revokeAPIKey(id, role);
      await refreshSnapshot();
      setSelectedAPIKeyId(key.id);
      setNotice(`已撤销 API Key：${key.name}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "API Key 撤销失败");
    } finally {
      setRevokingAPIKeyId("");
    }
  }

  return (
    <>
      <ConsoleShell
        apiDetail={apiDetail}
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
        {children}
      </div>
    </div>
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
      <section className="page-heading">
        <div>
          <p className="eyebrow">Console Home</p>
          <h2>后台首页</h2>
          <p>
            用这页先看清平台是否正常、当前角色能做什么、哪些模块需要进入，以及后端服务下一步怎么拆。
          </p>
        </div>
        <a aria-label="进入帮助文档开始接入" className="button button--primary" href={routeHash.docs}>
          开始接入
          <ChevronRight aria-hidden="true" size={16} />
        </a>
      </section>

      <MetricGrid metrics={metrics} />

      {notice ? (
        <p aria-live="polite" className="inline-notice" role="status">
          {notice}
        </p>
      ) : null}

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
                    <item.icon aria-hidden="true" size={21} />
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
                  <div className="chip-row">
                    {item.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
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
        <Panel title="当前角色视角" eyebrow="访问">
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
    setSelectedRowId("");
  }, [page.id, page.tabs]);

  useEffect(() => {
    setQuery("");
    setStatus("全部状态");
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
        columns: ["名称", "项目", "授权范围", "到期时间", "状态"],
        rows: (snapshot?.apiKeys || []).map((key) => ({
          id: key.id,
          cells: [key.name, key.project, key.scope, key.expiresAt || "未设置", key.status],
          status: key.status,
          tone: toneForStatus(key.status),
        })),
      };
    }

    if (page.id === "iam" && activeTab === "凭据") {
      return {
        eyebrow: "凭据",
        title: "凭据引用",
        columns: ["引用", "用途", "绑定范围", "到期时间", "状态"],
        rows: (snapshot?.credentials || []).map((credential) => ({
          id: credential.id,
          cells: [
            credential.ref,
            credential.purpose,
            credential.scope,
            credential.expiresAt || "未设置",
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

    if (page.id === "docs" && activeTab === "API 文档") {
      const routeRows: TableRow[] = (snapshot?.routes || []).map((route) => ({
        id: `doc-route-${route.id}`,
        cells: [route.route, "API Route", route.auth, route.limit, route.status],
        status: route.status,
        tone: toneForStatus(route.status),
      }));
      const modelRows: TableRow[] = (snapshot?.modelRoutes || []).map((route) => ({
        id: `doc-model-${route.id}`,
        cells: [route.alias, "模型别名", route.primary, route.fallback, route.status],
        status: route.status,
        tone: toneForStatus(route.status),
      }));
      const skillRows: TableRow[] = (snapshot?.skills || []).map((skill) => ({
        id: `doc-skill-${skill.id}`,
        cells: [skill.route, `Skill ${skill.protocol}`, skill.name, skill.timeout, skill.status],
        status: skill.status,
        tone: toneForStatus(skill.status),
      }));

      return {
        eyebrow: "API 参考",
        title: "接口参考",
        columns: ["入口", "类型", "主配置", "治理", "状态"],
        rows: [...routeRows, ...modelRows, ...skillRows],
      };
    }

    if (page.id === "docs" && activeTab === "服务边界") {
      return {
        eyebrow: "服务边界",
        title: "服务边界",
        columns: ["后台入口", "归属服务", "API 分组", "职责范围", "状态"],
        rows: consoleServiceMap.map((item) => ({
          id: `service-${item.owner}`,
          cells: [item.entry, item.owner, item.apis.join(" · "), item.scope, "已就绪"],
          status: "已就绪",
          tone: "good",
        })),
      };
    }

    if (page.id === "docs" && activeTab === "FAQ") {
      return {
        eyebrow: "FAQ",
        title: "常见问题",
        columns: ["问题", "处理建议", "模块", "状态"],
        rows: [
          {
            id: "faq-auth",
            cells: ["调用返回 401", "检查 API Key、scope 和 RBAC 角色", "用户与权限", "已就绪"],
            status: "已就绪",
            tone: "good",
          },
          {
            id: "faq-route",
            cells: ["模型别名不可用", "确认模型路由已发布且 fallback 可用", "网关与模型", "已就绪"],
            status: "已就绪",
            tone: "good",
          },
          {
            id: "faq-budget",
            cells: ["预算接近阈值", "查看用量项目并处理预算告警", "计费与配额", "已就绪"],
            status: "已就绪",
            tone: "good",
          },
          {
            id: "faq-sdk",
            cells: ["SDK 如何接入", "先按 OpenAPI 调用，TypeScript / Go 示例保持同一认证边界", "帮助文档", "已就绪"],
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
    snapshot?.budgetAlerts,
    snapshot?.usage,
  ]);

  const statuses = useMemo(
    () => ["全部状态", ...Array.from(new Set(tableView.rows.map((row) => row.status)))],
    [tableView.rows],
  );

  const rows = tableView.rows.filter((row) => {
    const searchableText = [...row.cells, displayStatus(row.status), nextStepForStatus(row.status)].join(" ").toLowerCase();
    const matchesQuery = searchableText.includes(query.toLowerCase());
    const matchesStatus = status === "全部状态" || row.status === status;
    return matchesQuery && matchesStatus;
  });
  const filtersActive = query.trim() !== "" || status !== "全部状态";

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
  const selectedGenericRow = rows.find((row) => row.id === selectedRowId) || rows[0];
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
  if (page.id === "docs" && activeTab === "Quickstart") {
    selectedTableRowId = selectedApplication?.id;
  }
  if (page.id === "docs" && activeTab !== "Quickstart") {
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
  if (page.id === "quota" && activeTab === "用量") {
    selectedTableRowId = selectedRowId;
  }
  if (page.id === "quota" && activeTab === "预算告警") {
    selectedTableRowId = selectedBudgetAlert?.id;
  }

  useEffect(() => {
    if (!rows.length) {
      setSelectedRowId("");
      return;
    }

    const stillVisible = rows.some((row) => row.id === selectedRowId);
    if (!stillVisible) {
      setSelectedRowId(rows[0].id);
    }
  }, [rows, selectedRowId]);

  async function handleSelectedUserActivate(id: string) {
    await onUserActivate(id);
    setSelectedRowId(id);
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

      <MetricGrid metrics={page.metrics} />

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
            <select aria-label={`${page.title} 状态筛选`} onChange={(event) => setStatus(event.target.value)} value={status}>
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {item === "全部状态" ? item : displayStatus(item)}
                </option>
              ))}
            </select>
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
              {rows.length} / {tableView.rows.length} 条记录
            </span>
          </div>
          <DataTable
            ariaLabel={`${page.title}：${tableView.title}`}
            columns={tableView.columns}
            emptyDescription={
              filtersActive ? "清空搜索或状态筛选后，可以回到完整列表。" : "连接后端数据源后，这里会展示当前模块的关键记录。"
            }
            emptyTitle={filtersActive ? "当前筛选没有结果" : "暂无模块记录"}
            onRowSelect={selectableTable ? setSelectedRowId : undefined}
            rows={rows}
            selectedRowId={selectedTableRowId}
          />
        </Panel>

        <div className="side-panels">
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
              onPublish={onSkillBindingPublish}
              publishing={publishingSkillId === selectedSkill?.id}
              role={role}
              skill={selectedSkill}
            />
          ) : null}
          {page.id === "gateway" && (activeTab === "模型路由" || activeTab === "Skill 调用") ? (
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
          {page.id === "quota" && activeTab === "用量" ? (
            <SelectedRowPanel columns={tableView.columns} row={selectedGenericRow} title={tableView.title} />
          ) : null}
          {page.id === "docs" && activeTab === "Quickstart" ? (
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
          {page.id === "docs" && activeTab !== "Quickstart" ? (
            <SelectedRowPanel columns={tableView.columns} row={selectedGenericRow} title={tableView.title} />
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
    <div aria-label="Quickstart 最小接入清单" className="quickstart-checklist">
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

function QuickstartSnippet({ curl }: { curl: string }) {
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
        <span>Quickstart</span>
        <strong>最小调用示例</strong>
      </div>
      <button
        aria-label={`${copyLabel}：Quickstart curl 调用示例`}
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
      <pre aria-label="Quickstart curl 调用示例">
        <code>{curl}</code>
      </pre>
    </div>
  );
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
        <EmptyPanel description="新增路由后，这里会展示鉴权、限流、发布状态和上线动作。" title="暂无路由" />
      </Panel>
    );
  }

  const checks = [
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

function SkillBindingPanel({
  onCreate,
  onPublish,
  publishing,
  role,
  skill,
}: {
  onCreate: (input: CreateSkillBindingInput) => Promise<void>;
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
    { label: "Org", value: user.org, note: "组织归属", tone: "neutral" },
    { label: "Role", value: user.role, note: "访问边界", tone: "neutral" },
    { label: "MFA", value: user.mfa, note: "登录安全", tone: user.mfa === "Enabled" ? "good" : "watch" },
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
  const checks = [
    { label: "项目", value: apiKey.project, note: "项目归属", tone: "neutral" },
    { label: "授权范围", value: apiKey.scope, note: "API Key scope", tone: "neutral" },
    { label: "到期时间", value: apiKey.expiresAt || "未设置", note: "密钥有效期", tone: "watch" },
  ] as const;
  const revokeLabel = !canRevoke
    ? `无法撤销 API Key ${apiKey.name}，需要管理员权限`
    : apiKey.status === "Revoked"
      ? `API Key ${apiKey.name} 已撤销`
      : revoking
        ? `正在撤销 API Key ${apiKey.name}`
        : `撤销 API Key ${apiKey.name}`;

  return (
    <Panel eyebrow="API Key" title="密钥详情">
      <div className="api-key-summary">
        <div>
          <span>当前密钥</span>
          <strong>{apiKey.name}</strong>
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
  const checks = [
    { label: "用途", value: credential.purpose, note: "凭据用途", tone: "neutral" },
    { label: "绑定范围", value: credential.scope, note: "credential scope", tone: "neutral" },
    { label: "脱敏预览", value: credential.maskedPreview, note: "脱敏展示", tone: "watch" },
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
            兜底 {result.fallback} · {result.usage.totalTokens} tokens
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
  rows,
  selectedRowId,
}: {
  ariaLabel: string;
  columns: string[];
  emptyDescription: string;
  emptyTitle: string;
  onRowSelect?: (id: string) => void;
  rows: TableRow[];
  selectedRowId?: string;
}) {
  return (
    <div className="table-wrap">
      <table aria-label={ariaLabel}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
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
                  <td key={`${row.id}-${cell}`}>
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
