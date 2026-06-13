import { readFileSync } from "node:fs";

const source = readFileSync("contracts/openapi/platform-api.yaml", "utf8");
const lines = source.split("\n");
const operations = [];
let currentPath = "";

for (let index = 0; index < lines.length; index += 1) {
  const pathMatch = lines[index].match(/^  (\/(?:api\/[^:]+|healthz)):/);
  if (pathMatch) {
    currentPath = pathMatch[1];
    continue;
  }

  const methodMatch = lines[index].match(/^    (get|post|put|patch|delete|options):$/);
  if (methodMatch && currentPath) {
    const operation = {
      method: methodMatch[1].toUpperCase(),
      path: currentPath,
      line: index + 1,
      block: [],
    };

    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (/^  \S/.test(lines[cursor]) || /^    (get|post|put|patch|delete|options):$/.test(lines[cursor])) {
        break;
      }
      operation.block.push(lines[cursor]);
    }

    operations.push(operation);
  }
}

const errors = [];
const operationIds = new Map();

for (const operation of operations) {
  const text = operation.block.join("\n");
  const label = `${operation.method} ${operation.path}`;
  const operationId = matchValue(text, /^      operationId: (.+)$/m);

  if (!operationId) {
    errors.push(`${label} is missing operationId.`);
  } else if (operationIds.has(operationId)) {
    errors.push(`${label} duplicates operationId '${operationId}' from ${operationIds.get(operationId)}.`);
  } else {
    operationIds.set(operationId, label);
  }

  if (!matchValue(text, /^      summary: (.+)$/m)) {
    errors.push(`${label} is missing summary.`);
  }

  if (!/^      responses:$/m.test(text)) {
    errors.push(`${label} is missing responses.`);
  }

  const isBusinessAPI = operation.path.startsWith("/api/") && !operation.path.endsWith("/healthz");
  if (!isBusinessAPI) {
    continue;
  }

  if (!/^      x-anjing-roles: \[[^\]]+\]$/m.test(text)) {
    errors.push(`${label} is missing x-anjing-roles.`);
  }

  if (!/^        "401":$/m.test(text)) {
    errors.push(`${label} is missing 401 response.`);
  }

  if (!/^        "403":$/m.test(text)) {
    errors.push(`${label} is missing 403 response.`);
  }

  if (operation.method === "POST" && !/^      requestBody:$/m.test(text)) {
    errors.push(`${label} is missing requestBody.`);
  }
}

if (errors.length > 0) {
  console.error("OpenAPI operation metadata check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("OpenAPI operation metadata is complete.");

function matchValue(text, pattern) {
  return text.match(pattern)?.[1]?.trim() ?? "";
}
