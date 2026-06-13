import { readFileSync } from "node:fs";

const rootPackage = JSON.parse(readFileSync("package.json", "utf8"));
const scripts = rootPackage.scripts ?? {};
const errors = [];

expectScript("db:prepare", ["pnpm db:up", "pnpm db:migrate", "pnpm db:seed"]);
expectScript("dev:api", ["go run ./cmd/platform-all"]);
expectScript("dev:api:db", [
  "ANJING_DATABASE_URL",
  "postgres://anjing:anjing@localhost:54329/anjing_ai_platform?sslmode=disable",
  "go run ./cmd/platform-all",
]);
expectScript("smoke:api:db", [
  "node scripts/smoke-postgres-api.mjs",
]);

if (!scripts.verify?.includes("pnpm verify:local-dev")) {
  errors.push("package.json verify must include pnpm verify:local-dev.");
}

const viteConfig = readFileSync("apps/console/vite.config.ts", "utf8");
if (!viteConfig.includes('target: "http://localhost:18080"')) {
  errors.push("apps/console/vite.config.ts must proxy /api to http://localhost:18080.");
}

const apiClient = readFileSync("apps/console/src/lib/api.ts", "utf8");
if (!apiClient.includes("VITE_API_BASE_URL")) {
  errors.push("apps/console/src/lib/api.ts must support VITE_API_BASE_URL.");
}

const consoleEnvExample = readFileSync("apps/console/.env.example", "utf8");
if (!consoleEnvExample.includes("VITE_API_BASE_URL=")) {
  errors.push("apps/console/.env.example must document VITE_API_BASE_URL.");
}

if (errors.length > 0) {
  console.error("Local development script check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Local development scripts are wired correctly.");

function expectScript(name, requiredParts) {
  const script = scripts[name];
  if (!script) {
    errors.push(`package.json script '${name}' is missing.`);
    return;
  }

  for (const part of requiredParts) {
    if (!script.includes(part)) {
      errors.push(`package.json script '${name}' must include '${part}'.`);
    }
  }
}
