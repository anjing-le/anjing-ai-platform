import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { backendPlan, homeMetrics, modulePages, navItems, roles, todos } from "./data/console";
import { loadPlatformSnapshot, type PlatformSnapshot } from "./lib/api";
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

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const visibleItems = useMemo(
    () => navItems.filter((item) => item.roles.includes(role)),
    [role],
  );

  useEffect(() => {
    let active = true;

    loadPlatformSnapshot()
      .then((result) => {
        if (!active) {
          return;
        }

        if (result.ok) {
          setSnapshot(result.snapshot);
          setApiState("live");
          setApiDetail(`${result.loaded} 个接口已连接`);
        } else {
          setApiState("fallback");
          setApiDetail("未连接后端，使用页面默认数据");
        }
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
  }, []);

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

  return (
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
      {activePage ? <ModulePage page={activePage} /> : null}
    </ConsoleShell>
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

function ModulePage({ page }: { page: ModulePageDefinition }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("全部状态");

  const statuses = useMemo(
    () => ["全部状态", ...Array.from(new Set(page.table.rows.map((row) => row.status)))],
    [page.table.rows],
  );

  const rows = page.table.rows.filter((row) => {
    const matchesQuery = row.cells.join(" ").toLowerCase().includes(query.toLowerCase());
    const matchesStatus = status === "全部状态" || row.status === status;
    return matchesQuery && matchesStatus;
  });

  return (
    <main className="page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{page.eyebrow}</p>
          <h2>{page.title}</h2>
          <p>{page.description}</p>
        </div>
        <button className="button button--primary" type="button">
          {page.primaryAction}
          <ChevronRight size={16} />
        </button>
      </section>

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
          <DataTable columns={page.table.columns} rows={rows} />
        </Panel>

        <div className="side-panels">
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

function DataTable({ columns, rows }: { columns: string[]; rows: TableRow[] }) {
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
            <tr key={row.id}>
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

export default App;
