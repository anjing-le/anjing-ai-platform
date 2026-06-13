import { spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";

const port = await freePort();
const baseURL = `http://127.0.0.1:${port}`;
const output = [];
const databaseURL = process.env.ANJING_SMOKE_DATABASE_URL ?? "";

const server = spawn("go", ["run", "./cmd/platform-all"], {
  env: {
    ...process.env,
    ANJING_ADDR: `127.0.0.1:${port}`,
    ANJING_DATABASE_URL: databaseURL,
  },
  detached: true,
  stdio: ["ignore", "pipe", "pipe"],
});

server.stdout.on("data", (chunk) => output.push(chunk.toString()));
server.stderr.on("data", (chunk) => output.push(chunk.toString()));

try {
  await waitForJSON(`${baseURL}/healthz`, (payload) => payload.success === true && payload.data?.status === "ok");
  const snapshot = await waitForJSON(
    `${baseURL}/api/ops/platform-snapshot`,
    (payload) => payload.success === true && Array.isArray(payload.data?.dashboard?.metrics),
  );
  if (databaseURL !== "") {
    assertSeededSnapshot(snapshot);
  }
  console.log(`Platform API smoke check passed on ${baseURL}${databaseURL === "" ? "" : " with PostgreSQL"}.`);
} catch (error) {
  console.error("Platform API smoke check failed:");
  console.error(error.message);
  console.error(output.join("").trim());
  process.exitCode = 1;
} finally {
  await stop(server);
}

function assertSeededSnapshot(payload) {
  const data = payload.data ?? {};
  if (!data.users?.some((user) => user.id === "usr_admin")) {
    throw new Error("PostgreSQL smoke expected seeded admin user usr_admin.");
  }
  if (!data.applications?.some((application) => application.id === "app_customer")) {
    throw new Error("PostgreSQL smoke expected seeded application app_customer.");
  }
}

async function freePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = address.port;
  server.close();
  await once(server, "close");
  return port;
}

async function waitForJSON(url, predicate) {
  const deadline = Date.now() + 20_000;
  let lastError = new Error(`timed out waiting for ${url}`);

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      const payload = await response.json();
      if (response.ok && predicate(payload)) {
        return payload;
      }
      lastError = new Error(`${url} returned unexpected payload: ${JSON.stringify(payload)}`);
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }

  throw lastError;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  killProcessGroup(child, "SIGTERM");
  const timeout = setTimeout(() => {
    killProcessGroup(child, "SIGKILL");
  }, 2_000);
  try {
    await once(child, "exit");
  } finally {
    clearTimeout(timeout);
  }
}

function killProcessGroup(child, signal) {
  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}
