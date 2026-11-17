import { defineConfig } from "@playwright/test";
import backoffice from "./playwright.backoffice.config";

process.env.NEXUS_ADMIN_CATALOG_TEST = "true";
export default defineConfig({
  ...backoffice,
  testMatch: "admin-catalog.spec.ts",
  outputDir: "test-results/admin-catalog",
  use: { ...backoffice.use, trace: "retain-on-failure" },
});
