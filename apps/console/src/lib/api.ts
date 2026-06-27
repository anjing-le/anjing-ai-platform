import type { MetricItem, RoleId, StatusTone } from "../types";

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface ApiMetric {
  label: string;
  value: string;
  note: string;
}

export interface OpsTodo {
  id: string;
  title: string;
  source: string;
  owner: string;
  status: string;
  updatedAt: string;
}

export interface ServiceHealth {
  id: string;
  name: string;
  slo: string;
  p95: string;
  status: string;
}

export interface AuditEvent {
  id: string;
  time: string;
  module: string;
  action: string;
  object: string;
  status: string;
  requestId: string;
}

export interface OpsDashboard {
  metrics: ApiMetric[];
  todos: OpsTodo[];
  health: ServiceHealth[];
  audit: AuditEvent[];
}

export interface ControlUser {
  id: string;
  email: string;
  org: string;
  role: string;
  mfa: string;
  status: string;
  createdAt: string;
}

export interface Application {
  id: string;
  name: string;
  owner: string;
  environment: string;
  apiKey: string;
  defaultRoute: string;
  plan: string;
  status: string;
  createdAt: string;
}

export interface RolePolicy {
  id: string;
  name: string;
  visibleEntries: string;
  configScope: string;
  restriction: string;
  status: string;
}

export interface APIKey {
  id: string;
  name: string;
  project: string;
  scope: string;
  expiresAt: string;
  status: string;
  maskedPreview: string;
  lastUsedAt: string;
  rotatedAt: string;
  revokedAt: string;
}

export interface Credential {
  id: string;
  ref: string;
  purpose: string;
  scope: string;
  expiresAt: string;
  status: string;
  maskedPreview: string;
  rotatedAt: string;
}

export interface GatewayRoute {
  id: string;
  route: string;
  upstream: string;
  auth: string;
  limit: string;
  strategy: GatewayProxyStrategy;
  upstreamWeights?: Record<string, number>;
  canaryHeader?: string;
  canaryValue?: string;
  canaryUpstream?: string;
  status: string;
  updatedAt: string;
}

export interface GatewayRouteHealthCheck {
  id: string;
  route: string;
  upstream: string;
  status: "Healthy" | "Degraded" | "Unreachable" | "Invalid";
  healthy: boolean;
  statusCode: number;
  latencyMs: number;
  checkedAt: string;
  error?: string;
}

export interface GatewayRoutePreflightCheck {
  name: string;
  status: "Pass" | "Warn" | "Block";
  severity: "info" | "warning" | "critical";
  message: string;
}

export interface GatewayRoutePreflight {
  id: string;
  route: string;
  upstream: string;
  status: "Pass" | "Warn" | "Block";
  ready: boolean;
  checkedAt: string;
  checks: GatewayRoutePreflightCheck[];
  health?: GatewayRouteHealthCheck;
}

export type GatewayProxyStrategy = "ordered" | "round_robin" | "weighted";

export interface GatewayProxyRequest {
  route: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  upstream?: string;
  upstreams?: string[];
  upstreamWeights?: Record<string, number>;
  fallbackUpstream?: string;
  strategy?: GatewayProxyStrategy;
  canaryHeader?: string;
  canaryValue?: string;
  canaryUpstream?: string;
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
  body?: string;
  stream?: boolean;
}

export interface GatewayProxyResponse {
  route: string;
  upstream: string;
  strategy?: GatewayProxyStrategy;
  candidateUpstreams?: string[];
  canaryMatched?: boolean;
  statusCode: number;
  attempts: number;
  fallback: boolean;
  durationMs: number;
  headers: Record<string, string[]>;
  body: string;
}

export interface ModelRoute {
  id: string;
  alias: string;
  scenario: string;
  primary: string;
  fallback: string;
  status: string;
  updatedAt: string;
}

export interface SkillBinding {
  id: string;
  name: string;
  protocol: string;
  route: string;
  timeout: string;
  schemaVersion: string;
  status: string;
  updatedAt: string;
}

export interface RequestLog {
  id: string;
  request: string;
  consumer: string;
  latency: string;
  result: string;
  status: string;
  createdAt: string;
}

