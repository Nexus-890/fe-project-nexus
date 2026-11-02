import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(root, "tsconfig.json");
const originalConfig = readFileSync(configPath, "utf8");
const command = (args) =>
  spawnSync(process.execPath, args, { cwd: root, stdio: "inherit" });
const prepared = command(["scripts/auth-smoke.mjs", "prepare"]);
if (prepared.status !== 0) process.exitCode = prepared.status ?? 1;
else {
  const child = spawn(
    process.execPath,
    ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)],
    { cwd: root, stdio: "inherit" },
  );
  let finished = false;
  const cleanup = () => {
    if (finished) return;
    finished = true;
    command(["scripts/auth-smoke.mjs", "cleanup"]);
    writeFileSync(configPath, originalConfig);
  };
  child.on("error", (error) => {
    console.error(error);
    cleanup();
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    cleanup();
    process.exitCode = code ?? 1;
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => child.kill(signal));
}
