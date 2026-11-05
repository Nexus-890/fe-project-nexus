import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "profile.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  outputDir: "test-results/profile",
  use: {
    baseURL: "http://127.0.0.1:3103",
    channel: "chrome",
    viewport: { width: 375, height: 812 },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "postman simulation run postman/simulations/profile.sim.yaml --port 3913 --no-history --output ndjson > profile-simulation.ndjson 2> profile-simulation.err",
      url: "http://127.0.0.1:3913/api/health",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3103",
      url: "http://127.0.0.1:3103/sign-in",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NEXUS_TEST_DIST_DIR: ".next-profile-run",
        NEXT_PUBLIC_API_URL: "http://127.0.0.1:3913",
        API_PROXY_TARGET: "http://127.0.0.1:3913",
        NEXT_PUBLIC_AUTH_STUB: "false",
        NEXT_PUBLIC_CART_MOCK: "false",
        NEXT_PUBLIC_PRODUCT_DETAIL_MOCK: "false",
        NEXT_PUBLIC_KEYCLOAK_URL: "http://127.0.0.1:3913/keycloak",
        NEXT_PUBLIC_KEYCLOAK_REALM: "nexus",
        NEXT_PUBLIC_KEYCLOAK_CLIENT_ID: "nexus-web",
      },
    },
  ],
});
