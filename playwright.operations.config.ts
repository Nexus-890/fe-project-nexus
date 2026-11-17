import { defineConfig } from "@playwright/test";
import backoffice from "./playwright.backoffice.config";

export default defineConfig({ ...backoffice, testMatch: /(?:support-operations|seller-operations)\.spec\.ts/, outputDir: "test-results/operations" });
