import { defineConfig } from "@playwright/test";

const appPort = Number(process.env.NEXUS_TEST_APP_PORT ?? 3103);
const appOrigin = `http://127.0.0.1:${appPort}`;
const simulationOrigin = `http://127.0.0.1:${process.env.NEXUS_TEST_PROVIDER_PORT ?? 3913}`;

export default defineConfig({
  testDir: "./tests",
  testMatch: ["oidc.spec.ts", "guest-cart.spec.ts"],
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  outputDir: "test-results/oidc",
  use: {
    baseURL: appOrigin,
    channel: "chrome",
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node tests/oidc-fixture.mjs",
      url: `${simulationOrigin}/keycloak/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port ${appPort}`,
      url: `${appOrigin}/sign-in`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NEXUS_TEST_DIST_DIR: process.env.NEXUS_TEST_DIST_DIR ?? ".next-oidc-run",
        NEXT_PUBLIC_API_URL: simulationOrigin,
        NEXT_PUBLIC_AUTH_STUB: "false",
        NEXT_PUBLIC_PRODUCT_DETAIL_MOCK: "false",
        NEXT_PUBLIC_CART_MOCK: "false",
        NEXT_PUBLIC_GUEST_CART_ENABLED: "true",
        NEXT_PUBLIC_KEYCLOAK_URL: `${simulationOrigin}/keycloak`,
        NEXT_PUBLIC_KEYCLOAK_REALM: "nexus",
        NEXT_PUBLIC_KEYCLOAK_CLIENT_ID: "nexus-web",
      },
    },
  ],
});
