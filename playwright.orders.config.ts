import { defineConfig } from "@playwright/test";
import shared from "./playwright.config";

process.env.NEXUS_ORDER_LIST_TEST = "true";
const servers = Array.isArray(shared.webServer) ? shared.webServer : [];
const orderPort = process.env.NEXUS_ORDER_LIST_PORT || "3914";

export default defineConfig({
  ...shared,
  testMatch: ["**/orders.spec.ts", "**/order-detail.spec.ts"],
  webServer: [
    { command: "node tests/order-list-fixture.mjs", url: `http://127.0.0.1:${orderPort}/api/health`, reuseExistingServer: false, timeout: 60_000 },
    ...servers.map((server) => server.env ? {
      ...server,
      env: { ...server.env, NEXUS_TEST_DIST_DIR: process.env.NEXUS_TEST_DIST_DIR || ".next-orders-run", NEXT_PUBLIC_API_URL: `http://127.0.0.1:${orderPort}`, API_PROXY_TARGET: `http://127.0.0.1:${orderPort}` },
    } : server),
  ],
});
