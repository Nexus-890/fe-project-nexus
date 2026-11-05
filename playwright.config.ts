import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  testIgnore: ["**/cart-shared.spec.ts", "**/profile.spec.ts", "**/oidc.spec.ts", "**/guest-cart.spec.ts"],
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  use: { baseURL: "http://127.0.0.1:3102", channel: "chrome", viewport: { width: 375, height: 812 } },
  webServer: [
    { command: "node tests/oidc-fixture.mjs", url: "http://127.0.0.1:3913/keycloak/health", reuseExistingServer: false, timeout: 60_000 },
    { command: "node tests/catalog-fixture.mjs", url: "http://127.0.0.1:3911/health", reuseExistingServer: false },
    {
      command: "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3102",
      url: "http://127.0.0.1:3102",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NEXUS_TEST_DIST_DIR: ".next-catalog-run",
        NEXT_PUBLIC_API_URL: "http://127.0.0.1:3911",
        NEXT_PUBLIC_AUTH_STUB: "false",
        NEXT_PUBLIC_KEYCLOAK_URL: "http://127.0.0.1:3913/keycloak",
        NEXT_PUBLIC_KEYCLOAK_REALM: "nexus",
        NEXT_PUBLIC_KEYCLOAK_CLIENT_ID: "nexus-web",
        NEXT_PUBLIC_PRODUCT_DETAIL_MOCK: "false",
        NEXT_PUBLIC_CART_MOCK: "false",
        NEXT_PUBLIC_GUEST_CART_ENABLED: "false",
      },
    },
  ],
});
