import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["account.spec.ts", "account-addresses.spec.ts"],
  fullyParallel: false, workers: 1,
  timeout: 60_000, expect: { timeout: 15_000 },
  outputDir: "test-results/account",
  use: { baseURL: "http://127.0.0.1:3110", channel: "chrome", viewport: { width: 375, height: 812 }, trace: "retain-on-failure" },
  webServer: [
    { command: "node tests/account-fixture.mjs", url: "http://127.0.0.1:3921/api/health", reuseExistingServer: false, timeout: 60_000 },
    {
      command: "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3110",
      url: "http://127.0.0.1:3110/sign-in", reuseExistingServer: false, timeout: 120_000,
      env: {
        NEXUS_TEST_DIST_DIR: ".next-account-run", NEXT_PUBLIC_API_URL: "", API_PROXY_TARGET: "http://127.0.0.1:3921",
        NEXT_PUBLIC_AUTH_STUB: "false", NEXT_PUBLIC_PRODUCT_DETAIL_MOCK: "false", NEXT_PUBLIC_CART_MOCK: "false", NEXT_PUBLIC_GUEST_CART_ENABLED: "false",
        NEXT_PUBLIC_KEYCLOAK_URL: "http://127.0.0.1:3921/keycloak", NEXT_PUBLIC_KEYCLOAK_REALM: "nexus", NEXT_PUBLIC_KEYCLOAK_CLIENT_ID: "nexus-web",
      },
    },
  ],
});
