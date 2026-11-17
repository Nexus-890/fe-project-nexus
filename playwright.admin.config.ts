import { defineConfig } from "@playwright/test";
import backoffice from "./playwright.backoffice.config";

process.env.NEXUS_ADMIN_TEST = "true";
const servers = Array.isArray(backoffice.webServer) ? backoffice.webServer : [];
export default defineConfig({
  ...backoffice,
  testMatch: "admin.spec.ts",
  outputDir: "test-results/admin",
  use: { ...backoffice.use, trace: "retain-on-failure" },
  webServer: servers.map((server, index) => index === 1 ? {
    ...server,
    env: { ...server.env, NEXUS_TEST_DIST_DIR: ".next-admin-run", NEXT_PUBLIC_SELLER_APPLICATION_ENABLED: "true" },
  } : server),
});
