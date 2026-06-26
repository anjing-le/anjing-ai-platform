import { readFileSync } from "node:fs";

const errors = [];
const appSource = readFileSync("apps/console/src/App.tsx", "utf8");
const actionDialogSource = readFileSync("apps/console/src/components/ActionDialog.tsx", "utf8");
const accessSource = readFileSync("apps/console/src/lib/access.ts", "utf8");
const dataSource = readFileSync("apps/console/src/data/console.ts", "utf8");
const hydrateSource = readFileSync("apps/console/src/lib/hydrate.ts", "utf8");
const styleSource = readFileSync("apps/console/src/styles.css", "utf8");

if (!appSource.includes("<code>pnpm dev:api</code>")) {
  errors.push("Console home runtime command must show pnpm dev:api.");
}

if (!appSource.includes('<section aria-label={`${eyebrow}：${title}`} className={`panel ${className}`}>')) {
  errors.push("Console panel sections must expose their eyebrow and title as accessible region labels.");
}

if (
  !appSource.includes("function EmptyPanel") ||
  !appSource.includes('className="empty-panel" role="status"') ||
  !appSource.includes("aria-label={`${title}：${description}`}") ||
  appSource.includes('<div className="empty-panel">')
) {
  errors.push("Console empty panels must reuse the accessible EmptyPanel status component.");
}

if (!appSource.includes("aria-label={`${metric.label}：${metric.value}，${metric.note}，状态 ${metric.tone || \"neutral\"}`")) {
  errors.push("Console metric cards must expose readable metric summaries with status tone.");
}

for (const placeholderCopy of [
  "待补充",
  "planned docs",
  "mock target",
  "Mock fallback",
  "后续补充",
  "No usage yet",
  "waiting first usage",
  "No expiry configured",
  "No expiry",
]) {
  if (appSource.includes(placeholderCopy) || dataSource.includes(placeholderCopy)) {
    errors.push(`Console user-facing copy must not expose placeholder text: ${placeholderCopy}`);
  }
}

for (const staleDataCopy of [
  "Owner",
  "Project based",
  "tags required",
  "gateway endpoints",
  "client examples",
  "common issues",
  "model alias",
  "usage / audit",
  "trial users",
  "production agents",
  "private deployment",
  "default policy",
  "published 9",
]) {
  if (dataSource.includes(staleDataCopy)) {
    errors.push(`Console module data must use localized enterprise labels instead of ${staleDataCopy}.`);
  }
}

for (const localizedDataCopy of ["快速接入、API 参考", "负责人", "模型别名", "用量 / 审计", "按项目", "必须带标签", "网关端点", "客户端示例"]) {
  if (!dataSource.includes(localizedDataCopy) && !appSource.includes(localizedDataCopy)) {
    errors.push(`Console module data must keep localized enterprise labels: ${localizedDataCopy}`);
  }
}

if (dataSource.includes('tabs: ["Quickstart"') || dataSource.includes('eyebrow: "Quickstart"')) {
  errors.push("Console docs module must expose 快速接入 instead of Quickstart.");
}

if (dataSource.includes('"FAQ"') || appSource.includes('activeTab === "FAQ"') || appSource.includes('eyebrow: "FAQ"')) {
  errors.push("Console docs module must expose 常见问题 instead of FAQ.");
}

for (const staleSnapshotCopy of [
  'eyebrow: "Health"',
  'eyebrow: "Audit"',
  'eyebrow: "Roles"',
  'eyebrow: "API Keys"',
  'eyebrow: "Credentials"',
  'eyebrow: "Applications"',
  '"Owner"',
  '"Go API live"',
  '"production"',
  '"ready to call"',
  '"issued keys"',
]) {
  if (appSource.includes(staleSnapshotCopy) || hydrateSource.includes(staleSnapshotCopy)) {
    errors.push(`Console live snapshot copy must use localized enterprise labels instead of ${staleSnapshotCopy}.`);
  }
}