export interface LLMInvokeResponse {
  id: string;
  modelAlias: string;
  provider: string;
  model: string;
  fallback: string;
  usedFallback: boolean;
  content: string;
  finishReason: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

export interface LLMInvokeInput {
  modelAlias: string;
  input: string;
}

export interface SkillInvokeResponse {
  id: string;
  name: string;
  protocol: string;
  route: string;
  output: {
    summary?: string;
    inputKeys?: string[];
    [key: string]: unknown;
  };
  usage: {
    skillCalls: number;
  };
}

export interface SkillInvokeInput {
  name: string;
  input: Record<string, unknown>;
}

export interface BillingPlan {
  id: string;
  name: string;
  target: string;
  rps: string;
  tokenPerDay: string;
  status: string;
}

export interface UsageRecord {
  id: string;
  project: string;
  tokens: string;
  skillCalls: string;
  cost: string;
  status: string;
  updatedAt: string;
}

export interface BillingInvoiceSummary {
  id: string;
  project: string;
  period: string;
  tokens: string;
  skillCalls: string;
  cost: string;
  budget: string;
  threshold: string;
  utilization: string;
  status: string;
}

export interface BudgetAlert {
  id: string;
  project: string;
  budget: string;
  current: string;
  threshold: string;
  status: string;
}

export interface PlatformSnapshot {
  dashboard?: OpsDashboard;
  users?: ControlUser[];
  applications?: Application[];
  roles?: RolePolicy[];
  apiKeys?: APIKey[];
  credentials?: Credential[];
  routes?: GatewayRoute[];
  modelRoutes?: ModelRoute[];
  skills?: SkillBinding[];
  requestLogs?: RequestLog[];
  plans?: BillingPlan[];
  usage?: UsageRecord[];
  billingSummaries?: BillingInvoiceSummary[];
  budgetAlerts?: BudgetAlert[];
}

export interface SnapshotResult {
  snapshot: PlatformSnapshot;
  ok: boolean;
  loaded: number;
  failed: number;
  source: "aggregate" | "granular" | "none";
}

export type AccessRole = "Administrator" | "User" | "Developer" | "Operator";

export interface AuthPrincipal {
  subject: string;
  role: AccessRole;
  method: string;
}

export interface AuthSession {
  token: string;
  principal: AuthPrincipal;
  expiresAt: string;
}

export interface AuthSessionStatus {
  authenticated: boolean;
  principal: AuthPrincipal;
}

export interface CreateUserInput {
  email: string;
  org: string;
  role: string;
}

export interface CreateApplicationInput {
  name: string;
  owner: string;
  environment: string;
  defaultRoute: string;
  plan: string;
}

export interface CreateRouteInput {
  route: string;
  upstream: string;
  limit: string;
  strategy?: GatewayProxyStrategy;
  upstreamWeights?: Record<string, number>;
  canaryHeader?: string;
  canaryValue?: string;
  canaryUpstream?: string;
}

export interface UpdateRouteInput extends CreateRouteInput {
  id: string;
}

export interface CreateModelRouteInput {
  alias: string;
  scenario: string;
  primary: string;
  fallback: string;
}

export interface UpdateModelRouteInput extends CreateModelRouteInput {
  id: string;
}

export interface CreateSkillBindingInput {
  name: string;
  protocol: string;
  route: string;
  timeout: string;
  schemaVersion?: string;
}

export interface CreatePlanInput {
  name: string;
  rps: string;
  tokenPerDay: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const demoTokens: Record<RoleId, string> = {
  admin: "dev-admin-token",
  user: "dev-user-token",
  developer: "dev-developer-token",
  operator: "dev-operator-token",
};

const demoLogins: Record<RoleId, { email: string; role: AccessRole }> = {
  admin: { email: "lin.chen@anjing.ai", role: "Administrator" },
  user: { email: "demo-user@anjing.ai", role: "User" },
  developer: { email: "dev-api@anjing.ai", role: "Developer" },
  operator: { email: "ops-console@anjing.ai", role: "Operator" },
};

const sessionTokens = new Map<RoleId, string>();

const endpoints = {
  dashboard: "/api/ops/dashboard",
  users: "/api/control/users",
  applications: "/api/control/applications",
  roles: "/api/control/roles",
  apiKeys: "/api/control/api-keys",
  credentials: "/api/control/credentials",
  routes: "/api/gateway/routes",
  modelRoutes: "/api/gateway/model-routes",
  skills: "/api/gateway/skills",
  requestLogs: "/api/gateway/request-logs",
  plans: "/api/billing/plans",
  usage: "/api/billing/usage",
  billingSummaries: "/api/billing/invoices",
  budgetAlerts: "/api/billing/budget-alerts",
} as const;

type EndpointKey = keyof typeof endpoints;

export async function loadPlatformSnapshot(role?: RoleId): Promise<SnapshotResult> {
  try {
    const snapshot = await requestJson<PlatformSnapshot>("/api/ops/platform-snapshot", undefined, role);
    return {
      snapshot,
      ok: true,
      loaded: 1,
      failed: 0,
      source: "aggregate",
    };
  } catch {
    // Older local servers may not expose the aggregate endpoint yet.
  }

  const entries = Object.entries(endpoints) as Array<[EndpointKey, string]>;
  const settled = await Promise.allSettled(
    entries.map(async ([key, path]) => [key, await requestJson<unknown>(path, undefined, role)] as const),
  );

  const snapshot: PlatformSnapshot = {};
  let loaded = 0;
  let failed = 0;

  for (const item of settled) {
    if (item.status === "fulfilled") {
      const [key, data] = item.value;
      snapshot[key] = data as never;
      loaded += 1;
    } else {
      failed += 1;
    }
  }

  return {
    snapshot,
    ok: loaded > 0,
    loaded,
    failed,
    source: loaded > 0 ? "granular" : "none",
  };
}

export async function loginSession(role: RoleId): Promise<AuthSession> {
  const session = await requestJson<AuthSession>("/api/control/auth/login", {
    method: "POST",
    body: JSON.stringify(demoLogins[role]),
  });
  sessionTokens.set(role, session.token);
  return session;
}

export function loadCurrentSession(role?: RoleId): Promise<AuthSessionStatus> {
  return requestJson<AuthSessionStatus>("/api/control/auth/session", undefined, role);
}

export async function logoutSession(role: RoleId): Promise<{ revoked: boolean }> {
  const result = await requestJson<{ revoked: boolean }>("/api/control/auth/logout", {
    method: "POST",
    body: JSON.stringify({}),
  }, role);
  sessionTokens.delete(role);
  return result;
}

export function metricFromApi(metric: ApiMetric, tone: StatusTone = "neutral"): MetricItem {
  return {
    label: metric.label,
    value: metric.value,
    note: metric.note,
    tone,
  };
}

export function createUser(input: CreateUserInput, role?: RoleId): Promise<ControlUser> {
  return requestJson<ControlUser>("/api/control/users", {
    method: "POST",
    body: JSON.stringify(input),
  }, role);
}

export function activateUser(id: string, role?: RoleId): Promise<ControlUser> {
  return requestJson<ControlUser>("/api/control/users/activate", {
    method: "POST",
    body: JSON.stringify({ id }),
  }, role);
}

export function createApplication(input: CreateApplicationInput, role?: RoleId): Promise<Application> {
  return requestJson<Application>("/api/control/applications", {
    method: "POST",
    body: JSON.stringify(input),
  }, role);
}

export function activateApplication(id: string, role?: RoleId): Promise<Application> {
  return requestJson<Application>("/api/control/applications/activate", {
    method: "POST",
    body: JSON.stringify({ id }),
  }, role);
}

export function rotateApplicationKey(id: string, role?: RoleId): Promise<Application> {
  return requestJson<Application>("/api/control/applications/rotate-key", {
    method: "POST",
    body: JSON.stringify({ id }),
  }, role);
}

export function createRoute(input: CreateRouteInput, role?: RoleId): Promise<GatewayRoute> {
  return requestJson<GatewayRoute>("/api/gateway/routes", {
    method: "POST",
    body: JSON.stringify(input),
  }, role);
}

export function updateRoute(input: UpdateRouteInput, role?: RoleId): Promise<GatewayRoute> {
  return requestJson<GatewayRoute>("/api/gateway/routes/update", {
    method: "POST",
    body: JSON.stringify(input),
  }, role);
}

export function publishRoute(id: string, role?: RoleId): Promise<GatewayRoute> {
  return requestJson<GatewayRoute>("/api/gateway/routes/publish", {
    method: "POST",
    body: JSON.stringify({ id }),
  }, role);
}

export function checkRouteHealth(id: string, role?: RoleId, timeoutMs = 1000): Promise<GatewayRouteHealthCheck> {
  return requestJson<GatewayRouteHealthCheck>("/api/gateway/routes/health-check", {
    method: "POST",
    body: JSON.stringify({ id, timeoutMs }),
  }, role);
}

export function preflightRoute(id: string, role?: RoleId, timeoutMs = 1000): Promise<GatewayRoutePreflight> {
  return requestJson<GatewayRoutePreflight>("/api/gateway/routes/preflight", {
    method: "POST",
    body: JSON.stringify({ id, timeoutMs }),
  }, role);
}

export function proxyGatewayRequest(input: GatewayProxyRequest, role?: RoleId): Promise<GatewayProxyResponse> {
  return requestJson<GatewayProxyResponse>("/api/gateway/proxy", {
    method: "POST",
    body: JSON.stringify(input),
  }, role);
}

export function createModelRoute(input: CreateModelRouteInput, role?: RoleId): Promise<ModelRoute> {
  return requestJson<ModelRoute>("/api/gateway/model-routes", {
    method: "POST",
    body: JSON.stringify(input),
  }, role);
}

export function updateModelRoute(input: UpdateModelRouteInput, role?: RoleId): Promise<ModelRoute> {
  return requestJson<ModelRoute>("/api/gateway/model-routes/update", {
    method: "POST",
    body: JSON.stringify(input),
  }, role);
}

export function publishModelRoute(id: string, role?: RoleId): Promise<ModelRoute> {
  return requestJson<ModelRoute>("/api/gateway/model-routes/publish", {
    method: "POST",
    body: JSON.stringify({ id }),
  }, role);
}

export function createSkillBinding(input: CreateSkillBindingInput, role?: RoleId): Promise<SkillBinding> {
  return requestJson<SkillBinding>("/api/gateway/skills", {
    method: "POST",
    body: JSON.stringify(input),
  }, role);
}

export function publishSkillBinding(id: string, role?: RoleId): Promise<SkillBinding> {
  return requestJson<SkillBinding>("/api/gateway/skills/publish", {
    method: "POST",
    body: JSON.stringify({ id }),
  }, role);
}

export function invokeSkill(input: SkillInvokeInput, role?: RoleId): Promise<SkillInvokeResponse> {
  return requestJson<SkillInvokeResponse>("/api/gateway/skills/invoke", {
    method: "POST",
    body: JSON.stringify(input),
  }, role);
}

export function createPlan(input: CreatePlanInput, role?: RoleId): Promise<BillingPlan> {
  return requestJson<BillingPlan>("/api/billing/plans", {
    method: "POST",
    body: JSON.stringify(input),
  }, role);
}

export function activatePlan(id: string, role?: RoleId): Promise<BillingPlan> {
  return requestJson<BillingPlan>("/api/billing/plans/activate", {
    method: "POST",
    body: JSON.stringify({ id }),
  }, role);
}

export function resolveBudgetAlert(id: string, role?: RoleId): Promise<BudgetAlert> {
  return requestJson<BudgetAlert>("/api/billing/budget-alerts/resolve", {
    method: "POST",
    body: JSON.stringify({ id }),
  }, role);
}

export function rotateCredential(id: string, role?: RoleId): Promise<Credential> {
  return requestJson<Credential>("/api/control/credentials/rotate", {
    method: "POST",
    body: JSON.stringify({ id }),
  }, role);
}

export function revokeAPIKey(id: string, role?: RoleId): Promise<APIKey> {
  return requestJson<APIKey>("/api/control/api-keys/revoke", {
    method: "POST",
    body: JSON.stringify({ id }),
  }, role);
}

export function resolveTodo(id: string, role?: RoleId): Promise<OpsTodo> {
  return requestJson<OpsTodo>("/api/ops/todos/resolve", {
    method: "POST",
    body: JSON.stringify({ id }),
  }, role);
}

export function invokeLLM(input: LLMInvokeInput, role?: RoleId): Promise<LLMInvokeResponse> {
  return requestJson<LLMInvokeResponse>("/api/gateway/llm/invoke", {
    method: "POST",
    body: JSON.stringify(input),
  }, role);
}

async function requestJson<T>(path: string, init?: RequestInit, role?: RoleId): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(role),
      ...init?.headers,
    },
  });
  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !payload.success) {
    throw new Error(payload.error?.message || `request failed: ${path}`);
  }

  return payload.data as T;
}

function authHeaders(role?: RoleId): Record<string, string> {
  if (!role) {
    return {};
  }

  return {
    Authorization: `Bearer ${sessionTokens.get(role) ?? demoTokens[role]}`,
  };
}
