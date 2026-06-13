import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const errors = [];
const commandDirs = readdirSync("cmd", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join("cmd", entry.name, "main.go"));

for (const file of commandDirs) {
  const source = readFileSync(file, "utf8");
  if (source.includes("panic(")) {
    errors.push(`${file} must use structured logging instead of panic.`);
  }

  if (
    !file.includes("migrate-db") &&
    !file.includes("seed-db") &&
    !source.includes("service.ListenWithLogger(")
  ) {
    errors.push(`${file} must start HTTP services with service.ListenWithLogger.`);
  }
}

if (errors.length > 0) {
  console.error("Command runtime wiring check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Command runtime wiring uses structured logging.");
