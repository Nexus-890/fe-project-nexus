import { defineConfig } from "@playwright/test";

const appPort = process.env.NEXUS_BACKOFFICE_APP_PORT || "3110";
const apiPort = process.env.NEXUS_BACKOFFICE_API_PORT || "3920";
process.env.NEXUS_BACKOFFICE_TEST = "true";
process.env.NEXUS_BACKOFFICE_APP_PORT = appPort;
process.env.NEXUS_BACKOFFICE_API_PORT = apiPort;
export default defineConfig({
  testDir: "./tests", testMatch: /(?:backoffice|seller-operations)\.spec\.ts/, workers: 1, fullyParallel: false,
  timeout: 60_000, expect: { timeout: 12_000 }, outputDir: "test-results/backoffice",
  use: { baseURL: `http://127.0.0.1:${appPort}`, channel: "chrome", viewport: { width: 1440, height: 1000 } },
  webServer: [
    { command: "node tests/backoffice-fixture.mjs", url: `http://127.0.0.1:${apiPort}/api/health`, reuseExistingServer: false, timeout: 60_000 },
    { command: `node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port ${appPort}`, url: `http://127.0.0.1:${appPort}/sign-in`, reuseExistingServer: false, timeout: 120_000,
      env: { NEXUS_TEST_DIST_DIR: ".next-backoffice-run", NEXT_PUBLIC_API_URL: `http://127.0.0.1:${apiPort}`, API_PROXY_TARGET: `http://127.0.0.1:${apiPort}`, NEXT_PUBLIC_KEYCLOAK_URL: `http://127.0.0.1:${apiPort}/keycloak`, NEXT_PUBLIC_KEYCLOAK_REALM: "nexus", NEXT_PUBLIC_KEYCLOAK_CLIENT_ID: "nexus-web", NEXT_PUBLIC_AUTH_STUB: "false", NEXT_PUBLIC_CART_MOCK: "false", NEXT_PUBLIC_PRODUCT_DETAIL_MOCK: "false", NEXT_PUBLIC_GUEST_CART_ENABLED: "false" },
    },
  ],
});
