import { defineConfig } from "@playwright/test";
import shared from "./playwright.config";

process.env.NEXUS_ORDER_LIST_TEST = "true";
const servers = Array.isArray(shared.webServer) ? shared.webServer : [];

export default defineConfig({
  ...shared,
  testMatch: "**/orders.spec.ts",
  webServer: [
    { command: "node tests/order-list-fixture.mjs", url: "http://127.0.0.1:3914/api/health", reuseExistingServer: false, timeout: 60_000 },
    ...servers.map((server) => server.env ? {
      ...server,
      env: { ...server.env, NEXUS_TEST_DIST_DIR: ".next-orders-run", NEXT_PUBLIC_API_URL: "http://127.0.0.1:3914" },
    } : server),
  ],
});
