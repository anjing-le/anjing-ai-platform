import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const migrationsDir = "infra/postgres/migrations";
const seedsDir = "infra/postgres/seeds";
const errors = [];

const migrations = sqlFiles(migrationsDir);
const seeds = sqlFiles(seedsDir);

checkSequence("migration", migrations);
checkSequence("seed", seeds);
checkSeedTables(migrations, seeds);
checkMigrationDirConfig();

if (errors.length > 0) {
  console.error("Database file check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Database migration and seed files are consistent.");

function sqlFiles(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({
      name,
      path: join(dir, name),
      content: readFileSync(join(dir, name), "utf8"),
    }));
}

function checkSequence(label, files) {
  files.forEach((file, index) => {
    const expected = String(index + 1).padStart(3, "0");
    const match = file.name.match(/^(\d{3})_[a-z0-9_]+\.sql$/);
    if (!match) {
      errors.push(`${label} file '${file.name}' must match NNN_snake_case.sql.`);
      return;
    }
    if (match[1] !== expected) {
      errors.push(`${label} file '${file.name}' should use sequence ${expected}.`);
    }
  });
}

function checkSeedTables(migrationFiles, seedFiles) {
  const createdTables = new Set();
  for (const file of migrationFiles) {
    for (const match of file.content.matchAll(/CREATE TABLE IF NOT EXISTS ([a-z_][a-z0-9_]*)/gi)) {
      createdTables.add(match[1].toLowerCase());
    }
  }

  for (const file of seedFiles) {
    for (const match of file.content.matchAll(/INSERT INTO ([a-z_][a-z0-9_]*)/gi)) {
      const table = match[1].toLowerCase();
      if (!createdTables.has(table)) {
        errors.push(`${file.name} inserts into '${table}', but no migration creates that table.`);
      }
    }
  }
}

function checkMigrationDirConfig() {
  const configSource = readFileSync("internal/platform/config/config.go", "utf8");
  if (!configSource.includes('"infra/postgres/migrations"')) {
    errors.push("internal/platform/config/config.go must default ANJING_MIGRATIONS_DIR to infra/postgres/migrations.");
  }

  const composeSource = readFileSync("infra/local/docker-compose.image.yml", "utf8");
  if (!composeSource.includes("ANJING_MIGRATIONS_DIR: /app/infra/postgres/migrations")) {
    errors.push("infra/local/docker-compose.image.yml must mount /app/infra/postgres/migrations for migrate command.");
  }

  const packageSource = readFileSync("package.json", "utf8");
  if (!packageSource.includes("infra/postgres/seeds/*.sql")) {
    errors.push("package.json db:seed must execute infra/postgres/seeds/*.sql.");
  }
}
