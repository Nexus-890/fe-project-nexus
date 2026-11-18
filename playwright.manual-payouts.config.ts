import { defineConfig } from "@playwright/test";
import backoffice from "./playwright.backoffice.config";
process.env.NEXUS_MANUAL_PAYOUTS_TEST = "true";
export default defineConfig({ ...backoffice, use: { ...backoffice.use, trace: "retain-on-failure" }, testMatch: /manual-payouts\.spec\.ts/, outputDir: "test-results/manual-payouts", timeout: 120_000 });
