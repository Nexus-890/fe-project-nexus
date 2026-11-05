import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const original = readFileSync(path.join(root, "tsconfig.json"), "utf8");
const config = JSON.parse(original);
const dist = process.env.NEXUS_TEST_DIST_DIR ?? ".next";
const temporary = path.join(root, ".tsconfig-build.json");
config.include = [
  "next-env.d.ts",
  "**/*.ts",
  "**/*.tsx",
  "**/*.mts",
  `${dist}/types/**/*.ts`,
];
config.exclude = [
  "node_modules",
  "test-results/**",
  `${dist}/dev/**`,
  ...readdirSync(root)
    .filter((name) => name.startsWith(".next") && name !== dist)
    .map((name) => name + "/**"),
];
config.compilerOptions.incremental = false;
try {
  writeFileSync(temporary, JSON.stringify(config, null, 2));
  const result = spawnSync(
    process.execPath,
    ["node_modules/next/dist/bin/next", "build", ...process.argv.slice(2)],
    {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, NEXUS_TSCONFIG: ".tsconfig-build.json" },
    },
  );
  process.exitCode = result.status ?? 1;
} finally {
  writeFileSync(path.join(root, "tsconfig.json"), original);
  try {
    unlinkSync(temporary);
  } catch {}
}
