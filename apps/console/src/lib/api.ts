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
}

export interface Credential {
  id: string;
  ref: string;
  purpose: string;
  scope: string;
  expiresAt: string;
  status: string;
  maskedPreview: string;
}

export interface GatewayRoute {
  id: string;
  route: string;
  upstream: string;
  auth: string;
  limit: string;
  status: string;
  updatedAt: string;
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
  budgetAlerts?: BudgetAlert[];
}

export interface SnapshotResult {
  snapshot: PlatformSnapshot;
  ok: boolean;
  loaded: number;
  failed: number;
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
}

export interface CreateModelRouteInput {
  alias: string;
  scenario: string;
  primary: string;
  fallback: string;
}

export interface CreateSkillBindingInput {
  name: string;
  protocol: string;
  route: string;
  timeout: string;
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
  budgetAlerts: "/api/billing/budget-alerts",
} as const;

type EndpointKey = keyof typeof endpoints;

export async function loadPlatformSnapshot(role?: RoleId): Promise<SnapshotResult> {
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
  };
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

export function publishRoute(id: string, role?: RoleId): Promise<GatewayRoute> {
  return requestJson<GatewayRoute>("/api/gateway/routes/publish", {
    method: "POST",
    body: JSON.stringify({ id }),
  }, role);
}

export function createModelRoute(input: CreateModelRouteInput, role?: RoleId): Promise<ModelRoute> {
  return requestJson<ModelRoute>("/api/gateway/model-routes", {
    method: "POST",
    body: JSON.stringify(input),
  }, role);
}

export function createSkillBinding(input: CreateSkillBindingInput, role?: RoleId): Promise<SkillBinding> {
  return requestJson<SkillBinding>("/api/gateway/skills", {
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
    Authorization: `Bearer ${demoTokens[role]}`,
  };
}
