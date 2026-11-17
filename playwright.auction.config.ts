import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "auction.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 12_000 },
  outputDir: "test-results/auction",
  use: {
    baseURL: "http://127.0.0.1:3118",
    channel: "chrome",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node tests/auction-fixture.mjs",
      url: "http://127.0.0.1:3928/api/health",
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3118",
      url: "http://127.0.0.1:3118/sign-in",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NEXUS_TEST_DIST_DIR: ".next-auction-run",
        NEXT_PUBLIC_API_URL: "http://127.0.0.1:3928",
        API_PROXY_TARGET: "http://127.0.0.1:3928",
        NEXT_PUBLIC_AUTH_STUB: "false",
        NEXT_PUBLIC_PRODUCT_DETAIL_MOCK: "false",
        NEXT_PUBLIC_CART_MOCK: "false",
        NEXT_PUBLIC_GUEST_CART_ENABLED: "false",
        NEXT_PUBLIC_KEYCLOAK_URL: "http://127.0.0.1:3928/keycloak",
        NEXT_PUBLIC_KEYCLOAK_REALM: "nexus",
        NEXT_PUBLIC_KEYCLOAK_CLIENT_ID: "nexus-web",
      },
    },
  ],
});
