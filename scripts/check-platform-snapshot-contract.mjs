import { readFileSync } from "node:fs";

const goSource = readFileSync("internal/platform/store/store.go", "utf8");
const openapiSource = readFileSync("contracts/openapi/platform-api.yaml", "utf8");
const apiSource = readFileSync("apps/console/src/lib/api.ts", "utf8");

const goFields = parseGoSnapshotFields(goSource);
const openapiFields = parseOpenapiSnapshotFields(openapiSource);
const tsFields = parseTypeScriptSnapshotFields(apiSource);
const errors = [];

compare("OpenAPI PlatformSnapshot", openapiFields, "Go PlatformSnapshot", goFields);
compare("TypeScript PlatformSnapshot", tsFields, "Go PlatformSnapshot", goFields);

if (errors.length > 0) {
  console.error("PlatformSnapshot contract is out of sync:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("PlatformSnapshot contract matches Go, OpenAPI and console types.");

function parseGoSnapshotFields(source) {
  const match = source.match(/type PlatformSnapshot struct \{([\s\S]*?)\n\}/);
  if (!match) {
    throw new Error("PlatformSnapshot struct was not found in internal/platform/store/store.go");
  }

  return [...match[1].matchAll(/`json:"([^"]+)"`/g)]
    .map((item) => item[1])
    .filter((field) => field !== "-")
    .sort();
}

function parseOpenapiSnapshotFields(source) {
  const match = source.match(/    PlatformSnapshot:\n([\s\S]*?)\n    OpsTodo:/);
  if (!match) {
    throw new Error("PlatformSnapshot schema was not found in contracts/openapi/platform-api.yaml");
  }

  const requiredMatch = match[1].match(/      required:\n([\s\S]*?)\n      properties:/);
  if (!requiredMatch) {
    throw new Error("PlatformSnapshot schema is missing required fields.");
  }

  const required = [...requiredMatch[1].matchAll(/^        - ([A-Za-z0-9_]+)$/gm)]
    .map((item) => item[1])
    .sort();
  const properties = [...match[1].matchAll(/^        ([A-Za-z0-9_]+):$/gm)]
    .map((item) => item[1])
    .sort();

  compare("OpenAPI PlatformSnapshot properties", properties, "OpenAPI PlatformSnapshot required", required);
  return required;
}

function parseTypeScriptSnapshotFields(source) {
  const match = source.match(/export interface PlatformSnapshot \{([\s\S]*?)\n\}/);
  if (!match) {
    throw new Error("PlatformSnapshot interface was not found in apps/console/src/lib/api.ts");
  }

  return [...match[1].matchAll(/^  ([A-Za-z0-9_]+)\??:/gm)]
    .map((item) => item[1])
    .sort();
}

function compare(leftLabel, left, rightLabel, right) {
  const leftOnly = left.filter((field) => !right.includes(field));
  const rightOnly = right.filter((field) => !left.includes(field));

  for (const field of leftOnly) {
    errors.push(`${field} exists in ${leftLabel} but not in ${rightLabel}.`);
  }
  for (const field of rightOnly) {
    errors.push(`${field} exists in ${rightLabel} but not in ${leftLabel}.`);
  }
}
