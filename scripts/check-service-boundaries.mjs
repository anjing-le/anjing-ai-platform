import { readFileSync } from "node:fs";

const consoleSource = readFileSync("apps/console/src/data/console.ts", "utf8");
const openapiSource = readFileSync("contracts/openapi/platform-api.yaml", "utf8");

function parseConsoleBoundaries(source) {
  const mapMatch = source.match(/export const consoleServiceMap = \[([\s\S]*?)\];/);
  if (!mapMatch) {
    throw new Error("consoleServiceMap was not found in apps/console/src/data/console.ts");
  }

  return [...mapMatch[1].matchAll(/\{\s*entry:\s*"([^"]+)",\s*owner:\s*"([^"]+)",\s*scope:\s*"[^"]+",\s*apis:\s*\[([^\]]*)\],\s*\}/g)]
    .map((match) => ({
      label: match[1],
      owner: match[2],
      apis: [...match[3].matchAll(/"([^"]+)"/g)].map((api) => api[1]),
    }));
}

function parseOpenapiBoundaries(source) {
  const blockMatch = source.match(/x-anjing-service-boundaries:\n([\s\S]*?)\npaths:/);
  if (!blockMatch) {
    throw new Error("x-anjing-service-boundaries was not found in contracts/openapi/platform-api.yaml");
  }

  const boundaries = [];
  let current;
  let inApiGroups = false;

  for (const line of blockMatch[1].split("\n")) {
    const itemMatch = line.match(/^  - consoleEntry: (.+)$/);
    if (itemMatch) {
      if (current) {
        boundaries.push(current);
      }
      current = { consoleEntry: itemMatch[1], label: "", owner: "", apis: [] };
      inApiGroups = false;
      continue;
    }

    if (!current) {
      continue;
    }

    const labelMatch = line.match(/^    label: (.+)$/);
    if (labelMatch) {
      current.label = labelMatch[1];
      inApiGroups = false;
      continue;
    }

    const ownerMatch = line.match(/^    owner: (.+)$/);
    if (ownerMatch) {
      current.owner = ownerMatch[1];
      inApiGroups = false;
      continue;
    }

    if (line.match(/^    apiGroups:$/)) {
      inApiGroups = true;
      continue;
    }

    const apiMatch = line.match(/^      - (.+)$/);
    if (inApiGroups && apiMatch) {
      current.apis.push(apiMatch[1]);
    }
  }

  if (current) {
    boundaries.push(current);
  }

  return boundaries;
}

function parseOpenapiPaths(source) {
  return new Set(
    [...source.matchAll(/^  (\/(?:api\/[^:]+|healthz)):/gm)]
      .map((match) => match[1]),
  );
}

function normalize(boundaries) {
  return boundaries
    .map((item) => ({
      label: item.label,
      owner: item.owner,
      apis: [...item.apis].sort(),
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "zh-Hans-CN"));
}

const consoleBoundaries = normalize(parseConsoleBoundaries(consoleSource));
const openapiBoundaries = normalize(parseOpenapiBoundaries(openapiSource));
const openapiPaths = parseOpenapiPaths(openapiSource);
const consoleJson = JSON.stringify(consoleBoundaries, null, 2);
const openapiJson = JSON.stringify(openapiBoundaries, null, 2);

if (consoleJson !== openapiJson) {
  console.error("Service boundary metadata is out of sync.");
  console.error("\nConsole boundaries:");
  console.error(consoleJson);
  console.error("\nOpenAPI boundaries:");
  console.error(openapiJson);
  process.exit(1);
}

const virtualApiGroups = new Set(["/", "/api/*"]);
const missingApiGroups = openapiBoundaries.flatMap((boundary) =>
  boundary.apis
    .filter((api) => !virtualApiGroups.has(api) && !openapiPaths.has(api))
    .map((api) => `${boundary.label} (${boundary.owner}) -> ${api}`),
);

if (missingApiGroups.length) {
  console.error("Service boundary API groups are missing from OpenAPI paths.");
  for (const api of missingApiGroups) {
    console.error(`- ${api}`);
  }
  process.exit(1);
}

console.log("Service boundary metadata matches console and OpenAPI paths.");
