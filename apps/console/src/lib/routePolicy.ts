import type { CreateRouteInput, GatewayProxyStrategy, GatewayRoute, UpdateRouteInput } from "./api";

const routeStrategies: GatewayProxyStrategy[] = ["ordered", "round_robin", "weighted"];
const maxRouteWeight = 10000;

export function buildGatewayRouteCreateInput(values: Record<string, string>): CreateRouteInput {
  return buildGatewayRoutePolicyInput(values);
}

export function buildGatewayRouteUpdateInput(id: string, values: Record<string, string>): UpdateRouteInput {
  return {
    id: requiredValue(id, "Route ID"),
    ...buildGatewayRoutePolicyInput(values),
  };
}

export function gatewayRouteToActionValues(route: GatewayRoute): Record<string, string> {
  return {
    route: route.route,
    upstream: route.upstream,
    limit: route.limit,
    strategy: route.strategy || "ordered",
    upstreamWeights: stringifyGatewayRouteWeights(route.upstreamWeights),
    canaryHeader: route.canaryHeader || "",
    canaryValue: route.canaryValue || "",
    canaryUpstream: route.canaryUpstream || "",
  };
}

export function stringifyGatewayRouteWeights(weights?: Record<string, number>): string {
  if (!weights || !Object.keys(weights).length) {
    return "";
  }

  return Object.entries(weights)
    .map(([upstream, weight]) => `${upstream}=${weight}`)
    .join(", ");
}

function buildGatewayRoutePolicyInput(values: Record<string, string>): CreateRouteInput {
  const route = requiredValue(values.route, "Route");
  const upstream = requiredValue(values.upstream, "Upstream");
  const limit = requiredValue(values.limit, "Limit");
  const strategy = normalizeGatewayRouteStrategy(values.strategy);
  const upstreamWeights = parseGatewayRouteWeights(values.upstreamWeights || "");
  const canaryHeader = trimValue(values.canaryHeader);
  const canaryValue = trimValue(values.canaryValue);
  const canaryUpstream = trimValue(values.canaryUpstream);

  validateGatewayRouteWeights(strategy, upstream, upstreamWeights);
  validateGatewayRouteCanary(canaryHeader, canaryUpstream);

  return {
    route,
    upstream,
    limit,
    strategy,
    ...(upstreamWeights ? { upstreamWeights } : {}),
    ...(canaryHeader ? { canaryHeader } : {}),
    ...(canaryValue ? { canaryValue } : {}),
    ...(canaryUpstream ? { canaryUpstream } : {}),
  };
}

export function parseGatewayRouteWeights(value: string): Record<string, number> | undefined {
  const raw = trimValue(value);
  if (!raw) {
    return undefined;
  }

  const weights: Record<string, number> = {};
  for (const entry of raw.split(/[,;\n]+/)) {
    const part = trimValue(entry);
    if (!part) {
      continue;
    }

    const parsed = parseGatewayRouteWeightEntry(part);
    if (weights[parsed.upstream] !== undefined) {
      throw new Error(`权重配置重复：${parsed.upstream}`);
    }
    weights[parsed.upstream] = parsed.weight;
  }

  return Object.keys(weights).length ? weights : undefined;
}

function normalizeGatewayRouteStrategy(value: string | undefined): GatewayProxyStrategy {
  const normalized = trimValue(value || "ordered").replace(/-/g, "_");
  if (routeStrategies.includes(normalized as GatewayProxyStrategy)) {
    return normalized as GatewayProxyStrategy;
  }
  throw new Error("请选择有效的负载策略。");
}

function parseGatewayRouteWeightEntry(entry: string): { upstream: string; weight: number } {
  let separatorIndex = entry.lastIndexOf("=");
  if (separatorIndex < 0 && !entry.includes("://")) {
    separatorIndex = entry.lastIndexOf(":");
  }
  if (separatorIndex <= 0 || separatorIndex === entry.length - 1) {
    throw new Error("权重格式应为 upstream=weight，例如 gateway-a=80,gateway-b=20。");
  }

  const upstream = trimValue(entry.slice(0, separatorIndex));
  const rawWeight = trimValue(entry.slice(separatorIndex + 1));
  const weight = Number(rawWeight);
  if (!upstream) {
    throw new Error("权重配置里的 upstream 不能为空。");
  }
  if (!Number.isInteger(weight) || weight <= 0 || weight > maxRouteWeight) {
    throw new Error(`权重必须是 1 到 ${maxRouteWeight} 的整数。`);
  }

  return { upstream, weight };
}

function validateGatewayRouteWeights(
  strategy: GatewayProxyStrategy,
  upstream: string,
  upstreamWeights: Record<string, number> | undefined,
) {
  if (!upstreamWeights) {
    return;
  }
  if (strategy !== "weighted") {
    throw new Error("只有 Weighted 策略会使用权重配置。");
  }

  const candidates = new Set(splitGatewayRouteUpstreams(upstream));
  for (const weightedUpstream of Object.keys(upstreamWeights)) {
    if (!candidates.has(weightedUpstream)) {
      throw new Error(`权重 upstream 不在候选上游中：${weightedUpstream}`);
    }
  }
}

function validateGatewayRouteCanary(canaryHeader: string, canaryUpstream: string) {
  if (!canaryHeader && !canaryUpstream) {
    return;
  }
  if (!canaryHeader || !canaryUpstream) {
    throw new Error("灰度规则需要同时填写 Header 和 Canary Upstream。");
  }
}

function splitGatewayRouteUpstreams(upstream: string): string[] {
  return upstream
    .split(/[,;\n]+/)
    .map((item) => trimValue(item))
    .filter(Boolean);
}

function requiredValue(value: string | undefined, label: string) {
  const trimmed = trimValue(value);
  if (!trimmed) {
    throw new Error(`${label} 不能为空。`);
  }
  return trimmed;
}

function trimValue(value: string | undefined) {
  return (value || "").trim();
}
