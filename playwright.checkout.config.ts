import { defineConfig } from "@playwright/test";

const appPort = process.env.NEXUS_CHECKOUT_APP_PORT || "3103";
const apiPort = process.env.NEXUS_CHECKOUT_API_PORT || "3913";
const appOrigin = `http://127.0.0.1:${appPort}`;
const apiOrigin = `http://127.0.0.1:${apiPort}`;

export default defineConfig({
  testDir: "./tests",
  testMatch: ["checkout.spec.ts", "place-order.spec.ts"],
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  outputDir: "test-results/checkout",
  use: {
    baseURL: appOrigin,
    channel: "chrome",
    viewport: { width: 375, height: 812 },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node tests/checkout-fixture.mjs",
      url: `${apiOrigin}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port ${appPort}`,
      url: `${appOrigin}/sign-in`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NEXUS_TEST_DIST_DIR: process.env.NEXUS_TEST_DIST_DIR || ".next-checkout-run",
        NEXT_PUBLIC_API_URL: apiOrigin,
        API_PROXY_TARGET: apiOrigin,
        NEXT_PUBLIC_AUTH_STUB: "false",
        NEXT_PUBLIC_PRODUCT_DETAIL_MOCK: "false",
        NEXT_PUBLIC_CART_MOCK: "false",
        NEXT_PUBLIC_KEYCLOAK_URL: `${apiOrigin}/keycloak`,
        NEXT_PUBLIC_KEYCLOAK_REALM: "nexus",
        NEXT_PUBLIC_KEYCLOAK_CLIENT_ID: "nexus-web",
      },
    },
  ],
});
