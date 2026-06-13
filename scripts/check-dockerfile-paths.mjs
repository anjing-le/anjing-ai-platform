import { existsSync, readFileSync } from "node:fs";
import { normalize } from "node:path";

const dockerfile = "Dockerfile";
const source = readFileSync(dockerfile, "utf8");
const missing = [];

for (const line of source.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("COPY ")) {
    continue;
  }

  const parts = trimmed.split(/\s+/);
  if (parts.some((part) => part.startsWith("--from="))) {
    continue;
  }

  const sources = parts.slice(1, -1);
  for (const sourcePath of sources) {
    if (sourcePath.startsWith("--")) {
      continue;
    }

    const normalized = normalize(sourcePath);
    if (normalized.startsWith("..") || !existsSync(normalized)) {
      missing.push(`${dockerfile}: ${sourcePath}`);
    }
  }
}

if (missing.length) {
  console.error("Dockerfile references missing local COPY sources.");
  for (const item of missing) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log("Dockerfile local COPY sources exist.");