for (const localizedSnapshotCopy of ["Go API 在线", "生产环境", "可发起调用", "已签发密钥", 'eyebrow: "接入应用"', 'columns: ["应用", "负责人"']) {
  if (!appSource.includes(localizedSnapshotCopy) && !hydrateSource.includes(localizedSnapshotCopy)) {
    errors.push(`Console live snapshot copy must keep localized labels: ${localizedSnapshotCopy}`);
  }
}

for (const staleDetailLabel of [
  "Selected App",
  "Selected Route",
  "Default Alias",
  "Selected Skill",
  "Selected Plan",
  "Selected Alert",
  "Selected User",
  "Selected Key",
  "Selected Credential",
]) {
  if (appSource.includes(staleDetailLabel)) {
    errors.push(`Console detail summary labels must use localized copy instead of ${staleDetailLabel}.`);
  }
}

for (const localizedFormLabel of [
  "<span>别名</span>",
  "<span>场景</span>",
  "<span>主模型</span>",
  "<span>兜底模型</span>",
  "<span>名称</span>",
  "<span>协议</span>",
  "<span>路由</span>",
  "<span>超时</span>",
]) {
  if (!appSource.includes(localizedFormLabel)) {
    errors.push(`Console model and skill forms must keep localized labels: ${localizedFormLabel}`);
  }
}

for (const localizedDetailFieldLabel of [
  'label: "项目"',
  'label: "授权范围"',
  'label: "到期时间"',
  'label: "用途"',
  'label: "绑定范围"',
  'label: "脱敏预览"',
]) {
  if (!appSource.includes(localizedDetailFieldLabel)) {
    errors.push(`Console API Key and credential detail fields must keep localized labels: ${localizedDetailFieldLabel}`);
  }
}

