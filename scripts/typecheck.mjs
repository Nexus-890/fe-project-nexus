import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(root, "tsconfig.json");
const original = readFileSync(configPath, "utf8");
const temporary = path.join(root, ".tsconfig-typecheck.json");
try {
  const generated = spawnSync(
    process.execPath,
    ["node_modules/next/dist/bin/next", "typegen"],
    {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, NEXUS_TEST_DIST_DIR: ".next-typecheck" },
    },
  );
  if (generated.status !== 0) process.exitCode = generated.status ?? 1;
  else {
    const config = JSON.parse(original);
    config.compilerOptions.incremental = false;
    config.include = [
      "next-env.d.ts",
      "**/*.ts",
      "**/*.tsx",
      "**/*.mts",
      ".next-typecheck/types/**/*.ts",
    ];
    // Include freshly generated route types; ignore other servers' generated artifacts.
    config.exclude = [
      "node_modules",
      ".next/**",
      ".next-oidc-*/**",
      ".next-catalog-*/**",
      ".next-verify-build/**",
      ".next-cart-readiness-build/**",
      "test-results/**",
    ];
    writeFileSync(temporary, JSON.stringify(config, null, 2));
    const checked = spawnSync(
      process.execPath,
      ["node_modules/typescript/bin/tsc", "--noEmit", "-p", temporary],
      { cwd: root, stdio: "inherit" },
    );
    process.exitCode = checked.status ?? 1;
  }
} finally {
  writeFileSync(configPath, original);
  try {
    unlinkSync(temporary);
  } catch {}
}
