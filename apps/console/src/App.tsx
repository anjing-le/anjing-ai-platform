import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Search,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

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
import { canAccessRoute, canRunPrimaryAction, primaryActionHint, visibleNavItems } from "./lib/access";
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
    { label: "Observe", note: "看整体水位", tab: "运营总览" },
    { label: "Triage", note: "定位服务健康", tab: "服务健康" },
    { label: "Review", note: "追踪调用与审计", tab: "调用与审计" },
  ],
  iam: [
    { label: "Invite", note: "创建用户主体", tab: "用户" },
    { label: "Scope", note: "定义角色权限", tab: "角色权限" },
    { label: "Issue", note: "发放 API Key", tab: "API Key" },
    { label: "Secure", note: "管理凭据引用", tab: "凭据" },
  ],
  gateway: [
    { label: "Route", note: "配置 API 入口", tab: "API 路由" },
    { label: "Model", note: "设置模型策略", tab: "模型路由" },
    { label: "Skill", note: "治理 Skill 调用", tab: "Skill 调用" },
    { label: "Audit", note: "查看请求日志", tab: "请求日志" },
  ],
  quota: [
    { label: "Plan", note: "定义套餐配额", tab: "套餐" },
    { label: "Usage", note: "追踪项目用量", tab: "用量" },
    { label: "Budget", note: "处理预算告警", tab: "预算告警" },
  ],
  docs: [
    { label: "Start", note: "创建接入应用", tab: "Quickstart" },
    { label: "Boundary", note: "确认服务归属", tab: "服务边界" },
    { label: "Reference", note: "查看 API 边界", tab: "API 文档" },
    { label: "Support", note: "排查常见问题", tab: "FAQ" },
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

function App() {
  const [route, setRoute] = useState<ConsoleRoute | "landing">(parseRoute);
  const [role, setRole] = useState<RoleId>("admin");
  const [snapshot, setSnapshot] = useState<PlatformSnapshot>();
  const [apiState, setApiState] = useState<ApiState>("loading");
  const [apiDetail, setApiDetail] = useState("正在连接 Go API");
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
      setApiDetail(result.source === "aggregate" ? "聚合快照已连接" : `${result.loaded} 个接口已连接`);
    } else {
      setApiState("fallback");
      setApiDetail("未连接后端，使用页面默认数据");
    }

    return result;
  }, [role]);

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
        setApiDetail("未连接后端，使用页面默认数据");
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
          <span>Audit</span>
        </div>
        <p className="eyebrow">Public open-source infrastructure for AI applications</p>
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
              <a className="architecture-card" href={routeHash[item.id]} key={item.id}>
                <item.icon size={20} />
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
  role: RoleId;
  setRole: (role: RoleId) => void;
  visibleItems: NavItem[];
}

