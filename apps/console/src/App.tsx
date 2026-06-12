import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Search,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { ActionDialog, type ActionMode, type ActionValues } from "./components/ActionDialog";
import { backendPlan, modulePages, navItems, roles, todos } from "./data/console";
import {
  activateApplication,
  createApplication,
  createPlan,
  createRoute,
  createUser,
  invokeLLM,
  loadPlatformSnapshot,
  resolveTodo,
  rotateApplicationKey,
  type Application,
  type LLMInvokeResponse,
  type PlatformSnapshot,
} from "./lib/api";
import { hydrateHomeMetrics, hydrateModulePages, hydrateTodos } from "./lib/hydrate";
import type {
  ConsoleRoute,
  MetricItem,
  ModulePageDefinition,
  NavItem,
  RoleId,
  StatusTone,
  TableRow,
} from "./types";

type ApiState = "loading" | "live" | "fallback";

const routeHash: Record<ConsoleRoute, string> = {
  home: "#/console/home",
  overview: "#/console/overview",
  iam: "#/console/iam",
  gateway: "#/console/gateway",
  quota: "#/console/quota",
  docs: "#/console/docs",
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
  const [activatingApplicationId, setActivatingApplicationId] = useState("");
  const [rotatingApplicationId, setRotatingApplicationId] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const visibleItems = useMemo(
    () => navItems.filter((item) => item.roles.includes(role)),
    [role],
  );

  const refreshSnapshot = useCallback(async () => {
    const result = await loadPlatformSnapshot(role);

    if (result.ok) {
      setSnapshot(result.snapshot);
      setApiState("live");
      setApiDetail(`${result.loaded} 个接口已连接`);
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

    const canAccess = visibleItems.some((item) => item.id === route);
    if (!canAccess) {
      window.location.hash = routeHash.home;
    }
  }, [role, route, visibleItems]);

  if (route === "landing") {
    return <LandingPage />;
  }

  const activeRoute = route;
  const hydratedPages = hydrateModulePages(modulePages, snapshot);
  const activePage = hydratedPages.find((page) => page.id === activeRoute);

  async function handleModuleAction(pageId: ConsoleRoute) {
    setNotice("");
    setActionError("");

    if (pageId === "overview") {
      const pendingTodo = snapshot?.dashboard?.todos.find((todo) => todo.status !== "Resolved");
      if (!pendingTodo) {
        setNotice("当前没有待处理事项。");
        return;
      }
      await resolveTodo(pendingTodo.id, role);
      await refreshSnapshot();
      setNotice(`已处理：${pendingTodo.title}`);
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
        await createRoute(
          {
            route: values.route,
            upstream: values.upstream,
            limit: values.limit,
          },
          role,
        );
        setNotice(`已创建路由：${values.route}`);
      }

      if (actionMode === "quota") {
        await createPlan(
          {
            name: values.name,
            rps: values.rps,
            tokenPerDay: values.tokenPerDay,
          },
          role,
        );
        setNotice(`已创建套餐：${values.name}`);
      }

      if (actionMode === "docs") {
        await createApplication(
          {
            name: values.name,
            owner: values.owner,
            environment: values.environment,
            defaultRoute: values.defaultRoute,
            plan: values.plan,
          },
          role,
        );
        setNotice(`已创建接入应用：${values.name}`);
      }

      setActionMode(null);
      await refreshSnapshot();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "操作失败");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleApplicationActivate(id: string) {
    setNotice("");
    setActivatingApplicationId(id);

    try {
      const application = await activateApplication(id, role);
      await refreshSnapshot();
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
      setNotice(`已轮换 API Key：${application.name}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "API Key 轮换失败");
    } finally {
      setRotatingApplicationId("");
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
            role={role}
            snapshot={snapshot}
            visibleItems={visibleItems}
          />
        ) : null}
        {activePage ? (
          <ModulePage
            notice={notice}
            onApplicationActivate={handleApplicationActivate}
            onApplicationKeyRotate={handleApplicationKeyRotate}
            activatingApplicationId={activatingApplicationId}
            onPrimaryAction={handleModuleAction}
            page={activePage}
            role={role}
            rotatingApplicationId={rotatingApplicationId}
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
            <span className={`api-state api-state--${apiState}`} title={apiDetail}>
              {apiState === "live" ? "Live API" : apiState === "loading" ? "Connecting" : "Mock fallback"}
            </span>
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

function ConsoleHome({
  metrics,
  role,
  snapshot,
  visibleItems,
}: {
  metrics: MetricItem[];
  role: RoleId;
  snapshot?: PlatformSnapshot;
  visibleItems: NavItem[];
}) {
  const businessItems = visibleItems.filter((item) => item.id !== "home");
  const roleLabel = roles.find((item) => item.id === role)?.label || "管理员";
  const liveTodos = hydrateTodos(snapshot) || todos;

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

      <section className="home-grid">
        <Panel title="模块入口" eyebrow="Modules" className="home-grid__main">
          <div className="module-grid">
            {businessItems.map((item) => (
              <a className="module-card" href={routeHash[item.id]} key={item.id}>
                <div className="module-card__top">
                  <item.icon size={21} />
                  <span>{item.name}</span>
                </div>
                <strong>{item.label}</strong>
                <p>{item.summary}</p>
                <div className="chip-row">
                  {item.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </a>
            ))}
          </div>
        </Panel>

        <Panel title="今日待办" eyebrow="Focus">
          <div className="todo-list">
            {liveTodos.slice(0, 4).map((todo) => (
              <a className="todo-item" href={routeHash[todo.moduleId]} key={todo.id}>
                <span>{todo.moduleLabel}</span>
                <strong>{todo.title}</strong>
                <p>
                  {todo.status} · {todo.owner}
                </p>
                <StatusBadge tone={todo.tone}>{todo.status}</StatusBadge>
              </a>
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
        </Panel>
        <Panel title="后端服务规划" eyebrow="Backend">
          <div className="service-plan">
            {backendPlan.map((item) => (
              <article key={item.label}>
                <item.icon size={18} />
                <span>{item.label}</span>
                <strong>{item.title}</strong>
                <p>{item.note}</p>
              </article>
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
  onApplicationActivate,
  onApplicationKeyRotate,
  onPrimaryAction,
  page,
  role,
  rotatingApplicationId,
  snapshot,
}: {
  activatingApplicationId: string;
  notice: string;
  onApplicationActivate: (id: string) => Promise<void>;
  onApplicationKeyRotate: (id: string) => Promise<void>;
  onPrimaryAction: (pageId: ConsoleRoute) => Promise<void>;
  page: ModulePageDefinition;
  role: RoleId;
  rotatingApplicationId: string;
  snapshot?: PlatformSnapshot;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("全部状态");
  const [selectedRowId, setSelectedRowId] = useState("");

  const statuses = useMemo(
    () => ["全部状态", ...Array.from(new Set(page.table.rows.map((row) => row.status)))],
    [page.table.rows],
  );

  const rows = page.table.rows.filter((row) => {
    const matchesQuery = row.cells.join(" ").toLowerCase().includes(query.toLowerCase());
    const matchesStatus = status === "全部状态" || row.status === status;
    return matchesQuery && matchesStatus;
  });

  const selectedApplication = useMemo(() => {
    if (page.id !== "docs" || !snapshot?.applications?.length) {
      return undefined;
    }

    return (
      snapshot.applications.find((application) => application.id === selectedRowId) ||
      snapshot.applications[0]
    );
  }, [page.id, selectedRowId, snapshot?.applications]);

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

  return (
    <main className="page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{page.eyebrow}</p>
          <h2>{page.title}</h2>
          <p>{page.description}</p>
        </div>
        <button className="button button--primary" onClick={() => void onPrimaryAction(page.id)} type="button">
          {page.primaryAction}
          <ChevronRight size={16} />
        </button>
      </section>

      {notice ? <p className="inline-notice">{notice}</p> : null}

      <div className="tab-row" aria-label={`${page.title} 页面视图`}>
        {page.tabs.map((tab, index) => (
          <button className={index === 0 ? "is-active" : ""} key={tab} type="button">
            {tab}
          </button>
        ))}
      </div>

      <MetricGrid metrics={page.metrics} />

      <section className="content-grid">
        <Panel className="content-grid__main" eyebrow={page.table.eyebrow} title={page.table.title}>
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
            columns={page.table.columns}
            onRowSelect={page.id === "docs" ? setSelectedRowId : undefined}
            rows={rows}
            selectedRowId={page.id === "docs" ? selectedApplication?.id : undefined}
          />
        </Panel>

        <div className="side-panels">
          {page.id === "gateway" ? <LLMInvokePanel role={role} /> : null}
          {page.id === "docs" ? (
            <ApplicationJourneyPanel
              activating={activatingApplicationId === selectedApplication?.id}
              application={selectedApplication}
              onActivate={onApplicationActivate}
              onRotateKey={onApplicationKeyRotate}
              rotating={rotatingApplicationId === selectedApplication?.id}
              snapshot={snapshot}
            />
          ) : null}
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

function LLMInvokePanel({ role }: { role: RoleId }) {
  const [modelAlias, setModelAlias] = useState("chat-default");
  const [input, setInput] = useState("帮我生成一段客服欢迎语");
  const [result, setResult] = useState<LLMInvokeResponse>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await invokeLLM({ modelAlias, input }, role);
      setResult(response);
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
            <option value="chat-default">chat-default</option>
            <option value="embedding-default">embedding-default</option>
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
                没有匹配记录
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

function toneForStatus(status = ""): StatusTone {
  const normalized = status.toLowerCase();

  if (["active", "success", "normal", "ready", "published"].includes(normalized)) {
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

export default App;
