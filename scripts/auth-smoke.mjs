#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const routeDir = path.join(root, "app", "auth-smoke");
const pagePath = path.join(routeDir, "page.tsx");
const pageSource = `import AuthProbe from "../../tests/AuthProbe";\n\nexport default function AuthSmokePage() {\n  return <AuthProbe />;\n}\n`;

const routes = [
  { routeDir, pagePath, pageSource },
  {
    routeDir: path.join(root, "app", "session-probe"),
    pagePath: path.join(root, "app", "session-probe", "page.tsx"),
    pageSource: 'import { notFound } from "next/navigation";\nimport SessionProbe from "../../tests/SessionProbe";\n\nexport default function SessionProbePage() {\n  if (process.env.NODE_ENV === "production" || process.env.NEXUS_TEST_AUTH_PROBE !== "true") notFound();\n  return <SessionProbe />;\n}\n',
  },
];
const command = process.argv[2];

if (command === "prepare") {
  for (const route of routes) prepare(route);
} else if (command === "cleanup") {
  for (const route of routes) cleanup(route);
} else {
  help();
  process.exitCode = command ? 1 : 0;
}

function prepare({ routeDir, pagePath, pageSource }) {
  if (existsSync(pagePath)) {
    const existing = readFileSync(pagePath, "utf8");
    if (existing !== pageSource) {
      throw new Error(
        `Refusing to overwrite existing non-generated route: ${relative(pagePath)}`,
      );
    }
    printReady("already prepared", pagePath);
    return;
  }

  mkdirSync(routeDir, { recursive: true });
  writeFileSync(pagePath, pageSource, "utf8");
  printReady("prepared", pagePath);
}

function cleanup({ routeDir, pagePath, pageSource }) {
  if (!existsSync(pagePath)) {
    console.log("auth-smoke route is already absent.");
    return;
  }

  const existing = readFileSync(pagePath, "utf8");
  if (existing !== pageSource) {
    throw new Error(
      `Refusing to remove non-generated route: ${relative(pagePath)}`,
    );
  }

  rmSync(pagePath);
  if (existsSync(routeDir) && readdirSync(routeDir).length === 0) {
    rmdirSync(routeDir);
  }
  console.log(`Removed ${relative(pagePath)}.`);
}

function printReady(status, pagePath) {
  console.log(`Auth smoke route ${status}: ${relative(pagePath)}`);
  console.log("Run Next locally, then open: http://localhost:3000/auth-smoke");
  console.log(
    "Controls: register, login, signout, me after logout, invalid register 400, expired me 401 query invalidation, transient me 503 during login, retry profile, delayed login ignoring abort, delayed me ignoring abort, account switch second fixture.",
  );
  console.log(
    "Machine-readable probes: [data-testid=state] and [data-testid=evidence].",
  );
  console.log("Cleanup: node scripts/auth-smoke.mjs cleanup");
}

function help() {
  console.log(
    `Usage:\n  node scripts/auth-smoke.mjs prepare\n  node scripts/auth-smoke.mjs cleanup\n\nprepare creates ${relative(pagePath)} only if absent or already generated.\ncleanup removes only that exact generated page.\nOpen http://localhost:3000/auth-smoke while Next dev server is running.`,
  );
}

function relative(file) {
  return path.relative(root, file);
}
