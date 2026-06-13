import { spawnSync } from "node:child_process";

const databaseURL = "postgres://anjing:anjing@localhost:54329/anjing_ai_platform?sslmode=disable";

const dockerInfo = spawnSync("docker", ["info"], { stdio: "ignore" });
if (dockerInfo.status !== 0) {
  console.error("PostgreSQL smoke requires a running Docker daemon.");
  console.error("Start Docker or Orbstack, then run pnpm smoke:api:db again.");
  process.exit(1);
}

run("pnpm", ["db:prepare"]);
run("node", ["scripts/smoke-platform-api.mjs"], {
  ANJING_SMOKE_DATABASE_URL: databaseURL,
});

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    env: {
      ...process.env,
      ...env,
    },
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
