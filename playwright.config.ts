import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "catalog.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  use: { baseURL: "http://127.0.0.1:3102", channel: "chrome", viewport: { width: 375, height: 812 } },
  webServer: [
    { command: "node tests/browser/catalog-fixture.mjs", url: "http://127.0.0.1:3911/health", reuseExistingServer: false },
    {
      command: "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3102",
      url: "http://127.0.0.1:3102",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NEXUS_TEST_DIST_DIR: ".next-catalog-run",
        NEXT_PUBLIC_API_URL: "http://127.0.0.1:3911",
        NEXT_PUBLIC_AUTH_STUB: "false",
      },
    },
  ],
});
