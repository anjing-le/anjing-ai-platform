import { readFileSync } from "node:fs";

const consoleApiSource = readFileSync("apps/console/src/lib/api.ts", "utf8");
const openapiSource = readFileSync("contracts/openapi/platform-api.yaml", "utf8");

const consolePaths = new Set(
  [...consoleApiSource.matchAll(/["'](\/api\/[^"']+)["']/g)]
    .map((match) => match[1])
    .filter((path) => !path.includes("*")),
);

const openapiPaths = new Set(
  [...openapiSource.matchAll(/^  (\/api\/[^:]+):/gm)]
    .map((match) => match[1]),
);

const missingFromOpenapi = [...consolePaths]
  .filter((path) => !openapiPaths.has(path))
  .sort();

if (missingFromOpenapi.length > 0) {
  console.error("Console API client paths are missing from OpenAPI:");
  for (const path of missingFromOpenapi) {
    console.error(`- ${path}`);
  }
  process.exit(1);
}

console.log("Console API client paths are covered by OpenAPI.");
