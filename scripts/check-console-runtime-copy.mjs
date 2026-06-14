import { readFileSync } from "node:fs";

const errors = [];
const appSource = readFileSync("apps/console/src/App.tsx", "utf8");
const dataSource = readFileSync("apps/console/src/data/console.ts", "utf8");

if (!appSource.includes("<code>pnpm dev:api</code>")) {
  errors.push("Console home runtime command must show pnpm dev:api.");
}

if (appSource.includes("<code>go run ./cmd/platform-all</code>")) {
  errors.push("Console home must not show raw go run ./cmd/platform-all as the primary runtime command.");
}

if (!appSource.includes("刷新平台数据") || !appSource.includes("RefreshCw")) {
  errors.push("Console topbar must expose a manual platform data refresh action.");
}

if (!appSource.includes("lastSyncedAt") || !appSource.includes("最近同步") || !appSource.includes("等待首次同步")) {
  errors.push("Console topbar must show platform data freshness after refresh attempts.");
}

if (!appSource.includes("window.setTimeout") || !appSource.includes("setNotice(\"\")")) {
  errors.push("Console notices must clear automatically after a short delay.");
}

if (!appSource.includes("table-result-count") || !appSource.includes("tableView.rows.length")) {
  errors.push("Console data tables must show filtered row counts.");
}

if (!appSource.includes("ariaLabel={`${page.title} - ${tableView.title}`}") || !appSource.includes("aria-selected")) {
  errors.push("Console data tables must keep accessible table labels and selected row state.");
}

if (!appSource.includes("filtersActive") || !appSource.includes("清空筛选")) {
  errors.push("Console data tables must provide a clear filter action when filters are active.");
}

if (!appSource.includes("quickstart-snippet") || !appSource.includes("复制调用示例") || !appSource.includes("navigator.clipboard.writeText")) {
  errors.push("Console Quickstart must provide a copyable minimal call snippet.");
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
