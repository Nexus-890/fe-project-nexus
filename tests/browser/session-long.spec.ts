import { test, expect } from "@playwright/test";

// Optional wall-clock acceptance run. The actual Next.js app and browser remain
// active for five real minutes against local Keycloak/API HTTP stand-ins.
// Run with NEXUS_TEST_SESSION_LONG=true and playwright.auth.config.ts.
const simulation = "http://127.0.0.1:3913";
const app = "http://127.0.0.1:3103";
const subject = "68000000-0000-4000-8000-000000000003";

test("two-minute access tokens keep the same active user signed in for five real minutes", async ({ page, request }) => {
  test.setTimeout(360_000);
  expect((await request.get(`${simulation}/keycloak/test/reset`)).ok()).toBe(true);
  expect((await request.get(`${simulation}/api/test/reset`)).ok()).toBe(true);
  expect((await request.get(`${simulation}/keycloak/test/control?ttl=120`)).ok()).toBe(true);

  await page.goto("/sign-in?returnTo=%2Fsession-probe");
  await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Keycloak sign in", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("buyer@nexus.local");
  await page.getByLabel("Password", { exact: true }).fill("Fixture-pass-123!");
  await page.getByRole("button", { name: "Sign in at Keycloak", exact: true }).click();
  await expect(page).toHaveURL(`${app}/session-probe`);
  await expect(page.getByTestId("session-status")).toHaveText("authenticated");
  await expect(page.getByTestId("session-user")).toHaveText(subject);

  const startedAt = Date.now();
  const activity = page.getByRole("button", { name: "Run three protected requests", exact: true });
  let batches = 0;
  while (Date.now() - startedAt < 300_000) {
    const remaining = 300_000 - (Date.now() - startedAt);
    await new Promise((resolve) => setTimeout(resolve, Math.min(20_000, remaining)));
    await expect(page.getByTestId("session-status")).toHaveText("authenticated");
    await expect(page.getByTestId("session-user")).toHaveText(subject);
    await activity.click();
    batches += 1;
    await expect.poll(async () => {
      const response = await request.get(`${simulation}/api/test/evidence`);
      return (await response.json()).protectedRequests;
    }).toBeGreaterThanOrEqual(batches * 3);
    await expect(activity).toBeEnabled();
    await expect(page.getByTestId("request-results")).toHaveText("[200,200,200]");
  }

  expect(Date.now() - startedAt).toBeGreaterThanOrEqual(300_000);
  const providerEvidence = await (await request.get(`${simulation}/keycloak/test/evidence`)).json();
  expect(providerEvidence.refreshRequests).toBeGreaterThanOrEqual(4);
  expect(providerEvidence.issuedTokens).toBeGreaterThanOrEqual(5);
  expect(providerEvidence.issuedLifetimes.every((ttl: number) => ttl === 120)).toBe(true);
  expect(providerEvidence.passwordSubmissions).toBe(1);
  expect(providerEvidence.sessions).toBe(1);
  await expect(page.getByTestId("session-status")).toHaveText("authenticated");
  await expect(page.getByTestId("session-user")).toHaveText(subject);

  const stored = await page.evaluate(() => JSON.stringify([
    ...Object.entries(localStorage), ...Object.entries(sessionStorage),
  ]));
  expect(stored).not.toContain("access_token");
  expect(stored).not.toContain("refresh_token");
  expect(stored).not.toContain("id_token");
  expect(stored).not.toContain("fixture-refresh-");
  expect(stored).not.toMatch(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\./);
});
