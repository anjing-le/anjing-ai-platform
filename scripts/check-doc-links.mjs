import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, normalize } from "node:path";

const docRoots = ["README.md", "docs"];
const repoPathPrefixes = [
  "apps/",
  "cmd/",
  "contracts/",
  "docs/",
  "frontend/",
  "infra/",
  "internal/",
  "scripts/",
];
const repoFiles = new Set(["Dockerfile", "go.mod", "go.sum", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"]);

function collectMarkdownFiles(path) {
  if (!existsSync(path)) {
    return [];
  }

  const stat = statSync(path);
  if (stat.isFile()) {
    return path.endsWith(".md") ? [path] : [];
  }

  return readdirSync(path)
    .flatMap((entry) => collectMarkdownFiles(join(path, entry)));
}

function isLocalRepoPath(value) {
  if (repoFiles.has(value)) {
    return true;
  }

  return repoPathPrefixes.some((prefix) => value.startsWith(prefix));
}

function normalizeReference(value) {
  return value
    .replace(/^<|>$/g, "")
    .replace(/:\d+$/, "")
    .replace(/^\.\/+/, "");
}

function collectReferences(file, source) {
  const references = [];

  for (const match of source.matchAll(/`([^`\n]+)`/g)) {
    references.push({ file, value: match[1] });
  }

  for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    references.push({ file, value: match[1] });
  }

  return references;
}

const markdownFiles = docRoots.flatMap(collectMarkdownFiles);
const missing = [];

for (const file of markdownFiles) {
  const source = readFileSync(file, "utf8");

  for (const reference of collectReferences(file, source)) {
    const path = normalizeReference(reference.value);
    if (!isLocalRepoPath(path)) {
      continue;
    }

    const safePath = normalize(path);
    if (safePath.startsWith("..") || !existsSync(safePath)) {
      missing.push(`${reference.file}: ${reference.value}`);
    }
  }
}

if (missing.length) {
  console.error("Documentation references missing local paths.");
  for (const item of missing) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log("Documentation local path references exist.");