function ConsoleShell({
  activeRoute,
  apiDetail,
  apiState,
  children,
  role,
  setRole,
  visibleItems,
}: ConsoleShellProps) {
  const activeItem = navItems.find((item) => item.id === activeRoute) || navItems[0];
  const activeRole = roles.find((item) => item.id === role) || roles[0];

  return (
    <div className="console-shell">
      <aside className="sidebar">
        <a className="sidebar__brand" href="#">
          <span>Anjing</span>
          <strong>AI Platform</strong>
        </a>
        <nav className="sidebar__nav" aria-label="后台模块">
          {visibleItems.map((item) => (
            <a
              className={item.id === activeRoute ? "sidebar__link is-active" : "sidebar__link"}
              href={routeHash[item.id]}
              key={item.id}
            >
              <item.icon size={17} />
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
            <p className="eyebrow">{activeRole.name} View</p>
            <h1>{activeItem.label}</h1>
          </div>
          <div className="topbar__actions">
            <APIStateBadge detail={apiDetail} state={apiState} />
            <div className="role-switcher" aria-label="角色视角">
              {roles.map((item) => (
                <button
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

function APIStateBadge({ detail, state }: { detail: string; state: ApiState }) {
  const label = state === "live" ? "Live API" : state === "loading" ? "Connecting" : "Mock fallback";
  const note =
    state === "live"
      ? detail
      : state === "loading"
        ? "正在读取平台数据"
        : `${detail} · 页面仍可预览`;

  return (
    <span className={`api-state api-state--${state}`} title={note}>
      <strong>{label}</strong>
      <small>{note}</small>
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
      {modules.map((module) => (
        <div className="role-access-matrix__row" key={module.id}>
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
      ))}
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
  const roleLabel = roles.find((item) => item.id === role)?.label || "管理员";
  const liveTodos = hydrateTodos(snapshot) || todos;
  const canResolveTodo = role === "admin" || role === "operator";

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
        <a className="button button--primary" href={routeHash.docs}>
          开始接入
          <ChevronRight size={16} />
        </a>
      </section>

      <MetricGrid metrics={metrics} />

      {notice ? <p className="inline-notice">{notice}</p> : null}

      <section className="home-grid">
        <Panel title="模块入口" eyebrow="Modules" className="home-grid__main">
          <div className="module-search">
            <label className="search-field">
              <Search size={16} />
              <input
                onChange={(event) => setModuleQuery(event.target.value)}
                placeholder="搜索模块、能力或入口"
                value={moduleQuery}
              />
            </label>
            <span>{filteredModuleItems.length} / {moduleAccessItems.length} modules</span>
          </div>
          <div className="module-grid">
            {filteredModuleItems.map((item) => {
              const allowed = item.roles.includes(role);
              const allowedRoleLabels = item.roles
                .map((roleId) => roles.find((candidate) => candidate.id === roleId)?.label || roleId)
                .join(" / ");
              const moduleCard = (
                <>
                  <div className="module-card__top">
                    <item.icon size={21} />
                    <span>{item.name}</span>
                  </div>
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.summary}</p>
                  </div>
                  <div className="module-card__meta">
                    <StatusBadge tone={allowed ? "good" : "neutral"}>
                      {allowed ? "可进入" : "当前角色不可见"}
                    </StatusBadge>
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
                  <article aria-disabled="true" className="module-card module-card--locked" key={item.id}>
                    {moduleCard}
                  </article>
                );
              }

              return (
                <a className="module-card" href={routeHash[item.id]} key={item.id}>
                  {moduleCard}
                </a>
              );
            })}
            {!filteredModuleItems.length ? (
              <div className="module-empty">
                <strong>没有找到模块</strong>
                <p>换一个关键词，例如 Gateway、Billing、API 或权限。</p>
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel title="今日待办" eyebrow="Focus">
          <div className="todo-list">
            {liveTodos.slice(0, 4).map((todo) => (
              <article className="todo-item" key={todo.id}>
                <div>
                  <span>{todo.moduleLabel}</span>
                  <strong>{todo.title}</strong>
                  <p>
                    {todo.status} · {todo.owner}
                  </p>
                </div>
                <StatusBadge tone={todo.tone}>{todo.status}</StatusBadge>
                <div className="todo-item__actions">
                  <a href={routeHash[todo.moduleId]}>查看</a>
                  <button
                    disabled={!canResolveTodo || todo.status === "Resolved" || resolvingTodoId === todo.id}
                    onClick={() => void onTodoResolve(todo)}
                    type="button"
                  >
                    {todo.status === "Resolved" ? "已处理" : resolvingTodoId === todo.id ? "处理中" : "处理"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </Panel>
      </section>

      <section className="split-grid">
        <Panel title="当前角色视角" eyebrow="Access">
          <div className="role-summary">
            <strong>{roleLabel}</strong>
            <p>{roles.find((item) => item.id === role)?.purpose}</p>
            <span>{businessItems.length} 个可见业务入口</span>
          </div>
          <RoleAccessMatrix activeRole={role} modules={moduleAccessItems} />
        </Panel>
        <Panel title="后端服务规划" eyebrow="Backend">
          <div className="service-runtime">
            <span>Dev Runtime</span>
            <strong>platform-all</strong>
            <p>本地一键启动完整控制台和 V1 API。</p>
            <code>pnpm dev:api</code>
          </div>
          <div className="service-plan">
            {backendPlan.map((item) => (
              <article key={item.label}>
                <item.icon size={18} />
                <span>{item.label}</span>
                <strong>{item.title}</strong>
                <p>{item.note}</p>
                {"command" in item ? <code>{item.command}</code> : null}
                {"health" in item ? <small>{item.health}</small> : null}
              </article>
            ))}
          </div>
          <div aria-label="后台入口到服务归属" className="service-map">
            <div className="service-map__head">
              <span>Entry</span>
              <span>Owner</span>
              <span>Scope</span>
              <span>API</span>
            </div>
            {consoleServiceMap.map((item) => (
              <div className="service-map__row" key={item.entry}>
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
        eyebrow: "Health",
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
        eyebrow: "Audit",
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
        eyebrow: "Roles",
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
        eyebrow: "API Keys",
        title: "密钥列表",
        columns: ["Name", "Project", "Scope", "Expires", "状态"],
        rows: (snapshot?.apiKeys || []).map((key) => ({
          id: key.id,
          cells: [key.name, key.project, key.scope, key.expiresAt || "No expiry", key.status],
          status: key.status,
          tone: toneForStatus(key.status),
        })),
      };
    }

    if (page.id === "iam" && activeTab === "凭据") {
      return {
        eyebrow: "Credentials",
        title: "凭据引用",
        columns: ["Ref", "用途", "Scope", "Expires", "状态"],
        rows: (snapshot?.credentials || []).map((credential) => ({
          id: credential.id,
          cells: [
            credential.ref,
            credential.purpose,
            credential.scope,
            credential.expiresAt || "No expiry",
            credential.status,
          ],
          status: credential.status,
          tone: toneForStatus(credential.status),
        })),
      };
    }

    if (page.id === "gateway" && activeTab === "模型路由") {
      return {
        eyebrow: "Model Routes",
        title: "模型路由",
        columns: ["Alias", "场景", "Primary", "Fallback", "状态"],
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
        eyebrow: "Skills",
        title: "Skill 绑定",
        columns: ["Name", "Protocol", "Route", "Timeout", "状态"],
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
        eyebrow: "Request Logs",
        title: "请求日志",
        columns: ["Request", "Consumer", "Latency", "Result", "状态"],
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
        eyebrow: "Usage",
        title: "项目用量",
        columns: ["Project", "Tokens", "Skill Calls", "Cost", "状态"],
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
        eyebrow: "Budgets",
        title: "预算告警",
        columns: ["Project", "Budget", "Current", "Threshold", "状态"],
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
        cells: [route.alias, "Model Alias", route.primary, route.fallback, route.status],
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
        eyebrow: "API Reference",
        title: "接口参考",
        columns: ["入口", "类型", "主配置", "治理", "状态"],
        rows: [...routeRows, ...modelRows, ...skillRows],
      };
    }

    if (page.id === "docs" && activeTab === "服务边界") {
      return {
        eyebrow: "Service Boundary",
        title: "服务边界",
        columns: ["后台入口", "Owner", "API 分组", "职责范围", "状态"],
        rows: consoleServiceMap.map((item) => ({
          id: `service-${item.owner}`,
          cells: [item.entry, item.owner, item.apis.join(" · "), item.scope, "Ready"],
          status: "Ready",
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
            cells: ["调用返回 401", "检查 API Key、scope 和 RBAC 角色", "用户与权限", "Ready"],
            status: "Ready",
            tone: "good",
          },
          {
            id: "faq-route",
            cells: ["模型别名不可用", "确认模型路由已发布且 fallback 可用", "网关与模型", "Ready"],
            status: "Ready",
            tone: "good",
          },
          {
            id: "faq-budget",
            cells: ["预算接近阈值", "查看用量项目并处理预算告警", "计费与配额", "Ready"],
            status: "Ready",
            tone: "good",
          },
          {
            id: "faq-sdk",
            cells: ["SDK 如何接入", "先按 OpenAPI 调用，SDK 后续补充", "帮助文档", "Draft"],
            status: "Draft",
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
    const matchesQuery = row.cells.join(" ").toLowerCase().includes(query.toLowerCase());
    const matchesStatus = status === "全部状态" || row.status === status;
    return matchesQuery && matchesStatus;
  });

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
            className="button button--primary"
            disabled={!primaryAllowed}
            onClick={() => void onPrimaryAction(page.id)}
            title={primaryAllowed ? undefined : primaryHint}
            type="button"
          >
            {page.primaryAction}
            <ChevronRight size={16} />
          </button>
          {!primaryAllowed ? <ActionHint>{primaryHint}</ActionHint> : null}
        </div>
      </section>

      {notice ? <p className="inline-notice">{notice}</p> : null}

      <ModuleWorkflow activeTab={activeTab} steps={moduleWorkflows[page.id]} />

      <div className="tab-row" aria-label={`${page.title} 页面视图`}>
        {page.tabs.map((tab) => (
          <button
            className={tab === activeTab ? "is-active" : ""}
            key={tab}
            onClick={() => setActiveTab(tab)}
            type="button"
          >
            {tab}
          </button>
        ))}
      </div>

      <MetricGrid metrics={page.metrics} />

      <section className="content-grid">
        <Panel className="content-grid__main" eyebrow={tableView.eyebrow} title={tableView.title}>
          <div className="table-toolbar">
            <label className="search-field">
              <Search size={16} />
              <input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                value={query}
              />
            </label>
            <select onChange={(event) => setStatus(event.target.value)} value={status}>
              {statuses.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <DataTable
            columns={tableView.columns}
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
                    <strong>{item.value}</strong>
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
      <Panel eyebrow="Health" title="服务健康">
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
          <div className="empty-panel">
            <strong>暂无健康数据</strong>
            <p>连接 ops-api 后，这里会展示核心服务的 SLO、P95 和状态。</p>
          </div>
        )}
      </Panel>

      <Panel eyebrow="Audit" title="最近审计">
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
          <div className="empty-panel">
            <strong>暂无审计事件</strong>
            <p>配置变更、权限操作和运行期动作会写入这里。</p>
          </div>
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
      <Panel eyebrow="Selection" title="选中详情">
        <div className="empty-panel">
          <strong>暂无选中记录</strong>
          <p>切换筛选条件或选择表格行后，这里会展示关键字段。</p>
        </div>
      </Panel>
    );
  }

  const fields = columns.map((column, index) => ({
    label: column,
    value: row.cells[index] || "-",
  }));
  const headline = row.cells[0] || title;
  const description = fields
    .slice(1, 3)
    .map((field) => `${field.label}: ${field.value}`)
    .join(" · ");

  return (
    <Panel eyebrow="Selection" title="选中详情">
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

      <div className="selected-row-next">
        <span>Next</span>
        <strong>{nextStepForStatus(row.status)}</strong>
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
  snapshot,
}: {
  activating: boolean;
  application?: Application;
  onActivate: (id: string) => Promise<void>;
  onRotateKey: (id: string) => Promise<void>;
  rotating: boolean;
  snapshot?: PlatformSnapshot;
}) {
  if (!application) {
    return (
      <Panel eyebrow="Onboarding" title="应用接入详情">
        <div className="empty-panel">
          <strong>暂无应用</strong>
          <p>创建接入应用后，这里会展示 API Key、路由、用量和审计链路。</p>
        </div>
      </Panel>
    );
  }

  const apiKey = snapshot?.apiKeys?.find(
    (item) => item.project === application.name || item.name === application.apiKey,
  );
  const usage = snapshot?.usage?.find((item) => item.project === application.name);
  const budget = snapshot?.budgetAlerts?.find((item) => item.project === application.name);
  const logs = snapshot?.requestLogs?.filter((item) => item.consumer === application.name).slice(0, 3) || [];

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
      note: budget ? `${budget.current} / ${budget.budget}` : "waiting first usage",
      tone: budget?.status || "Ready",
    },
  ];

  return (
    <Panel eyebrow="Onboarding" title="应用接入详情">
      <div className="application-summary">
        <div>
          <span>Selected App</span>
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
          <span>Tokens</span>
          <strong>{usage?.tokens || "0"}</strong>
          <p>{usage?.status || "No usage yet"}</p>
        </article>
        <article>
          <span>Skill Calls</span>
          <strong>{usage?.skillCalls || "0"}</strong>
          <p>{usage?.cost || "$0"}</p>
        </article>
      </div>

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
            <span>Request Log</span>
            <strong>Waiting</strong>
            <p>首次调用后这里会出现最近请求。</p>
          </article>
        )}
      </div>

      <div className="application-actions">
        <button
          className="button"
          disabled={rotating}
          onClick={() => void onRotateKey(application.id)}
          type="button"
        >
          {rotating ? "轮换中" : "轮换 API Key"}
        </button>
        <button
          className="button button--primary"
          disabled={activating || application.status === "Active"}
          onClick={() => void onActivate(application.id)}
          type="button"
        >
          {application.status === "Active" ? "已完成校验" : activating ? "校验中" : "完成接入校验"}
          <ChevronRight size={16} />
        </button>
      </div>
    </Panel>
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
        <div className="empty-panel">
          <strong>暂无路由</strong>
          <p>新增路由后，这里会展示鉴权、限流、发布状态和上线动作。</p>
        </div>
      </Panel>
    );
  }

  const checks = [
    {
      label: "Auth",
      value: route.auth,
      note: "入口鉴权策略",
      tone: route.auth === "API Key" ? "good" : "watch",
    },
    { label: "Limit", value: route.limit, note: "限流窗口", tone: "neutral" },
    { label: "Upstream", value: route.upstream, note: "服务入口", tone: "neutral" },
  ] as const;

  return (
    <Panel eyebrow="Route" title="路由详情">
      <div className="route-summary">
        <div>
          <span>Selected Route</span>
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
          className="button button--primary"
          disabled={publishing || route.status === "Active"}
          onClick={() => void onPublish(route.id)}
          type="button"
        >
          {route.status === "Active" ? "已发布" : publishing ? "发布中" : "发布路由"}
          <ChevronRight size={16} />
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

  return (
    <Panel eyebrow="Model Route" title="模型路由">
      {modelRoute ? (
        <>
          <div className="model-summary">
            <div>
              <span>Default Alias</span>
              <strong>{modelRoute.alias}</strong>
              <p>{modelRoute.scenario}</p>
            </div>
            <StatusBadge tone={toneForStatus(modelRoute.status)}>{modelRoute.status}</StatusBadge>
          </div>

          <div className="model-checks">
            <article>
              <span>Primary</span>
              <strong>{modelRoute.primary}</strong>
              <p>默认供应商模型</p>
              <StatusDot tone="good" />
            </article>
            <article>
              <span>Fallback</span>
              <strong>{modelRoute.fallback}</strong>
              <p>失败切换目标</p>
              <StatusDot tone="watch" />
            </article>
          </div>

          <div className="application-actions">
            <button
              className="button button--primary"
              disabled={publishing || modelRoute.status === "Active" || role === "operator"}
              onClick={() => void onPublish(modelRoute.id)}
              title={role === "operator" ? "运维人员只读模型路由发布配置" : undefined}
              type="button"
            >
              {modelRoute.status === "Active" ? "已发布" : publishing ? "发布中" : "发布模型路由"}
              <ChevronRight size={16} />
            </button>
            {role === "operator" ? <ActionHint>需要管理员或开发人员发布模型路由。</ActionHint> : null}
          </div>
        </>
      ) : (
        <div className="empty-panel">
          <strong>暂无模型路由</strong>
          <p>创建模型别名后，LLM 调用会通过 alias 进入路由策略。</p>
        </div>
      )}

      <form className="model-route-form" onSubmit={handleSubmit}>
        <label>
          <span>Alias</span>
          <input onChange={(event) => setAlias(event.target.value)} required value={alias} />
        </label>
        <label>
          <span>Scenario</span>
          <input onChange={(event) => setScenario(event.target.value)} required value={scenario} />
        </label>
        <label>
          <span>Primary</span>
          <input onChange={(event) => setPrimary(event.target.value)} required value={primary} />
        </label>
        <label>
          <span>Fallback</span>
          <input onChange={(event) => setFallback(event.target.value)} required value={fallback} />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button
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
              <span>Selected Skill</span>
              <strong>{skill.name}</strong>
              <p>{skill.route}</p>
            </div>
            <StatusBadge tone={toneForStatus(skill.status)}>{skill.status}</StatusBadge>
          </div>

          <div className="skill-checks">
            <article>
              <span>Protocol</span>
              <strong>{skill.protocol}</strong>
              <p>调用协议</p>
              <StatusDot tone="neutral" />
            </article>
            <article>
              <span>Timeout</span>
              <strong>{skill.timeout}</strong>
              <p>治理超时</p>
              <StatusDot tone="watch" />
            </article>
          </div>

          <div className="application-actions">
            <button
              className="button button--primary"
              disabled={publishing || skill.status === "Published" || role === "operator"}
              onClick={() => void onPublish(skill.id)}
              title={role === "operator" ? "运维人员只读 Skill 发布配置" : undefined}
              type="button"
            >
              {skill.status === "Published" ? "已发布" : publishing ? "发布中" : "发布 Skill"}
              <ChevronRight size={16} />
            </button>
            {role === "operator" ? <ActionHint>需要管理员或开发人员发布 Skill。</ActionHint> : null}
          </div>
        </>
      ) : (
        <div className="empty-panel">
          <strong>暂无 Skill</strong>
          <p>创建 Skill 绑定后，网关会把它纳入统一调用和治理入口。</p>
        </div>
      )}

      <form className="skill-binding-form" onSubmit={handleSubmit}>
        <label>
          <span>Name</span>
          <input onChange={(event) => setName(event.target.value)} required value={name} />
        </label>
        <label>
          <span>Protocol</span>
          <select onChange={(event) => setProtocol(event.target.value)} value={protocol}>
            <option value="HTTP">HTTP</option>
            <option value="MCP">MCP</option>
          </select>
        </label>
        <label>
          <span>Route</span>
          <input onChange={(event) => setRoute(event.target.value)} required value={route} />
        </label>
        <label>
          <span>Timeout</span>
          <input onChange={(event) => setTimeoutValue(event.target.value)} required value={timeout} />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button
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
        <div className="empty-panel">
          <strong>暂无套餐</strong>
          <p>新增套餐后，这里会展示限流、Token 配额和启用状态。</p>
        </div>
      </Panel>
    );
  }

  const canActivate = role === "admin";
  const checks = [
    { label: "Target", value: plan.target, note: "适用对象", tone: "neutral" },
    { label: "RPS", value: plan.rps, note: "请求速率", tone: "neutral" },
    { label: "Token / day", value: plan.tokenPerDay, note: "每日额度", tone: "watch" },
  ] as const;

  return (
    <Panel eyebrow="Plan" title="套餐详情">
      <div className="plan-summary">
        <div>
          <span>Selected Plan</span>
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
          className="button button--primary"
          disabled={!canActivate || activating || plan.status === "Active"}
          onClick={() => void onActivate(plan.id)}
          title={!canActivate ? "启用套餐需要管理员权限" : undefined}
          type="button"
        >
          {plan.status === "Active" ? "已启用" : activating ? "启用中" : "启用套餐"}
          <ChevronRight size={16} />
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
      <Panel eyebrow="Budget" title="预算告警">
        <div className="empty-panel">
          <strong>暂无预算规则</strong>
          <p>创建套餐或预算规则后，这里会展示水位和处理动作。</p>
        </div>
      </Panel>
    );
  }

  const canResolve = role === "admin" || role === "operator";
  const resolved = alert.status === "Resolved" || alert.status === "Normal";

  return (
    <Panel eyebrow="Budget" title="预算告警">
      <div className="budget-alert-summary">
        <div>
          <span>Selected Alert</span>
          <strong>{alert.project}</strong>
          <p>{alert.current} / {alert.budget}</p>
        </div>
        <StatusBadge tone={toneForStatus(alert.status)}>{alert.status}</StatusBadge>
      </div>

      <div className="budget-alert-checks">
        <article>
          <span>Threshold</span>
          <strong>{alert.threshold}</strong>
          <p>触发阈值</p>
          <StatusDot tone={alert.status === "Warning" ? "warn" : "neutral"} />
        </article>
        <article>
          <span>Current</span>
          <strong>{alert.current}</strong>
          <p>当前消耗</p>
          <StatusDot tone={alert.status === "Warning" ? "watch" : "good"} />
        </article>
      </div>

      <div className="application-actions">
        <button
          className="button button--primary"
          disabled={!canResolve || resolving || resolved}
          onClick={() => void onResolve(alert.id)}
          title={!canResolve ? "处理预算告警需要管理员或运维人员权限" : undefined}
          type="button"
        >
          {resolved ? "已处理" : resolving ? "处理中" : "处理预算告警"}
          <ChevronRight size={16} />
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
        <div className="empty-panel">
          <strong>暂无用户</strong>
          <p>邀请用户后，这里会展示角色、MFA、状态和激活动作。</p>
        </div>
      </Panel>
    );
  }

  const canActivate = role === "admin";
  const checks = [
    { label: "Org", value: user.org, note: "组织归属", tone: "neutral" },
    { label: "Role", value: user.role, note: "访问边界", tone: "neutral" },
    { label: "MFA", value: user.mfa, note: "登录安全", tone: user.mfa === "Enabled" ? "good" : "watch" },
  ] as const;

  return (
    <Panel eyebrow="User" title="用户详情">
      <div className="user-summary">
        <div>
          <span>Selected User</span>
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
          className="button button--primary"
          disabled={!canActivate || activating || user.status === "Active"}
          onClick={() => void onActivate(user.id)}
          title={!canActivate ? "激活用户需要管理员权限" : undefined}
          type="button"
        >
          {user.status === "Active" ? "已激活" : activating ? "激活中" : "激活用户"}
          <ChevronRight size={16} />
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
        <div className="empty-panel">
          <strong>暂无 API Key</strong>
          <p>创建接入应用后，这里会展示 API Key、scope、项目归属和撤销动作。</p>
        </div>
      </Panel>
    );
  }

  const canRevoke = role === "admin";
  const checks = [
    { label: "Project", value: apiKey.project, note: "项目归属", tone: "neutral" },
    { label: "Scope", value: apiKey.scope, note: "授权范围", tone: "neutral" },
    { label: "Expires", value: apiKey.expiresAt || "No expiry", note: "到期时间", tone: "watch" },
  ] as const;

  return (
    <Panel eyebrow="API Key" title="密钥详情">
      <div className="api-key-summary">
        <div>
          <span>Selected Key</span>
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
          className="button button--primary"
          disabled={!canRevoke || revoking || apiKey.status === "Revoked"}
          onClick={() => void onRevoke(apiKey.id)}
          title={!canRevoke ? "撤销 API Key 需要管理员权限" : undefined}
          type="button"
        >
          {apiKey.status === "Revoked" ? "已撤销" : revoking ? "撤销中" : "撤销 API Key"}
          <ChevronRight size={16} />
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
        <div className="empty-panel">
          <strong>暂无凭据引用</strong>
          <p>接入供应商 Key 后，这里会展示 credentialRef、scope、脱敏预览和轮换动作。</p>
        </div>
      </Panel>
    );
  }

  const canRotate = role === "admin";
  const checks = [
    { label: "Purpose", value: credential.purpose, note: "用途", tone: "neutral" },
    { label: "Scope", value: credential.scope, note: "绑定范围", tone: "neutral" },
    { label: "Preview", value: credential.maskedPreview, note: "脱敏展示", tone: "watch" },
  ] as const;

  return (
    <Panel eyebrow="Credential" title="凭据详情">
      <div className="credential-summary">
        <div>
          <span>Selected Credential</span>
          <strong>{credential.ref}</strong>
          <p>{credential.expiresAt ? `Expires ${credential.expiresAt}` : "No expiry configured"}</p>
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
          className="button button--primary"
          disabled={!canRotate || rotating || credential.status === "Rotated"}
          onClick={() => void onRotate(credential.id)}
          title={!canRotate ? "轮换凭据需要管理员权限" : undefined}
          type="button"
        >
          {credential.status === "Rotated" ? "已轮换" : rotating ? "轮换中" : "轮换凭据"}
          <ChevronRight size={16} />
        </button>
        {!canRotate ? <ActionHint>需要管理员轮换供应商凭据。</ActionHint> : null}
      </div>
    </Panel>
  );
}

function LLMInvokePanel({
  modelRoutes,
  onInvoked,
  role,
}: {
  modelRoutes?: ModelRoute[];
  onInvoked: () => Promise<unknown>;
  role: RoleId;
}) {
  const [modelAlias, setModelAlias] = useState("chat-default");
  const [input, setInput] = useState("帮我生成一段客服欢迎语");
  const [result, setResult] = useState<LLMInvokeResponse>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const aliases = modelRoutes?.length
    ? modelRoutes.map((route) => route.alias)
    : ["chat-default", "embedding-default"];

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
      <form className="invoke-form" onSubmit={handleSubmit}>
        <label>
          <span>Model Alias</span>
          <select onChange={(event) => setModelAlias(event.target.value)} value={modelAlias}>
            {aliases.map((alias) => (
              <option key={alias} value={alias}>
                {alias}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Input</span>
          <textarea onChange={(event) => setInput(event.target.value)} rows={4} value={input} />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="button button--primary" disabled={busy} type="submit">
          {busy ? "调用中" : "发送调用"}
        </button>
      </form>

      {result ? (
        <div className="invoke-result">
          <span>{result.provider}</span>
          <strong>{result.model}</strong>
          <p>{result.content}</p>
          <small>
            fallback {result.fallback} · {result.usage.totalTokens} tokens
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
        <article className="metric-card" key={metric.label}>
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

        return (
          <article className={`workflow-step workflow-step--${state}`} key={step.label}>
            <span>{String(index + 1).padStart(2, "0")}</span>
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
    <section className={`panel ${className}`}>
      <div className="panel__heading">
        <span>{eyebrow}</span>
        <strong>{title}</strong>
      </div>
      {children}
    </section>
  );
}

function DataTable({
  columns,
  onRowSelect,
  rows,
  selectedRowId,
}: {
  columns: string[];
  onRowSelect?: (id: string) => void;
  rows: TableRow[];
  selectedRowId?: string;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              className={row.id === selectedRowId ? "is-selected" : ""}
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
          ))}
          {rows.length === 0 ? (
            <tr>
              <td className="empty-cell" colSpan={columns.length}>
                <div>
                  <strong>没有匹配记录</strong>
                  <p>调整搜索关键词或状态筛选后再查看。</p>
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
  return <span className={`status status--${tone}`}>{children}</span>;
}

function StatusDot({ tone }: { tone: StatusTone }) {
  if (tone === "good") {
    return <CheckCircle2 className={`status-dot status-dot--${tone}`} size={16} />;
  }

  return <CircleAlert className={`status-dot status-dot--${tone}`} size={16} />;
}

function ActionHint({ children }: { children: React.ReactNode }) {
  return <p className="action-hint">{children}</p>;
}

function toneForStatus(status = ""): StatusTone {
  const normalized = status.toLowerCase();

  if (["active", "success", "normal", "ready", "published", "resolved"].includes(normalized)) {
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

function nextStepForStatus(status = "") {
  const normalized = status.toLowerCase();

  if (["warning", "degraded", "expiring"].includes(normalized)) {
    return "优先处理";
  }

  if (["pending", "draft", "invited", "provisioning", "watching", "guarded"].includes(normalized)) {
    return "继续推进";
  }

  if (["active", "success", "normal", "ready", "published", "resolved"].includes(normalized)) {
    return "保持观察";
  }

  return "查看上下文";
}

export default App;
