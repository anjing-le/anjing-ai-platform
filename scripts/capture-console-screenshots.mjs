import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");
const distDir = join(repoRoot, "apps/console/dist");
const outputDir = join(repoRoot, "docs/assets/screenshots");
const tmpRoot = mkdtempSync(join(tmpdir(), "anjing-console-shot-"));
const skipBuild = process.argv.includes("--skip-build");

const screenshots = [
  { label: "Landing", route: "/", file: "landing.png" },
  { label: "Console home", route: "/#/console/home", file: "console-home.png" },
  { label: "Operations overview", route: "/#/console/overview", file: "operations-overview.png" },
  { label: "Access management", route: "/#/console/iam", file: "access-management.png" },
  { label: "Gateway and model", route: "/#/console/gateway", file: "gateway-model.png" },
  { label: "Billing and quota", route: "/#/console/quota", file: "billing-quota.png" },
  { label: "Help docs", route: "/#/console/docs", file: "help-docs.png" },
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

function executableExists(path) {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
}

function findInPath(candidates) {
  const pathDirs = (process.env.PATH || "").split(process.platform === "win32" ? ";" : ":");

  for (const dir of pathDirs) {
    for (const candidate of candidates) {
      const executable = join(dir, candidate);
      if (executableExists(executable)) {
        return executable;
      }
    }
  }

  return "";
}

function findChrome() {
  if (process.env.CHROME_BIN && executableExists(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN;
  }

  const platformPaths = {
    darwin: [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ],
    linux: [
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/microsoft-edge",
    ],
    win32: [
      join(process.env.PROGRAMFILES || "C:\\Program Files", "Google/Chrome/Application/chrome.exe"),
      join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Google/Chrome/Application/chrome.exe"),
      join(process.env.LOCALAPPDATA || "", "Google/Chrome/Application/chrome.exe"),
    ],
  };

  for (const candidate of platformPaths[process.platform] || []) {
    if (candidate && executableExists(candidate)) {
      return candidate;
    }
  }

  return findInPath([
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
    "microsoft-edge",
    "msedge",
    "chrome.exe",
  ]);
}

function getFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = net.createServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === "object" && address?.port) {
          resolvePort(address.port);
          return;
        }
        reject(new Error("Could not allocate a local port."));
      });
    });
  });
}

function wait(milliseconds) {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

async function waitForHealth(baseURL, server, output) {
  const deadline = Date.now() + 45_000;

  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`platform-all exited early.\n${output.join("")}`);
    }

    try {
      const response = await fetch(`${baseURL}/healthz`);
      if (response.ok) {
        return;
      }
    } catch {
      // The Go process may still be compiling or binding the port.
    }

    await wait(300);
  }

  throw new Error(`Timed out waiting for ${baseURL}/healthz.\n${output.join("")}`);
}

function startPlatform(port) {
  const output = [];
  const server = spawn("go", ["run", "./cmd/platform-all"], {
    cwd: repoRoot,
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      ANJING_ADDR: `127.0.0.1:${port}`,
      ANJING_AUTH_MODE: "permissive",
      ANJING_CONSOLE_DIST: distDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const collect = (chunk) => {
    output.push(chunk.toString());
    if (output.join("").length > 20_000) {
      output.splice(0, output.length - 10);
    }
  };

  server.stdout.on("data", collect);
  server.stderr.on("data", collect);

  return { output, server };
}

function stopPlatform(server) {
  if (server.exitCode !== null) {
    return;
  }

  try {
    if (process.platform !== "win32") {
      process.kill(-server.pid, "SIGTERM");
      return;
    }
  } catch {
    // Fall back to killing the direct child below.
  }

  server.kill("SIGTERM");
}

function captureWithChrome(chrome, baseURL, shot, index) {
  const output = join(outputDir, shot.file);
  const userDataDir = join(tmpRoot, `chrome-${index}`);
  const url = `${baseURL}${shot.route}`;
  const result = spawnSync(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${userDataDir}`,
    "--window-size=1440,1100",
    "--force-device-scale-factor=1",
    "--timeout=12000",
    "--virtual-time-budget=8000",
    `--screenshot=${output}`,
    url,
  ], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 30_000,
  });

  if (result.status !== 0) {
    throw new Error([
      `Chrome screenshot failed for ${shot.label} (${url}).`,
      result.stdout,
      result.stderr,
    ].filter(Boolean).join("\n"));
  }

  const size = existsSync(output) ? statSync(output).size : 0;
  if (size < 10_000) {
    throw new Error(`Screenshot ${basename(output)} looks too small (${size} bytes).`);
  }

  console.log(`captured ${shot.label}: ${output}`);
}

async function main() {
  const chrome = findChrome();
  if (!chrome) {
    throw new Error("Chrome, Chromium, or Edge was not found. Set CHROME_BIN to a headless-capable browser binary.");
  }

  if (!skipBuild) {
    run("pnpm", ["build:console"]);
  }

  if (!existsSync(join(distDir, "index.html"))) {
    throw new Error("apps/console/dist/index.html was not found. Run pnpm build:console first.");
  }

  mkdirSync(outputDir, { recursive: true });

  const port = await getFreePort();
  const baseURL = `http://127.0.0.1:${port}`;
  const { output, server } = startPlatform(port);

  try {
    await waitForHealth(baseURL, server, output);
    for (const [index, shot] of screenshots.entries()) {
      captureWithChrome(chrome, baseURL, shot, index);
    }
  } finally {
    stopPlatform(server);
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  rmSync(tmpRoot, { recursive: true, force: true });
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
