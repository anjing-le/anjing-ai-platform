import { navItems } from "../data/console";
import type { ConsoleRoute, NavItem, RoleId } from "../types";

export function visibleNavItems(role: RoleId, items: NavItem[] = navItems): NavItem[] {
  return items.filter((item) => item.roles.includes(role));
}

export function canAccessRoute(
  role: RoleId,
  route: ConsoleRoute,
  items: NavItem[] = navItems,
): boolean {
  return visibleNavItems(role, items).some((item) => item.id === route);
}

export function fallbackRouteForRole(role: RoleId, items: NavItem[] = navItems): ConsoleRoute {
  return visibleNavItems(role, items)[0]?.id ?? "home";
}
