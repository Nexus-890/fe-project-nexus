import { defineConfig } from "@playwright/test";
import backoffice from "./playwright.backoffice.config";
process.env.NEXUS_PROMOTIONS_TEST = "true";
export default defineConfig({ ...backoffice, use: { ...backoffice.use, trace: "retain-on-failure" }, testMatch: /promotions\.spec\.ts/, outputDir: "test-results/promotions", timeout: 90_000 });
