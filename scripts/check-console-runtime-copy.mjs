import { readFileSync } from "node:fs";

const errors = [];
const appSource = readFileSync("apps/console/src/App.tsx", "utf8");
const actionDialogSource = readFileSync("apps/console/src/components/ActionDialog.tsx", "utf8");
const accessSource = readFileSync("apps/console/src/lib/access.ts", "utf8");
const dataSource = readFileSync("apps/console/src/data/console.ts", "utf8");
const styleSource = readFileSync("apps/console/src/styles.css", "utf8");

if (!appSource.includes("<code>pnpm dev:api</code>")) {
  errors.push("Console home runtime command must show pnpm dev:api.");
}

for (const placeholderCopy of ["待补充", "planned docs", "mock target", "Mock fallback", "后续补充", "No usage yet", "waiting first usage"]) {
  if (appSource.includes(placeholderCopy) || dataSource.includes(placeholderCopy)) {
    errors.push(`Console user-facing copy must not expose placeholder text: ${placeholderCopy}`);
  }
}

if (dataSource.includes('cells: ["Enterprise", "private deployment", "custom", "custom", "Draft"]')) {
  errors.push("Console fallback billing plans must not expose Enterprise as an unfinished draft.");
}

if (!appSource.includes("service-runtime__command") || !appSource.includes("handleRuntimeCommandCopy")) {
  errors.push("Console home runtime command must be copyable from the backend plan.");
}

if (!appSource.includes("runtimeCommandCopyState") || !appSource.includes("runtimeCommandCopyLabel")) {
  errors.push("Console home runtime command copy action must expose success and failure feedback.");
}

if (!appSource.includes("service-command") || !appSource.includes("handleServiceCommandCopy") || !appSource.includes("copiedServiceCommand")) {
  errors.push("Console single-service commands must be copyable from the backend plan.");
}

if (!appSource.includes("failedServiceCommand") || !appSource.includes("请手动复制命令")) {
  errors.push("Console single-service command copy action must expose clipboard failure feedback.");
}

if (appSource.includes("<code>go run ./cmd/platform-all</code>")) {
  errors.push("Console home must not show raw go run ./cmd/platform-all as the primary runtime command.");
}

if (!appSource.includes("刷新平台数据") || !appSource.includes("RefreshCw")) {
  errors.push("Console topbar must expose a manual platform data refresh action.");
}

if (!appSource.includes('aria-current={item.id === activeRoute ? "page" : undefined}') || !styleSource.includes('.sidebar__link[aria-current="page"]')) {
  errors.push("Console sidebar must expose and style the current navigation item.");
}

if (!appSource.includes("lastSyncedAt") || !appSource.includes("最近同步") || !appSource.includes("等待首次同步")) {
  errors.push("Console topbar must show platform data freshness after refresh attempts.");
}

if (!appSource.includes("aria-label={`数据来源：${label}") || !appSource.includes("aria-live=\"polite\"")) {
  errors.push("Console topbar data source badge must expose live accessible state changes.");
}

if (!appSource.includes("聚合快照 · ops-api") || !appSource.includes("分组接口 ·") || !appSource.includes("本地演示数据 · console fallback")) {
  errors.push("Console topbar must expose whether data comes from aggregate, granular or local demo mode.");
}

if (!appSource.includes("topbar__role-purpose") || !appSource.includes("activeRole.purpose")) {
  errors.push("Console topbar must show the active role purpose beside the role switcher.");
}

if (!appSource.includes("aria-pressed={item.id === role}") || !styleSource.includes('.role-switcher button[aria-pressed="true"]')) {
  errors.push("Console role switcher must expose and style the active role state.");
}

if (!appSource.includes("window.setTimeout") || !appSource.includes("setNotice(\"\")")) {
  errors.push("Console notices must clear automatically after a short delay.");
}

if (
  !actionDialogSource.includes("aria-describedby=\"action-dialog-description\"") ||
  !actionDialogSource.includes("id=\"action-dialog-description\"") ||
  !actionDialogSource.includes("role=\"alert\"")
) {
  errors.push("Console action dialog must link its description and expose submit errors as alerts.");
}

if (!actionDialogSource.includes("event.key === \"Escape\"") || !actionDialogSource.includes("disabled={busy}")) {
  errors.push("Console action dialog must support Escape close while preventing busy-state dismissal.");
}

if (!actionDialogSource.includes("autoFocus={index === 0}")) {
  errors.push("Console action dialog must autofocus the first form field when opened.");
}

if (!actionDialogSource.includes("aria-busy={busy}") || !actionDialogSource.includes("aria-live=\"polite\"")) {
  errors.push("Console action dialog must expose busy submit state to assistive technology.");
}

for (const formClass of ["model-route-form", "skill-binding-form", "invoke-form"]) {
  const formPattern = new RegExp(`<form aria-busy=\\{busy\\} className="${formClass}"`);
  if (!formPattern.test(appSource)) {
    errors.push(`Console inline form ${formClass} must expose aria-busy while submitting.`);
  }
}

if (!appSource.includes("function useInitialFocus") || (appSource.match(/useInitialFocus</g) || []).length < 3) {
  errors.push("Console inline forms must focus their first editable control after module mount.");
}

if (!appSource.includes("autoFocus = false") || !appSource.includes("useInitialFocus<HTMLSelectElement>(autoFocus)")) {
  errors.push("Console secondary inline forms must opt in before taking initial focus.");
}

