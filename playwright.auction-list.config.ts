import { defineConfig } from "@playwright/test";
import auctionConfig from "./playwright.auction.config";

export default defineConfig({
  ...auctionConfig,
  testMatch: "auction-list.spec.ts",
  outputDir: "test-results/auction-list",
});
