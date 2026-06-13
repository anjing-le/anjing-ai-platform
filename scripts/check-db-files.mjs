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
checkRepositoryTables(migrations);
checkControlUserSideEffects();
checkControlApplicationSideEffects();
checkGatewaySideEffects();
checkBillingSideEffects();
checkOpsSideEffects();
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
  const createdTables = collectCreatedTables(migrationFiles);

  for (const file of seedFiles) {
    for (const match of file.content.matchAll(/INSERT INTO ([a-z_][a-z0-9_]*)/gi)) {
      const table = match[1].toLowerCase();
      if (!createdTables.has(table)) {
        errors.push(`${file.name} inserts into '${table}', but no migration creates that table.`);
      }
    }
  }
}

function checkRepositoryTables(migrationFiles) {
  const createdTables = collectCreatedTables(migrationFiles);
  const repositoryFiles = [
    "internal/control/repository.go",
    "internal/gateway/repository.go",
    "internal/billing/repository.go",
    "internal/ops/repository.go",
  ];

  for (const filePath of repositoryFiles) {
    const source = readFileSync(filePath, "utf8");
    for (const table of collectSQLTables(goSQLBlocks(source).join("\n"))) {
      if (!createdTables.has(table)) {
        errors.push(`${filePath} references table '${table}', but no migration creates that table.`);
      }
    }
  }
}

function goSQLBlocks(source) {
  return [...source.matchAll(/`([\s\S]*?)`/g)]
    .map((match) => match[1])
    .filter((block) => /\b(select|insert|update|delete)\b/i.test(block));
}

function collectCreatedTables(migrationFiles) {
  const createdTables = new Set();
  for (const file of migrationFiles) {
    for (const match of file.content.matchAll(/CREATE TABLE IF NOT EXISTS ([a-z_][a-z0-9_]*)/gi)) {
      createdTables.add(match[1].toLowerCase());
    }
  }
  return createdTables;
}

function collectSQLTables(source) {
  const tables = new Set();
  const patterns = [
    /\bfrom\s+([a-z_][a-z0-9_]*)/gi,
    /\binsert\s+into\s+([a-z_][a-z0-9_]*)/gi,
    /\bupdate\s+([a-z_][a-z0-9_]*)/gi,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      tables.add(match[1].toLowerCase());
    }
  }

  return tables;
}

function checkControlUserSideEffects() {
  const source = readFileSync("internal/control/repository.go", "utf8");
  const createUser = functionBody(source, "func (repo PostgresUserRepository) CreateUser");
  const activateUser = functionBody(source, "func (repo PostgresUserRepository) ActivateUser");

  for (const [label, body] of [
    ["PostgresUserRepository.CreateUser", createUser],
    ["PostgresUserRepository.ActivateUser", activateUser],
  ]) {
    if (!body.includes("ops_todos")) {
      errors.push(`${label} must keep user onboarding todos in sync.`);
    }
    if (!body.includes("audit_events")) {
      errors.push(`${label} must write audit events.`);
    }
  }
}

function checkControlApplicationSideEffects() {
  const source = readFileSync("internal/control/repository.go", "utf8");
  const createApplication = functionBody(source, "func (repo PostgresApplicationRepository) CreateApplication");
  const activateApplication = functionBody(source, "func (repo PostgresApplicationRepository) ActivateApplication");
  const rotateApplicationKey = functionBody(source, "func (repo PostgresApplicationRepository) RotateApplicationKey");

  for (const [label, body] of [
    ["PostgresApplicationRepository.CreateApplication", createApplication],
    ["PostgresApplicationRepository.ActivateApplication", activateApplication],
  ]) {
    if (!body.includes("ops_todos")) {
      errors.push(`${label} must keep application onboarding todos in sync.`);
    }
    if (!body.includes("audit_events")) {
      errors.push(`${label} must write audit events.`);
    }
  }

  if (!activateApplication.includes("request_logs")) {
    errors.push("PostgresApplicationRepository.ActivateApplication must write a first request log.");
  }
  if (!rotateApplicationKey.includes("audit_events")) {
    errors.push("PostgresApplicationRepository.RotateApplicationKey must write an audit event.");
  }
}

