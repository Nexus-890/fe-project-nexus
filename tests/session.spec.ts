import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

// Real Next.js/SDK/browser HTTP against the committed local stand-ins. The
// virtual-clock scenario proves scheduling under a two-minute token model;
// it does not claim a five-minute wall-clock run against live Keycloak.
const simulation = `http://127.0.0.1:${process.env.NEXUS_OIDC_SIM_PORT || "3913"}`;
const app = process.env.NEXUS_OIDC_APP_ORIGIN || "http://127.0.0.1:3103";
const probePath = "/session-probe";
const subject = "68000000-0000-4000-8000-000000000003";

async function evidence(request: APIRequestContext, member: "api" | "keycloak" = "keycloak") {
  const response = await request.get(`${simulation}/${member}/test/evidence`);
  expect(response.ok()).toBe(true);
  return response.json();
}

async function control(request: APIRequestContext, member: "api" | "keycloak", params: Record<string, string>) {
  const response = await request.get(`${simulation}/${member}/test/control`, { params });
  expect(response.ok()).toBe(true);
}

async function clockTime(request: APIRequestContext, time: number) {
  const response = await request.get(`${simulation}/keycloak/test/clock`, { params: { time: String(time) } });
  expect(response.ok()).toBe(true);
}

async function login(page: Page, destination = probePath) {
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(destination)}`);
  await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Keycloak sign in", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("buyer@nexus.local");
  await page.getByLabel("Password", { exact: true }).fill("Fixture-pass-123!");
  await page.getByRole("button", { name: "Sign in at Keycloak", exact: true }).click();
  await expect(page).toHaveURL(`${app}${destination}`);
  await expect(page.getByTestId("session-status")).toHaveText("authenticated");
  await expect(page.getByTestId("session-user")).toHaveText(subject);
}

function captureTokenResponses(page: Page) {
  const credentials: string[] = [];
  page.on("response", (response) => {
    if (!response.url().endsWith("/protocol/openid-connect/token") || !response.ok()) return;
    void response.json().then((body) => {
      for (const key of ["access_token", "refresh_token", "id_token"]) {
        if (typeof body[key] === "string") credentials.push(body[key]);
      }
    }).catch(() => {});
  });
  return credentials;
}

async function assertNoStoredTokens(page: Page, credentials: string[]) {
  const storage = await page.evaluate(() => [...Object.entries(localStorage), ...Object.entries(sessionStorage)]);
  const text = JSON.stringify(storage);
  expect(text).not.toContain("access_token");
  expect(text).not.toContain("refresh_token");
  expect(text).not.toContain("id_token");
  expect(text).not.toMatch(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\./);
  // Do not print credential material if this assertion fails.
  const fragments = credentials.flatMap((token) => token.includes(".") ? token.split(".") : [token]);
  expect(fragments.every((part) => !text.includes(part))).toBe(true);
}

test.beforeEach(async ({ request }) => {
  expect((await request.get(`${simulation}/keycloak/test/reset`)).ok()).toBe(true);
  expect((await request.get(`${simulation}/api/test/reset`)).ok()).toBe(true);
});

test("reload restores the same user with prompt=none, stays restoring while profile loads and shows no sign-in page", async ({ page, request }) => {
  const credentials = captureTokenResponses(page);
  await login(page);
  const before = await evidence(request);
  const topNavigations: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) topNavigations.push(new URL(frame.url()).pathname);
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route(`${simulation}/api/v1/users/me`, async (route) => {
    await gate;
    await route.continue();
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("session-status")).toHaveText("restoring");
  await expect(page.getByRole("button", { name: "Continue to sign in", exact: true })).toHaveCount(0);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  release();
  await expect(page.getByTestId("session-status")).toHaveText("authenticated");
  await expect(page.getByTestId("session-user")).toHaveText(subject);
  expect(topNavigations).not.toContain("/sign-in");
  expect(await evidence(request)).toMatchObject({
    authorizations: 1, passwordSubmissions: 1,
    silentAuthorizations: before.silentAuthorizations + 1,
    silentSuccesses: before.silentSuccesses + 1,
    codeExchanges: before.codeExchanges + 1,
  });
  await assertNoStoredTokens(page, credentials);
});

test("three simultaneous 401 responses share one renew and each request is retried once", async ({ page, request }) => {
  const credentials = captureTokenResponses(page);
  await login(page);
  const before = await evidence(request);
  await control(request, "api", { mode: "protected-401-once" });
  await page.getByRole("button", { name: "Run three protected requests", exact: true }).click();
  await expect(page.getByTestId("request-results")).toHaveText("[200,200,200]");
  expect(await evidence(request)).toMatchObject({
    tokenRequests: before.tokenRequests + 1, refreshRequests: before.refreshRequests + 1,
  });
  expect(await evidence(request, "api")).toMatchObject({ protectedRequests: 6, protectedRetries: 3 });
  const calls = (await evidence(request, "api")).protectedCalls;
  for (const key of ["a", "b", "c"]) {
    expect(calls.filter((call: { key: string }) => call.key === key).map((call: { status: number }) => call.status)).toEqual([401, 200]);
  }
  await expect(page.getByTestId("session-status")).toHaveText("authenticated");
  await assertNoStoredTokens(page, credentials);
});

test("opening the cart keeps the account loading UI until session restoration settles", async ({ page, request }) => {
  await login(page);
  const before = await evidence(request);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route(`${simulation}/api/v1/users/me`, async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/cart", { waitUntil: "domcontentloaded" });
  try {
    await expect(page.getByText("Loading your account…", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sign in to view your cart", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveCount(0);
  } finally {
    release();
  }
  await expect(page.getByText("Loading your account…", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Shopping cart, 3 items", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign in to view your cart", exact: true })).toHaveCount(0);
  expect(await evidence(request)).toMatchObject({ silentSuccesses: before.silentSuccesses + 1 });
});

test("a request still rejected after retry stops after two sends and one renew", async ({ page, request }) => {
  await login(page);
  const before = await evidence(request);
  await control(request, "api", { mode: "protected-401-always" });
  await page.getByRole("button", { name: "Run rejected request", exact: true }).click();
  await expect(page.getByTestId("request-results")).toHaveText("[401]");
  expect(await evidence(request)).toMatchObject({
    tokenRequests: before.tokenRequests + 1, refreshRequests: before.refreshRequests + 1,
  });
  expect(await evidence(request, "api")).toMatchObject({ protectedRequests: 2, protectedRetries: 1 });
});

test("failed renew clears local authentication and leaves storage without authentication tokens", async ({ page, request }) => {
  const credentials = captureTokenResponses(page);
  await login(page);
  const before = await evidence(request);
  await control(request, "api", { mode: "protected-401-once" });
  await control(request, "keycloak", { mode: "renew-error" });
  await page.getByRole("button", { name: "Run three protected requests", exact: true }).click();
  await expect(page.getByTestId("session-status")).toHaveText("anonymous");
  await expect(page.getByTestId("request-results")).toHaveText("[401,401,401]");
  expect(await evidence(request)).toMatchObject({
    refreshRequests: before.refreshRequests + 1, tokenRequests: before.tokenRequests + 1,
  });
  expect(await evidence(request, "api")).toMatchObject({ protectedRequests: 3, protectedRetries: 0 });
  await assertNoStoredTokens(page, credentials);
});

test("two-minute tokens renew before expiry throughout five minutes of modeled browser activity", async ({ page, request }) => {
  const start = Date.now();
  const credentials = captureTokenResponses(page);
  await control(request, "keycloak", { ttl: "120" });
  await clockTime(request, start);
  await page.clock.install({ time: start });
  await login(page);
  const pausedAt = await page.evaluate(() => Date.now() + 1_000);
  await page.clock.pauseAt(pausedAt);
  await clockTime(request, pausedAt);
  for (let minute = 1; minute <= 5; minute++) {
    await clockTime(request, pausedAt + minute * 60_000);
    await page.clock.runFor(60_000);
    // Network completion can publish a token just after a minute boundary;
    // allow that boundary without demanding an extra premature renewal.
    await expect.poll(async () => (await evidence(request)).refreshRequests).toBeGreaterThanOrEqual(Math.max(0, minute - 1));
    await expect(page.getByTestId("session-status")).toHaveText("authenticated");
    await expect(page.getByTestId("session-user")).toHaveText(subject);
    const activity = page.getByRole("button", { name: "Run three protected requests", exact: true });
    await activity.click();
    await expect.poll(async () => (await evidence(request, "api")).protectedRequests).toBeGreaterThanOrEqual(minute * 3);
    await expect(activity).toBeEnabled();
    await expect(page.getByTestId("request-results")).toHaveText("[200,200,200]");
  }
  const after = await evidence(request);
  expect(after.issuedLifetimes.every((ttl: number) => ttl === 120)).toBe(true);
  expect(after.refreshRequests).toBeGreaterThanOrEqual(4);
  expect((await evidence(request, "api")).protectedCalls.every((call: { status: number }) => call.status === 200)).toBe(true);
  expect(await page.evaluate(() => Date.now()) - pausedAt).toBe(300_000);
  await assertNoStoredTokens(page, credentials);
});

test("after provider sign-out, reload remains anonymous and does not restore the old SSO session", async ({ page, request }) => {
  const credentials = captureTokenResponses(page);
  await login(page);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`^${app}/`));
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  expect(await evidence(request)).toMatchObject({ logouts: 1, sessions: 0 });
  await page.reload();
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toHaveCount(0);
  expect(await evidence(request)).toMatchObject({ logouts: 1, sessions: 0, tokenRequests: 1 });
  await assertNoStoredTokens(page, credentials);
});
