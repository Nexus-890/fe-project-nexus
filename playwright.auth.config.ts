import { defineConfig } from "@playwright/test";

const app = process.env.NEXUS_TEST_APP_PORT
  ? `http://127.0.0.1:${process.env.NEXUS_TEST_APP_PORT}`
  : process.env.NEXUS_OIDC_APP_ORIGIN || "http://127.0.0.1:3103";
const appPort = new URL(app).port || "80";
const providerPort = process.env.NEXUS_TEST_PROVIDER_PORT || process.env.NEXUS_OIDC_SIM_PORT || "3913";
const simulation = `http://127.0.0.1:${providerPort}`;

// Both test families and their child fixtures must use the same origins.
process.env.NEXUS_TEST_APP_PORT = appPort;
process.env.NEXUS_OIDC_APP_ORIGIN = app;
process.env.NEXUS_TEST_PROVIDER_PORT = providerPort;
process.env.NEXUS_OIDC_SIM_PORT = providerPort;

export default defineConfig({
  testDir: "./tests",
  testMatch: process.env.NEXUS_TEST_SESSION_LONG === "true"
    ? "session-long.spec.ts"
    : ["oidc.spec.ts", "guest-cart.spec.ts", "session.spec.ts"],
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  outputDir: "test-results/oidc",
  use: {
    baseURL: app,
    channel: "chrome",
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node tests/oidc-fixture.mjs",
      url: `${simulation}/keycloak/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port ${appPort}`,
      url: `${app}/sign-in`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NEXUS_TEST_DIST_DIR: process.env.NEXUS_TEST_DIST_DIR || ".next-oidc-run",
        NEXT_PUBLIC_API_URL: simulation,
        NEXT_PUBLIC_AUTH_STUB: "false",
        NEXT_PUBLIC_PRODUCT_DETAIL_MOCK: "false",
        NEXT_PUBLIC_CART_MOCK: "false",
        NEXT_PUBLIC_GUEST_CART_ENABLED: "true",
        NEXUS_TEST_AUTH_PROBE: "true",
        NEXT_PUBLIC_KEYCLOAK_URL: `${simulation}/keycloak`,
        NEXT_PUBLIC_KEYCLOAK_REALM: "nexus",
        NEXT_PUBLIC_KEYCLOAK_CLIENT_ID: "nexus-web",
      },
    },
  ],
});
