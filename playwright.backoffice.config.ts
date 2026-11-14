import { defineConfig } from "@playwright/test";

process.env.NEXUS_BACKOFFICE_TEST = "true";
export default defineConfig({
  testDir: "./tests", testMatch: /(?:backoffice|seller-operations)\.spec\.ts/, workers: 1, fullyParallel: false,
  timeout: 60_000, expect: { timeout: 12_000 }, outputDir: "test-results/backoffice",
  use: { baseURL: "http://127.0.0.1:3110", channel: "chrome", viewport: { width: 1440, height: 1000 } },
  webServer: [
    { command: "node tests/backoffice-fixture.mjs", url: "http://127.0.0.1:3920/api/health", reuseExistingServer: false, timeout: 60_000 },
    { command: "node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3110", url: "http://127.0.0.1:3110/sign-in", reuseExistingServer: false, timeout: 120_000,
      env: { NEXUS_TEST_DIST_DIR: ".next-backoffice-run", NEXT_PUBLIC_API_URL: "http://127.0.0.1:3920", API_PROXY_TARGET: "http://127.0.0.1:3920", NEXT_PUBLIC_KEYCLOAK_URL: "http://127.0.0.1:3920/keycloak", NEXT_PUBLIC_KEYCLOAK_REALM: "nexus", NEXT_PUBLIC_KEYCLOAK_CLIENT_ID: "nexus-web", NEXT_PUBLIC_AUTH_STUB: "false", NEXT_PUBLIC_CART_MOCK: "false", NEXT_PUBLIC_PRODUCT_DETAIL_MOCK: "false", NEXT_PUBLIC_GUEST_CART_ENABLED: "false" },
    },
  ],
});
