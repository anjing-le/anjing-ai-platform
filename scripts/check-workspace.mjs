import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const errors = [];

function fail(message) {
  errors.push(message);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function resolveWorkspacePattern(pattern) {
  if (!pattern.endsWith("/*")) {
    return existsSync(join(pattern, "package.json")) ? [pattern] : [];
  }

  const base = pattern.slice(0, -2);
  if (!existsSync(base)) {
    return [];
  }

  return readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(base, entry.name))
    .filter((dir) => existsSync(join(dir, "package.json")));
}

const rootPackage = readJson("package.json");
if (rootPackage.private !== true) {
  fail("Root package.json must stay private for pnpm workspace safety.");
}

if (!rootPackage.packageManager?.startsWith("pnpm@")) {
  fail("Root package.json packageManager must use pnpm@.");
}

const workspaceYaml = readFileSync("pnpm-workspace.yaml", "utf8");
const workspacePatterns = [
  ...workspaceYaml.matchAll(/^\s*-\s+["']?([^"'\n]+)["']?\s*$/gm),
].map((match) => match[1]);

if (!workspacePatterns.includes("apps/*")) {
  fail("pnpm-workspace.yaml must include apps/*.");
}

for (const pattern of workspacePatterns) {
  const matches = resolveWorkspacePattern(pattern);
  if (matches.length === 0) {
    fail(`Workspace pattern '${pattern}' does not match any package.json.`);
  }
}

const consolePackagePath = "apps/console/package.json";
if (!existsSync(consolePackagePath)) {
  fail(`${consolePackagePath} is missing.`);
} else {
  const consolePackage = readJson(consolePackagePath);
  if (consolePackage.name !== "@anjing-ai-platform/console") {
    fail(`${consolePackagePath} name must be @anjing-ai-platform/console.`);
  }

  if (consolePackage.private !== true) {
    fail(`${consolePackagePath} must stay private.`);
  }
}

for (const scriptName of ["dev:console", "build:console", "preview:console"]) {
  const script = rootPackage.scripts?.[scriptName] ?? "";
  if (!script.includes("--filter @anjing-ai-platform/console")) {
    fail(`package.json script '${scriptName}' must target @anjing-ai-platform/console.`);
  }
}

if (errors.length > 0) {
  console.error("Workspace configuration check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Workspace package configuration is valid.");
