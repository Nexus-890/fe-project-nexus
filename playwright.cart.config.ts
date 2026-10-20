import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "cart.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  outputDir: "test-results/cart",
  use: {
    baseURL: "http://127.0.0.1:3104",
    channel: "chrome",
    viewport: { width: 1440, height: 1056 },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "postman simulation run postman/simulations/cart.sim.yaml --port 3913 --no-history --output ndjson > cart-simulation.ndjson 2> cart-simulation.err",
      url: "http://127.0.0.1:3913/api/health",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3104",
      url: "http://127.0.0.1:3104/sign-in",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NEXUS_TEST_DIST_DIR: ".next-cart-run",
        NEXT_PUBLIC_API_URL: "http://127.0.0.1:3913",
        NEXT_PUBLIC_AUTH_STUB: "false",
        NEXT_PUBLIC_CART_MOCK: "false",
        NEXT_PUBLIC_PRODUCT_DETAIL_MOCK: "false",
      },
    },
  ],
});
