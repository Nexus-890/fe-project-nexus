import { defineConfig } from "@playwright/test";

const appPort = process.env.NEXUS_TEST_APP_PORT || "3190";
const providerPort = process.env.NEXUS_TEST_PROVIDER_PORT || "3993";
const routerPort = process.env.NEXUS_LIVE_ROUTER_PORT || "3994";
const appOrigin = `http://127.0.0.1:${appPort}`;
const routerOrigin = `http://127.0.0.1:${routerPort}`;
process.env.NEXUS_TEST_APP_PORT = appPort;
process.env.NEXUS_OIDC_APP_ORIGIN = appOrigin;
process.env.NEXUS_TEST_PROVIDER_PORT = providerPort;
process.env.NEXUS_OIDC_SIM_PORT = providerPort;
process.env.NEXUS_LIVE_BUYER_TEST = "true";

export default defineConfig({
  testDir: "./tests", testMatch: "**/buyer-live.spec.ts", workers: 1, fullyParallel: false, timeout: 90_000,
  outputDir: "test-results/buyer-live",
  use: { baseURL: appOrigin, channel: "chrome", viewport: { width: 1440, height: 1000 } },
  webServer: [
    { command: "node tests/oidc-fixture.mjs", url: `http://127.0.0.1:${providerPort}/keycloak/health`, reuseExistingServer: false, timeout: 60_000 },
    { command: "node tests/buyer-live-router.mjs", url: `${routerOrigin}/health`, reuseExistingServer: false, timeout: 60_000 },
    {
      command: `node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port ${appPort}`,
      url: appOrigin, reuseExistingServer: false, timeout: 120_000,
      env: {
        NEXUS_TEST_DIST_DIR: ".next-buyer-live-run", NEXT_PUBLIC_API_URL: routerOrigin, API_PROXY_TARGET: routerOrigin,
        NEXT_PUBLIC_AUTH_STUB: "false", NEXT_PUBLIC_KEYCLOAK_URL: `http://127.0.0.1:${providerPort}/keycloak`,
        NEXT_PUBLIC_KEYCLOAK_REALM: "nexus", NEXT_PUBLIC_KEYCLOAK_CLIENT_ID: "nexus-web",
        NEXT_PUBLIC_PRODUCT_DETAIL_MOCK: "false", NEXT_PUBLIC_CART_MOCK: "false", NEXT_PUBLIC_GUEST_CART_ENABLED: "false",
      },
    },
  ],
});