for (const fieldsetRule of ['disabled={busy || role === "operator"}', "disabled={busy}"]) {
  if (!appSource.includes(fieldsetRule)) {
    errors.push("Console inline forms must disable their editable controls while busy or read-only.");
  }
}

if ((appSource.match(/role="alert"/g) || []).length < 3) {
  errors.push("Console inline forms must expose submit errors as alerts.");
}

if (!appSource.includes("table-result-count") || !appSource.includes("tableView.rows.length")) {
  errors.push("Console data tables must show filtered row counts.");
}

if (!appSource.includes('<CheckCircle2 aria-hidden="true"') || !appSource.includes('<CircleAlert aria-hidden="true"')) {
  errors.push("Console decorative status icons must be hidden from assistive technology.");
}

if (!appSource.includes("ariaLabel={`${page.title} - ${tableView.title}`}") || !appSource.includes("aria-selected")) {
  errors.push("Console data tables must keep accessible table labels and selected row state.");
}

if (
  !appSource.includes('role="tablist"') ||
  !appSource.includes('role="tab"') ||
  !appSource.includes('role="tabpanel"') ||
  !appSource.includes("aria-selected={tab === activeTab}") ||
  !appSource.includes("aria-controls={`module-panel-${page.id}`}") ||
  !appSource.includes("handleModuleTabKeyDown") ||
  !appSource.includes('event.key === "ArrowRight"') ||
  !appSource.includes('event.key === "Home"')
) {
  errors.push("Console module tabs must expose accessible semantics, selected state and keyboard navigation.");
}

if (!styleSource.includes('.tab-row button:focus-visible') || !styleSource.includes('.tab-row button[aria-selected="true"]')) {
  errors.push("Console module tabs must show visible focus and selected states in the stylesheet.");
}

if (!appSource.includes("filtersActive") || !appSource.includes("清空筛选")) {
  errors.push("Console data tables must provide a clear filter action when filters are active.");
}

if (!appSource.includes("emptyTitle={filtersActive ?") || !appSource.includes("当前筛选没有结果")) {
  errors.push("Console data tables must provide contextual empty states for active filters.");
}

if (!appSource.includes("visibleModuleCount") || !appSource.includes("lockedModuleCount") || !appSource.includes("清空搜索")) {
  errors.push("Console home module entry must show role access counts and a clear search action.");
}

if (
  !appSource.includes("const accessLabel = allowed ?") ||
  !appSource.includes("aria-label={`${item.label} 当前角色不可进入，需 ${allowedRoleLabels}`}")
) {
  errors.push("Console home locked module cards must explain which roles can enter.");
}

if (!appSource.includes("openTodos") || !appSource.includes("todo-summary") || !appSource.includes("今日待办已清空")) {
  errors.push("Console home todo list must focus unresolved work and show an all-done empty state.");
}

if (!appSource.includes("quickstart-snippet") || !appSource.includes("复制调用示例") || !appSource.includes("navigator.clipboard.writeText")) {
  errors.push("Console Quickstart must provide a copyable minimal call snippet.");
}

if (!appSource.includes("复制失败") || !appSource.includes("aria-live=\"polite\"") || !appSource.includes("Quickstart curl 调用示例")) {
  errors.push("Console Quickstart copy action must expose success/error feedback and an accessible snippet label.");
}

if (!appSource.includes("ak_live_xxx") || !appSource.includes("QuickstartSnippet curl={placeholderCurl}")) {
  errors.push("Console Quickstart must show a placeholder call snippet before an application exists.");
}

if (
  !appSource.includes("function QuickstartChecklist") ||
  !appSource.includes("发送最小调用") ||
  !appSource.includes("hasRequestLogs") ||
  !appSource.includes("StatusBadge tone={toneForStatus(step.status)}")
) {
  errors.push("Console Quickstart must show the minimal onboarding checklist with live statuses.");
}

if (
  !accessSource.includes("canManageApplicationOnboarding") ||
  !appSource.includes("canManageApplicationOnboarding(role)") ||
  !appSource.includes("需要管理员、使用用户或开发人员处理接入应用")
) {
  errors.push("Console Quickstart application actions must use the shared onboarding role boundary.");
}

if (!appSource.includes("http://localhost:18080/api/v1/llm/chat") || appSource.includes("http://localhost:8080/api/v1/llm/chat")) {
  errors.push("Console Quickstart snippet must target the default platform-all API port 18080.");
}

for (const port of ["1820", "1821", "1822", "1823"]) {
  if (!dataSource.includes(`http://localhost:${port}/healthz`)) {
    errors.push(`Console backend plan must show http://localhost:${port}/healthz.`);
  }
}

for (const command of ["pnpm dev:control", "pnpm dev:gateway", "pnpm dev:billing", "pnpm dev:ops"]) {
  if (!dataSource.includes(command)) {
    errors.push(`Console backend plan must show ${command}.`);
  }
}

for (const stalePath of ["/api/control/healthz", "/api/gateway/healthz", "/api/billing/healthz", "/api/ops/healthz"]) {
  if (dataSource.includes(stalePath)) {
    errors.push(`Console backend plan must not show stale health path ${stalePath}.`);
  }
}

if (errors.length > 0) {
  console.error("Console runtime copy check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Console runtime copy matches local service commands.");
