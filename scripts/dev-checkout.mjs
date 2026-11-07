import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appOrigin = "http://127.0.0.1:3103";
const simulationOrigin = "http://127.0.0.1:3913";
const children = new Set();
let stopping = false;

function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;
    if (process.platform === "win32") {
      // These PIDs belong to this launch; include Next/Postman worker processes.
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore", windowsHide: true,
      });
    } else {
      try { process.kill(-child.pid, "SIGTERM"); } catch { /* Already stopped. */ }
    }
  }
  process.exitCode = code;
}

function launch(command, args, env) {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: "inherit",
    windowsHide: true,
    detached: process.platform !== "win32",
  });
  children.add(child);
  child.once("error", (error) => {
    console.error(`Checkout preview could not start ${command}: ${error.message}`);
    stop(1);
  });
  child.once("exit", (code, signal) => {
    children.delete(child);
    if (stopping) return;
    console.error(`Checkout preview child stopped (${command}, ${signal || code}).`);
    stop(code || 1);
  });
  return child;
}

async function requireAvailablePort(port) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", () => reject(new Error(
      `Port ${port} is already in use. Stop that server before starting dev:checkout.`,
    )));
    server.listen(port, "127.0.0.1", () => server.close(resolve));
  });
}

async function waitForSimulation() {
  const deadline = Date.now() + 60_000;
  while (!stopping && Date.now() < deadline) {
    try {
      const response = await fetch(`${simulationOrigin}/api/health`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) return;
    } catch { /* Wait for this launch's dependency process to become ready. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!stopping) throw new Error("The checkout dependency simulation did not become ready within 60 seconds.");
}

for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => stop(0));
process.once("exit", () => stop(process.exitCode || 0));

async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error("dev:checkout is a local mock preview and cannot run in production.");
  await Promise.all([requireAvailablePort(3103), requireAvailablePort(3913)]);
  if (stopping) return;
  console.log("Starting local checkout preview with explicit simulated dependencies.");
  launch("postman", [
    "simulation", "run", "postman/simulations/checkout.sim.yaml",
    "--port", "3913", "--no-history", "--output", "ndjson",
  ]);
  await waitForSimulation();
  if (stopping) return;
  launch(process.execPath, [
    "node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3103",
  ], {
    NODE_ENV: "development",
    NEXUS_TEST_DIST_DIR: ".next-checkout-run",
    NEXT_PUBLIC_API_URL: simulationOrigin,
    API_PROXY_TARGET: simulationOrigin,
    NEXT_PUBLIC_AUTH_STUB: "false",
    NEXT_PUBLIC_PRODUCT_DETAIL_MOCK: "false",
    NEXT_PUBLIC_CART_MOCK: "false",
    NEXT_PUBLIC_KEYCLOAK_URL: `${simulationOrigin}/keycloak`,
    NEXT_PUBLIC_KEYCLOAK_REALM: "nexus",
    NEXT_PUBLIC_KEYCLOAK_CLIENT_ID: "nexus-web",
  });
  console.log(`Open ${appOrigin}/checkout. Press Ctrl+C to stop this preview and its dependencies.`);
}

main().catch((error) => {
  console.error(error.message);
  stop(1);
});
