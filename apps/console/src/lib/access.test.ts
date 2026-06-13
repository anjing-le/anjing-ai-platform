import { describe, expect, it } from "vitest";

import { navItems, roles } from "../data/console";
import type { ConsoleRoute, RoleId } from "../types";
import { canAccessRoute, fallbackRouteForRole, visibleNavItems } from "./access";

const routeIds = navItems.map((item) => item.id);

function visibleRouteIds(role: RoleId): ConsoleRoute[] {
  return visibleNavItems(role).map((item) => item.id);
}

describe("console role access", () => {
  it("keeps administrator visibility aligned with every console entry", () => {
    expect(visibleRouteIds("admin")).toEqual(routeIds);
  });

  it("keeps each product role focused on its allowed modules", () => {
    expect(visibleRouteIds("user")).toEqual(["home", "overview", "quota", "docs"]);
    expect(visibleRouteIds("developer")).toEqual(["home", "overview", "gateway", "quota", "docs"]);
    expect(visibleRouteIds("operator")).toEqual(["home", "overview", "quota"]);
  });

  it("denies restricted modules while keeping a safe fallback route", () => {
    expect(canAccessRoute("operator", "gateway")).toBe(false);
    expect(canAccessRoute("developer", "iam")).toBe(false);
    expect(canAccessRoute("user", "gateway")).toBe(false);

    for (const role of roles) {
      expect(fallbackRouteForRole(role.id)).toBe("home");
    }
  });
});
