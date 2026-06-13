import { readFileSync } from "node:fs";

const consoleSource = readFileSync("apps/console/src/data/console.ts", "utf8");
const storeSource = readFileSync("internal/platform/store/store.go", "utf8");
const sqlSource = readFileSync("infra/postgres/seeds/006_demo_role_policies.sql", "utf8");

const roleNames = {
  admin: "Administrator",
  user: "User",
  developer: "Developer",
  operator: "Operator",
};

const expected = expectedVisibleEntries(consoleSource);
const memoryPolicies = parseMemoryPolicies(storeSource);
const sqlPolicies = parseSQLPolicies(sqlSource);
const errors = [];

for (const [roleId, roleName] of Object.entries(roleNames)) {
  const expectedVisible = expected[roleId];
  const memoryVisible = memoryPolicies[roleName];
  const sqlVisible = sqlPolicies[roleName];

  if (!memoryVisible) {
    errors.push(`Memory seed is missing role policy ${roleName}.`);
  } else if (memoryVisible !== expectedVisible) {
    errors.push(`Memory seed ${roleName} visible_entries=${memoryVisible}, expected ${expectedVisible}.`);
  }

  if (!sqlVisible) {
    errors.push(`SQL seed is missing role policy ${roleName}.`);
  } else if (sqlVisible !== expectedVisible) {
    errors.push(`SQL seed ${roleName} visible_entries=${sqlVisible}, expected ${expectedVisible}.`);
  }
}

if (errors.length > 0) {
  console.error("Role policy seed visibility is out of sync with console navigation:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Role policy seeds match console navigation visibility.");

function expectedVisibleEntries(source) {
  const navMatch = source.match(/export const navItems: NavItem\[] = \[([\s\S]*?)\];/);
  if (!navMatch) {
    throw new Error("navItems was not found in apps/console/src/data/console.ts");
  }

  const visibleByRole = new Map(Object.keys(roleNames).map((role) => [role, []]));
  for (const match of navMatch[1].matchAll(/\{\s*id:\s*"([^"]+)",[\s\S]*?roles:\s*\[([^\]]*)\],[\s\S]*?\}/g)) {
    const route = match[1];
    if (route === "home") {
      continue;
    }

    const roles = [...match[2].matchAll(/"([^"]+)"/g)].map((role) => role[1]);
    for (const role of roles) {
      visibleByRole.get(role)?.push(route);
    }
  }

  return Object.fromEntries(
    [...visibleByRole.entries()].map(([role, routes]) => [
      role,
      role === "admin" ? "all" : routes.join(","),
    ]),
  );
}

function parseMemoryPolicies(source) {
  const policies = {};
  for (const match of source.matchAll(/\{ID:\s*"role_[^"]+",\s*Name:\s*"([^"]+)",\s*VisibleEntries:\s*"([^"]+)"/g)) {
    policies[match[1]] = match[2];
  }
  return policies;
}

function parseSQLPolicies(source) {
  const policies = {};
  for (const match of source.matchAll(/\('role_[^']+',\s*'([^']+)',\s*'([^']+)'/g)) {
    policies[match[1]] = match[2];
  }
  return policies;
}
