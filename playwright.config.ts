import { defineConfig } from "@playwright/test";

const appOrigin = process.env.NEXUS_TEST_APP_PORT
  ? `http://127.0.0.1:${process.env.NEXUS_TEST_APP_PORT}`
  : process.env.NEXUS_OIDC_APP_ORIGIN || "http://127.0.0.1:3102";
const appPort = new URL(appOrigin).port || "80";
const apiPort = Number(process.env.NEXUS_TEST_API_PORT ?? 3911);
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const providerPort = process.env.NEXUS_TEST_PROVIDER_PORT || process.env.NEXUS_OIDC_SIM_PORT || "3913";
const providerOrigin = `http://127.0.0.1:${providerPort}/keycloak`;

// Keep the catalog/notification and OIDC fixture environment aliases aligned.
process.env.NEXUS_TEST_APP_PORT = appPort;
process.env.NEXUS_OIDC_APP_ORIGIN = appOrigin;
process.env.NEXUS_TEST_PROVIDER_PORT = providerPort;
process.env.NEXUS_OIDC_SIM_PORT = providerPort;

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  testIgnore: ["**/checkout.spec.ts", "**/place-order.spec.ts", "**/payment.spec.ts", "**/payment-polling.spec.ts", "**/cart-shared.spec.ts", "**/profile.spec.ts", "**/oidc.spec.ts", "**/guest-cart.spec.ts", "**/session.spec.ts", "**/session-long.spec.ts"],
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  use: { baseURL: appOrigin, channel: "chrome", viewport: { width: 375, height: 812 } },
  webServer: [
    { command: "node tests/oidc-fixture.mjs", url: `${providerOrigin}/health`, reuseExistingServer: false, timeout: 60_000 },
    { command: "node tests/catalog-fixture.mjs", url: `${apiOrigin}/health`, reuseExistingServer: false },
    {
      command: `node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port ${appPort}`,
      url: appOrigin,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NEXUS_TEST_DIST_DIR: process.env.NEXUS_TEST_DIST_DIR ?? ".next-catalog-run",
        NEXT_PUBLIC_API_URL: apiOrigin,
        NEXT_PUBLIC_AUTH_STUB: "false",
        NEXT_PUBLIC_KEYCLOAK_URL: providerOrigin,
        NEXT_PUBLIC_KEYCLOAK_REALM: "nexus",
        NEXT_PUBLIC_KEYCLOAK_CLIENT_ID: "nexus-web",
        NEXT_PUBLIC_PRODUCT_DETAIL_MOCK: "false",
        NEXT_PUBLIC_CART_MOCK: "false",
        NEXT_PUBLIC_GUEST_CART_ENABLED: "false",
      },
    },
  ],
});
