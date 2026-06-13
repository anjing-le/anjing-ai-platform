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

const requiredSnippets = [
  "go build -o /out/migrate-db ./cmd/migrate-db",
  "go build -o /out/seed-db ./cmd/seed-db",
  "COPY --from=go-builder /out/migrate-db /app/migrate-db",
  "COPY --from=go-builder /out/seed-db /app/seed-db",
  "COPY infra/postgres/migrations /app/infra/postgres/migrations",
  "COPY infra/postgres/seeds /app/infra/postgres/seeds",
  "ENV ANJING_MIGRATIONS_DIR=/app/infra/postgres/migrations",
  "ENV ANJING_SEEDS_DIR=/app/infra/postgres/seeds",
];

const missingSnippets = requiredSnippets.filter((snippet) => !source.includes(snippet));
if (missingSnippets.length) {
  console.error("Dockerfile is missing required database runtime wiring.");
  for (const snippet of missingSnippets) {
    console.error(`- ${snippet}`);
  }
  process.exit(1);
}

console.log("Dockerfile local COPY sources exist.");
