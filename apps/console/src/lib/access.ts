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

export function canRunPrimaryAction(role: RoleId, route: ConsoleRoute): boolean {
  if (route === "home") {
    return true;
  }

  if (route === "overview") {
    return role === "admin" || role === "operator";
  }

  if (route === "iam" || route === "quota") {
    return role === "admin";
  }

  if (route === "gateway") {
    return role === "admin" || role === "developer";
  }

  if (route === "docs") {
    return role === "admin" || role === "user" || role === "developer";
  }

  return false;
}

export function primaryActionHint(role: RoleId, route: ConsoleRoute): string {
  if (canRunPrimaryAction(role, route)) {
    return "";
  }

  if (route === "overview") {
    return "处理运营事项需要管理员或运维人员权限。";
  }

  if (route === "iam") {
    return "用户与权限的写操作需要管理员权限。";
  }

  if (route === "gateway") {
    return "网关配置需要管理员或开发人员权限。";
  }

  if (route === "quota") {
    return "套餐与配额写操作需要管理员权限。";
  }

  if (route === "docs") {
    return "接入应用创建需要管理员、使用用户或开发人员权限。";
  }

  return "当前角色不能执行该操作。";
}
