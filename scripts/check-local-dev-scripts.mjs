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

if (!scripts.verify?.includes("pnpm verify:local-dev")) {
  errors.push("package.json verify must include pnpm verify:local-dev.");
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