function checkGatewaySideEffects() {
  const source = readFileSync("internal/gateway/repository.go", "utf8");
  const checks = [
    ["PostgresRouteRepository.CreateRoute", "func (repo PostgresRouteRepository) CreateRoute", ["request_logs", "audit_events"]],
    ["PostgresRouteRepository.PublishRoute", "func (repo PostgresRouteRepository) PublishRoute", ["request_logs", "audit_events"]],
    ["PostgresModelRouteRepository.CreateModelRoute", "func (repo PostgresModelRouteRepository) CreateModelRoute", ["audit_events"]],
    ["PostgresModelRouteRepository.PublishModelRoute", "func (repo PostgresModelRouteRepository) PublishModelRoute", ["request_logs", "audit_events"]],
    ["PostgresSkillRepository.CreateSkillBinding", "func (repo PostgresSkillRepository) CreateSkillBinding", ["audit_events"]],
    ["PostgresSkillRepository.PublishSkillBinding", "func (repo PostgresSkillRepository) PublishSkillBinding", ["request_logs", "audit_events"]],
  ];

  for (const [label, signature, requiredSignals] of checks) {
    const body = functionBody(source, signature);
    for (const signal of requiredSignals) {
      if (!body.includes(signal)) {
        errors.push(`${label} must write ${signal}.`);
      }
    }
  }
}

function checkBillingSideEffects() {
  const source = readFileSync("internal/billing/repository.go", "utf8");
  const createPlan = functionBody(source, "func (repo PostgresPlanRepository) CreatePlan");
  const activatePlan = functionBody(source, "func (repo PostgresPlanRepository) ActivatePlan");
  const resolveBudgetAlert = functionBody(source, "func (repo PostgresBudgetAlertRepository) ResolveBudgetAlert");

  for (const [label, body] of [
    ["PostgresPlanRepository.CreatePlan", createPlan],
    ["PostgresPlanRepository.ActivatePlan", activatePlan],
    ["PostgresBudgetAlertRepository.ResolveBudgetAlert", resolveBudgetAlert],
  ]) {
    if (!body.includes("audit_events")) {
      errors.push(`${label} must write audit events.`);
    }
  }

  if (!createPlan.includes("budget_alerts")) {
    errors.push("PostgresPlanRepository.CreatePlan must create a budget alert.");
  }
}

function checkOpsSideEffects() {
  const source = readFileSync("internal/ops/repository.go", "utf8");
  const resolveTodo = functionBody(source, "func (repo PostgresTodoRepository) ResolveTodo");
  if (!resolveTodo.includes("audit_events")) {
    errors.push("PostgresTodoRepository.ResolveTodo must write an audit event.");
  }
}

function functionBody(source, signature) {
  const start = source.indexOf(signature);
  if (start === -1) {
    return "";
  }

  const braceStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
    }
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(braceStart, index + 1);
      }
    }
  }

  return "";
}

function checkMigrationDirConfig() {
  const configSource = readFileSync("internal/platform/config/config.go", "utf8");
  if (!configSource.includes('"infra/postgres/migrations"')) {
    errors.push("internal/platform/config/config.go must default ANJING_MIGRATIONS_DIR to infra/postgres/migrations.");
  }
  if (!configSource.includes('"infra/postgres/seeds"')) {
    errors.push("internal/platform/config/config.go must default ANJING_SEEDS_DIR to infra/postgres/seeds.");
  }

  const composeSource = readFileSync("infra/local/docker-compose.image.yml", "utf8");
  if (!composeSource.includes("ANJING_MIGRATIONS_DIR: /app/infra/postgres/migrations")) {
    errors.push("infra/local/docker-compose.image.yml must mount /app/infra/postgres/migrations for migrate command.");
  }
  if (!composeSource.includes("ANJING_SEEDS_DIR: /app/infra/postgres/seeds")) {
    errors.push("infra/local/docker-compose.image.yml must mount /app/infra/postgres/seeds for seed command.");
  }
  if (!composeSource.includes('command: ["/app/seed-db"]')) {
    errors.push("infra/local/docker-compose.image.yml must run /app/seed-db before platform starts.");
  }

  const packageSource = readFileSync("package.json", "utf8");
  if (!packageSource.includes("go run ./cmd/seed-db")) {
    errors.push("package.json db:seed must run ./cmd/seed-db.");
  }
}
