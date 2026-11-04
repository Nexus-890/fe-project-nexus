import { test, expect } from "@playwright/test";
import runAuthAcceptance from "./auth-acceptance.mjs";

test("auth preserves session, storage, generation and cache isolation", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(90_000);
  const result = await runAuthAcceptance(page, baseURL);
  expect(result.passed).toBe(14);
  expect(result.browserErrors).toEqual([]);
});
