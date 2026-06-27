import { describe, expect, it } from "vitest";

import { buildGatewayRouteCreateInput, parseGatewayRouteWeights } from "./routePolicy";

describe("gateway route policy form", () => {
  it("builds an ordered route with required fields only", () => {
    expect(
      buildGatewayRouteCreateInput({
        route: " /api/v1/agents/** ",
        upstream: " gateway-api ",
        limit: " 600/min ",
      }),
    ).toEqual({
      route: "/api/v1/agents/**",
      upstream: "gateway-api",
      limit: "600/min",
      strategy: "ordered",
    });
  });

  it("parses weighted upstreams and canary routing", () => {
    expect(
      buildGatewayRouteCreateInput({
        route: "/api/v1/llm/**",
        upstream: "https://primary.example.com, https://fallback.example.com",
        limit: "1200/min",
        strategy: "weighted",
        upstreamWeights: "https://primary.example.com=20, https://fallback.example.com=80",
        canaryHeader: "X-Release-Cohort",
        canaryValue: "beta",
        canaryUpstream: "https://canary.example.com",
      }),
    ).toEqual({
      route: "/api/v1/llm/**",
      upstream: "https://primary.example.com, https://fallback.example.com",
      limit: "1200/min",
      strategy: "weighted",
      upstreamWeights: {
        "https://primary.example.com": 20,
        "https://fallback.example.com": 80,
      },
      canaryHeader: "X-Release-Cohort",
      canaryValue: "beta",
      canaryUpstream: "https://canary.example.com",
    });
  });

  it("accepts compact colon weight syntax for simple service names", () => {
    expect(parseGatewayRouteWeights("gateway-a:70; gateway-b:30")).toEqual({
      "gateway-a": 70,
      "gateway-b": 30,
    });
  });

  it("rejects weights outside of weighted strategy", () => {
    expect(() =>
      buildGatewayRouteCreateInput({
        route: "/api/v1/llm/**",
        upstream: "gateway-a,gateway-b",
        limit: "600/min",
        strategy: "round_robin",
        upstreamWeights: "gateway-a=50,gateway-b=50",
      }),
    ).toThrow(/Weighted/);
  });

  it("rejects weighted upstreams that are not candidates", () => {
    expect(() =>
      buildGatewayRouteCreateInput({
        route: "/api/v1/llm/**",
        upstream: "gateway-a,gateway-b",
        limit: "600/min",
        strategy: "weighted",
        upstreamWeights: "gateway-c=50",
      }),
    ).toThrow(/不在候选上游/);
  });

  it("rejects partial canary rules", () => {
    expect(() =>
      buildGatewayRouteCreateInput({
        route: "/api/v1/llm/**",
        upstream: "gateway-api",
        limit: "600/min",
        canaryHeader: "X-Release-Cohort",
      }),
    ).toThrow(/灰度规则/);
  });
});