if (
  !appSource.includes("function displayRoleName") ||
  !appSource.includes("function displayOrg") ||
  !appSource.includes('{ label: "组织", value: displayOrg(user.org)') ||
  !appSource.includes('{ label: "角色", value: displayRoleName(user.role)') ||
  !appSource.includes('{ label: "MFA", value: displayStatus(user.mfa)')
) {
  errors.push("Console user detail panels must localize backend role, org and MFA values before display.");
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

if (
  !appSource.includes("failedServiceCommand") ||
  !appSource.includes("请手动复制命令") ||
  !appSource.includes('className="service-command__hint" role="status"')
) {
  errors.push("Console single-service command copy action must expose clipboard failure feedback.");
}

if (
  !appSource.includes("aria-label={`复制本地运行命令：pnpm dev:api，${runtimeCommandCopyLabel}`}") ||
  !appSource.includes("aria-label={`复制 ${item.label} 运行命令：${item.command}`}") ||
  !appSource.includes("aria-label={`${copyLabel}：快速接入 curl 调用示例`}") ||
  (appSource.match(/<Copy aria-hidden="true" size=\{14\}/g) || []).length < 3
) {
  errors.push("Console copy buttons must expose explicit labels and hide decorative copy icons.");
}

if (
  !appSource.includes("aria-label={`${item.label}：${item.title}，${item.note}`}") ||
  !appSource.includes("<item.icon aria-hidden=\"true\" size={18} />") ||
  !appSource.includes("aria-label={`${item.entry} 由 ${item.owner} 负责，范围：${item.scope}`}") ||
  !appSource.includes("<span>入口</span>") ||
  !appSource.includes("<span>归属服务</span>") ||
  !appSource.includes("<span>职责范围</span>")
) {
  errors.push("Console backend plan cards and service map rows must expose readable summaries.");
}

if (appSource.includes("<code>go run ./cmd/platform-all</code>")) {
  errors.push("Console home must not show raw go run ./cmd/platform-all as the primary runtime command.");
}

if (
  !appSource.includes('aria-label={refreshing ? "正在刷新平台数据" : "刷新平台数据"}') ||
  !appSource.includes('<RefreshCw aria-hidden="true" size={16} />') ||
  !appSource.includes('<span>{refreshing ? "刷新中" : "刷新"}</span>')
) {
  errors.push("Console topbar refresh action must expose busy labels and hide its decorative icon.");
}

if (
  !appSource.includes('aria-current={item.id === activeRoute ? "page" : undefined}') ||
  !appSource.includes("aria-label={`打开${item.label}`}") ||
  !appSource.includes("<item.icon aria-hidden=\"true\" size={17} />") ||
  !styleSource.includes('.sidebar__link[aria-current="page"]')
) {
  errors.push("Console sidebar must expose and style the current navigation item.");
}

if (!appSource.includes('<a className="sidebar__brand" href={routeHash.home}>')) {
  errors.push("Console sidebar brand must navigate back to the console home route.");
}

if (!appSource.includes("lastSyncedAt") || !appSource.includes("最近同步") || !appSource.includes("等待首次同步")) {
  errors.push("Console topbar must show platform data freshness after refresh attempts.");
}

if (!appSource.includes("aria-label={`数据来源：${label}") || !appSource.includes("aria-live=\"polite\"")) {
  errors.push("Console topbar data source badge must expose live accessible state changes.");
}

if (!appSource.includes('state === "live" ? "实时 API"') || !appSource.includes('"连接中"') || !appSource.includes('"本地演示"')) {
  errors.push("Console topbar API source labels must use localized user-facing copy.");
}

if (!appSource.includes("聚合快照 · ops-api") || !appSource.includes("分组接口 ·") || !appSource.includes("本地演示数据 · 后端未连接")) {
  errors.push("Console topbar must expose whether data comes from aggregate, granular or local demo mode.");
}

if (!appSource.includes("topbar__role-purpose") || !appSource.includes("activeRole.purpose")) {
  errors.push("Console topbar must show the active role purpose beside the role switcher.");
}

if (!appSource.includes("{activeRole.label}视角") || appSource.includes("{activeRole.name} View")) {
  errors.push("Console topbar role view label must use localized role copy.");
}

if (
  !appSource.includes("primaryAllowed") ||
  !appSource.includes("${page.title}：${page.primaryAction}") ||
  !appSource.includes("无法执行 ${page.primaryAction}，${primaryHint}") ||
  !appSource.includes("<ChevronRight aria-hidden=\"true\" size={16} />")
) {
  errors.push("Console module primary actions must expose role-aware labels and hide decorative arrows.");
}

if (appSource.includes("<ChevronRight size={16} />")) {
  errors.push("Console decorative chevron icons must be hidden from assistive technology.");
}

for (const actionLabel of [
  "发布路由 ${route.route}",
  "无法发布模型路由 ${modelRoute.alias}，需要管理员或开发人员",
  "发布 Skill ${skill.name}",
  "无法启用套餐 ${plan.name}，需要管理员权限",
  "处理 ${alert.project} 的预算告警",
  "激活用户 ${user.email}",
  "撤销 API Key ${apiKey.name}",
  "轮换凭据 ${credential.ref}",
]) {
  if (!appSource.includes(actionLabel)) {
    errors.push(`Console detail panel actions must expose object-aware labels: ${actionLabel}`);
  }
}

if (!appSource.includes("aria-label={`权限提示：${children}`}") || !appSource.includes('className="action-hint" role="note"')) {
  errors.push("Console action hints must expose permission explanations as notes.");
}

if (
  !appSource.includes("aria-pressed={item.id === role}") ||
  !appSource.includes("aria-label={`${item.label}视角：${item.purpose}，${item.id === role ? \"当前选中\" : \"可切换\"}`}") ||
  !styleSource.includes('.role-switcher button[aria-pressed="true"]')
) {
  errors.push("Console role switcher must expose and style the active role state.");
}

if (
  !appSource.includes("activeAllowed = module.roles.includes(activeRole)") ||
  !appSource.includes("aria-label={`${module.label}：当前角色${activeAllowed ? \"可见\" : \"不可见\"}，可见角色 ${visibleRoleLabels}`}")
) {
  errors.push("Console role access matrix rows must expose readable active-role summaries.");
}

if (!appSource.includes("window.setTimeout") || !appSource.includes("setNotice(\"\")")) {
  errors.push("Console notices must clear automatically after a short delay.");
}

if ((appSource.match(/className="inline-notice" role="status"/g) || []).length < 2) {
  errors.push("Console notices must expose polite status regions on home and module pages.");
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

for (const submitLabel of [
  "无法创建模型路由，需要管理员或开发人员",
  "创建模型路由 ${alias}",
  "无法创建 Skill 绑定，需要管理员或开发人员",
  "创建 Skill 绑定 ${name}",
  "调用模型 ${modelAlias}",
]) {
  if (!appSource.includes(submitLabel)) {
    errors.push(`Console inline form submit actions must expose object-aware labels: ${submitLabel}`);
  }
}

if (
  !appSource.includes("aria-label={`LLM 调用结果：${result.provider} ${result.model}，兜底 ${result.fallback}，${result.usage.totalTokens} tokens`}") ||
  !appSource.includes('className="invoke-result"') ||
  !appSource.includes('role="status"')
) {
  errors.push("Console LLM invoke results must expose readable status summaries.");
}

for (const localizedPanelCopy of [
  "Token 用量",
  "Skill 调用",
  "请求日志",
  "等待调用",
  "阈值",
  "当前用量",
  "模型别名",
  "兜底 {result.fallback}",
]) {
  if (!appSource.includes(localizedPanelCopy)) {
    errors.push(`Console key panels must use localized enterprise copy: ${localizedPanelCopy}`);
  }
}

for (const stalePanelCopy of ["Request Log", ">Waiting<", "Model Alias", "Threshold", "Current", "fallback {result.fallback}"]) {
  if (appSource.includes(stalePanelCopy)) {
    errors.push(`Console key panels must not expose stale English copy: ${stalePanelCopy}`);
  }
}

for (const staleMicroCopy of [
  'eyebrow="Focus"',
  'eyebrow="Access"',
  'eyebrow="Backend"',
  'eyebrow="Health"',
  'eyebrow="Audit"',
  'eyebrow="Selection"',
  'eyebrow="Onboarding"',
  'eyebrow="Budget"',
  "<span>Input</span>",
  "Public open-source infrastructure for AI applications",
  "<span>Dev Runtime</span>",
  "<span>Quickstart</span>",
  'aria-label="Quickstart 最小接入清单"',
  "Quickstart curl 调用示例",
]) {
  if (appSource.includes(staleMicroCopy)) {
    errors.push(`Console microcopy must use localized enterprise labels instead of ${staleMicroCopy}.`);
  }
}

for (const localizedMicroCopy of [
  'eyebrow="重点"',
  'eyebrow="访问"',
  'eyebrow="后端"',
  'eyebrow="选择"',
  'eyebrow="接入"',
  'eyebrow="预算"',
  "<span>输入内容</span>",
  "面向 AI 应用的开源基础设施",
  "<span>开发运行时</span>",
]) {
  if (!appSource.includes(localizedMicroCopy)) {
    errors.push(`Console microcopy must keep localized labels: ${localizedMicroCopy}`);
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

if (!appSource.includes("const searchableText = [...row.cells, displayStatus(row.status), nextStepForStatus(row.status)].join(\" \").toLowerCase()")) {
  errors.push("Console table search must include localized status and next-step text.");
}

if (appSource.includes("modules ·") || appSource.includes("{rows.length} / {tableView.rows.length} rows") || !appSource.includes("个模块") || !appSource.includes("条记录")) {
  errors.push("Console count units must use localized module and table copy.");
}

if (!appSource.includes('<CheckCircle2 aria-hidden="true"') || !appSource.includes('<CircleAlert aria-hidden="true"')) {
  errors.push("Console decorative status icons must be hidden from assistive technology.");
}

if (!appSource.includes("aria-label={`状态：${label}`}") || !appSource.includes("className={`status status--${tone}`}")) {
  errors.push("Console status badges must expose readable status labels.");
}

if (
  !appSource.includes("function displayStatus") ||
  !appSource.includes('Active: "运行中"') ||
  !appSource.includes('Warning: "预警"') ||
  !appSource.includes('Pending: "待处理"') ||
  !appSource.includes('Resolved: "已处理"')
) {
  errors.push("Console status values must use a localized display layer.");
}

if (!appSource.includes("const label = typeof children === \"string\" ? displayStatus(children) : children")) {
  errors.push("Console status badges must render localized status labels.");
}

if (!appSource.includes('{item === "全部状态" ? item : displayStatus(item)}')) {
  errors.push("Console status filters must show localized status labels while keeping raw enum values.");
}

if (
  !appSource.includes("ariaLabel={`${page.title}：${tableView.title}`}") ||
  !appSource.includes("aria-selected") ||
  !appSource.includes("aria-label={onRowSelect ? `选择 ${row.cells[0]}${selected ? \"，当前选中\" : \"\"}` : undefined}") ||
  !appSource.includes("const selected = row.id === selectedRowId")
) {
  errors.push("Console data tables must keep accessible table labels and selectable row state.");
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

if (
  !appSource.includes('aria-current={state === "active" ? "step" : undefined}') ||
  !appSource.includes('<span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>') ||
  !appSource.includes('const stateLabel = state === "done" ? "已完成" : state === "active" ? "当前步骤" : "下一步"') ||
  !appSource.includes("aria-label={`${step.label}：${stateLabel}，${step.note}`}")
) {
  errors.push("Console module workflow must expose step summaries and hide decorative step numbers.");
}

if (!styleSource.includes('.tab-row button:focus-visible') || !styleSource.includes('.tab-row button[aria-selected="true"]')) {
  errors.push("Console module tabs must show visible focus and selected states in the stylesheet.");
}

if (!appSource.includes("filtersActive") || !appSource.includes("清空筛选")) {
  errors.push("Console data tables must provide a clear filter action when filters are active.");
}

if (!appSource.includes("aria-label={`${page.title} 状态筛选`")) {
  errors.push("Console status filters must expose accessible labels.");
}

if (
  !appSource.includes("emptyTitle={filtersActive ?") ||
  !appSource.includes("当前筛选没有结果") ||
  !appSource.includes('aria-label={`${emptyTitle}：${emptyDescription}`} role="status"')
) {
  errors.push("Console data tables must provide contextual empty states for active filters.");
}

if (!appSource.includes("aria-label={`下一步：${nextStep}，当前状态 ${displayStatus(row.status)}`}") || !appSource.includes("<span>下一步</span>")) {
  errors.push("Console selected row details must expose localized next-step guidance.");
}

if (!appSource.includes("visibleModuleCount") || !appSource.includes("lockedModuleCount") || !appSource.includes("清空搜索")) {
  errors.push("Console home module entry must show role access counts and a clear search action.");
}

if (
  !appSource.includes('aria-label="进入帮助文档开始接入"') ||
  !appSource.includes("aria-label={`清空模块搜索：${moduleQuery}`}") ||
  !appSource.includes("aria-label={`清空${page.title}表格筛选`}")
) {
  errors.push("Console primary entry and clear-filter actions must expose explicit accessible labels.");
}

if (!appSource.includes("aria-label={`进入${item.label}`}")) {
  errors.push("Console home module entry links must expose explicit destination labels.");
}

if (
  !appSource.includes("aria-label={`查看${item.label}架构模块`}") ||
  !appSource.includes("<item.icon aria-hidden=\"true\" size={20} />")
) {
  errors.push("Landing architecture cards must expose destination labels and hide decorative icons.");
}

if (!appSource.includes("<item.icon aria-hidden=\"true\" size={18} />")) {
  errors.push("Console home module card icons must be hidden as decorative icons.");
}

if (!appSource.includes('aria-label="搜索模块、能力或入口"') || !appSource.includes("aria-label={`${page.title} 表格搜索`")) {
  errors.push("Console search inputs must expose accessible labels without relying on placeholders.");
}

if (appSource.includes('placeholder="Search"') || !appSource.includes('placeholder="搜索表格"')) {
  errors.push("Console module table search placeholder must use localized copy.");
}

if ((appSource.match(/<Search aria-hidden="true" size=\{16\}/g) || []).length < 2) {
  errors.push("Console decorative search icons must be hidden from assistive technology.");
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

if (
  !appSource.includes("visibleOpenTodos") ||
  !appSource.includes("hiddenOpenTodoCount") ||
  !appSource.includes('className="todo-more"') ||
  !appSource.includes("进入运营总览查看全部待办")
) {
  errors.push("Console home todo list must explain hidden overflow work and link to the full operations view.");
}

if (
  !appSource.includes("aria-label=\"没有找到模块：换一个关键词，例如网关、计费、API 或权限。\"") ||
  !appSource.includes("aria-label=\"今日待办已清空：新的告警、审批或接入校验会自动出现在这里。\"") ||
  !appSource.includes('className="todo-empty" role="status"')
) {
  errors.push("Console home empty states must expose readable status summaries.");
}

for (const staleBackendTitle of ['title: "Access / IAM"', 'title: "Gateway / Model"', 'title: "Quota / Billing"', 'title: "Operations"']) {
  if (dataSource.includes(staleBackendTitle)) {
    errors.push(`Console backend plan titles must use localized service names instead of ${staleBackendTitle}.`);
  }
}

for (const localizedBackendTitle of ["用户与权限服务", "网关与模型服务", "计费与配额服务", "运营总览服务"]) {
  if (!dataSource.includes(localizedBackendTitle)) {
    errors.push(`Console backend plan must keep localized service name: ${localizedBackendTitle}`);
  }
}

if (!appSource.includes("aria-label={`查看待办所属模块：${todo.title}`}")) {
  errors.push("Console home todo view links must expose their target context.");
}

if (!appSource.includes("处理待办：${todo.title}") || !appSource.includes("无法处理待办：${todo.title}，需要管理员或运维人员")) {
  errors.push("Console home todo action buttons must expose role-aware accessible labels.");
}

if (!appSource.includes("quickstart-snippet") || !appSource.includes("复制调用示例") || !appSource.includes("navigator.clipboard.writeText")) {
  errors.push("Console Quickstart must provide a copyable minimal call snippet.");
}

if (
  !appSource.includes("复制失败") ||
  !appSource.includes("快速接入 curl 调用示例") ||
  !appSource.includes('className="quickstart-snippet__hint" role="status"')
) {
  errors.push("Console Quickstart copy action must expose success/error feedback and an accessible snippet label.");
}

if (!appSource.includes("ak_live_xxx") || !appSource.includes("QuickstartSnippet curl={placeholderCurl}")) {
  errors.push("Console Quickstart must show a placeholder call snippet before an application exists.");
}

if (
  !appSource.includes("function QuickstartChecklist") ||
  !appSource.includes("发送最小调用") ||
  !appSource.includes("hasRequestLogs") ||
  !appSource.includes("StatusBadge tone={toneForStatus(step.status)}") ||
  !appSource.includes('aria-label="快速接入最小清单"') ||
  !appSource.includes("aria-label={`${step.title}：${step.status}，${step.note}`}") ||
  !appSource.includes('<span aria-hidden="true">{step.label}</span>')
) {
  errors.push("Console Quickstart must show the minimal onboarding checklist with live statuses.");
}

if (
  !accessSource.includes("canManageApplicationOnboarding") ||
  !appSource.includes("canManageApplicationOnboarding(role)") ||
  !appSource.includes("需要管理员、使用用户或开发人员处理接入应用") ||
  !appSource.includes("轮换 ${application.name} 的 API Key") ||
  !appSource.includes("无法完成 ${application.name} 的接入校验，当前角色不能处理接入应用") ||
  !appSource.includes("<ChevronRight aria-hidden=\"true\" size={16} />")
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
