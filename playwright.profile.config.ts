import { defineConfig } from "@playwright/test";

// Uses the running Next.js frontend and real Spring services/PostgreSQL.
export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "profile.spec.ts",
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: "test-results/live-api",
  use: {
    baseURL: process.env.NEXUS_FE_URL || "http://localhost:3000",
    channel: "chrome",
    viewport: { width: 1440, height: 1000 },
    trace: "off",
  },
});
