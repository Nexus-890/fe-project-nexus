import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

const simulation = "http://127.0.0.1:3913";
const fixtureUrl = `${simulation}/api`;
const originalName = "Nguyễn Thị Lan";
const originalAddress = "227 Nguyễn Văn Cừ, Ward 4, District 5, Ho Chi Minh City";

type RecordedRequest = { method: string; path: string; body: Record<string, unknown> | null; authenticated: boolean };

async function control(request: APIRequestContext, body: Record<string, unknown>) {
  expect((await request.post(`${fixtureUrl}/__test/control`, { data: body })).ok()).toBe(true);
}

async function history(request: APIRequestContext): Promise<RecordedRequest[]> {
  return (await request.get(`${fixtureUrl}/__test/requests`)).json();
}

async function keycloakEvidence(request: APIRequestContext): Promise<{
  tokenRequests: number;
  refreshRequests: number;
  logouts: number;
}> {
  const response = await request.get(`${simulation}/keycloak/test/evidence`);
  expect(response.ok()).toBe(true);
  return response.json();
}

async function clockTime(request: APIRequestContext, time: number) {
  expect((await request.get(`${simulation}/keycloak/test/clock`, {
    params: { time: String(time) },
  })).ok()).toBe(true);
}

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Keycloak sign in", exact: true })).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill("lan.nguyen@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Fixture-pass-123!");
  await page.getByRole("button", { name: "Sign in at Keycloak", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("header").getByRole("link", { name: `Hi ${originalName}` })).toBeVisible();
}

async function openProfile(page: Page) {
  await page.locator("header").getByRole("link", { name: `Hi ${originalName}` }).click();
  await expect(page).toHaveURL(/\/profile$/);
}

async function populatedForm(page: Page) {
  await expect(page.getByLabel("Full Name", { exact: true })).toHaveValue(originalName);
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("lan.nguyen@example.com");
  await expect(page.getByLabel("Phone Number", { exact: true })).toHaveValue("+84912345678");
  await expect(page.getByLabel("Address", { exact: true })).toHaveValue(originalAddress);
  await expect(page.getByLabel("Date of Birth", { exact: true })).toHaveValue("2001-05-12");
}

async function responsiveChecks(page: Page) {
  expect(await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth })))
    .toEqual({ width: 375, scroll: 375 });
  const clipped = await page.locator("header a:visible, header button:visible, main h1:visible, main h2:visible, main p:visible, main label:visible, main button:visible, main a:visible, footer a:visible")
    .evaluateAll(elements => elements.filter(el => el instanceof HTMLElement && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1)
      .map(el => (el.textContent ?? "").trim()).filter(Boolean));
  expect(clipped).toEqual([]);
}

test.beforeEach(async ({ request }) => {
  expect((await request.get(`${simulation}/keycloak/test/reset`)).ok()).toBe(true);
  expect((await request.post(`${fixtureUrl}/__test/reset`, { data: {} })).ok()).toBe(true);
});

test("anonymous visitors are redirected to sign in", async ({ page, request }) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/sign-in(?:\?|$)/);
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  expect((await history(request)).filter(entry => entry.path === "/v1/users/me")).toEqual([]);
});

test("header links to profile, GET populates, PUT updates the form and header, cancel restores", async ({ page, request }) => {
  await signIn(page);
  const profileResponse = page.waitForResponse(response => response.request().method() === "GET" && new URL(response.url()).pathname === "/api/v1/users/me");
  await openProfile(page);
  expect(await (await profileResponse).json()).toMatchObject({
    code: 0, message: "response success", data: { fullName: originalName },
  });
  await populatedForm(page);
  await expect.poll(async () => (await history(request)).filter(entry => entry.method === "GET" && entry.path === "/v1/users/me").length).toBeGreaterThanOrEqual(2);
  await expect(page.getByLabel("Phone Number", { exact: true })).toHaveAttribute("readonly", "");

  await page.getByLabel("Full Name", { exact: true }).fill("Lan Nguyễn Updated");
  await page.getByLabel("Email", { exact: true }).fill("lan.updated@example.com");
  await page.getByLabel("Address", { exact: true }).fill("123 Nguyễn Huệ, Hồ Chí Minh City");
  const saved = page.waitForResponse(response => response.request().method() === "PUT" && new URL(response.url()).pathname === "/api/v1/users/me");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  const savedResponse = await saved;
  expect(savedResponse.status()).toBe(200);
  expect(await savedResponse.json()).toMatchObject({
    code: 0, message: "response success", data: { fullName: "Lan Nguyễn Updated" },
  });
  await expect(page.getByLabel("Full Name", { exact: true })).toHaveValue("Lan Nguyễn Updated");
  await expect(page.locator("header").getByRole("link", { name: "Hi Lan Nguyễn Updated" })).toBeVisible();
  const puts = (await history(request)).filter(entry => entry.method === "PUT" && entry.path === "/v1/users/me");
  expect(puts).toHaveLength(1);
  expect(puts[0].authenticated).toBe(true);
  expect(puts[0].body).toEqual({
    fullName: "Lan Nguyễn Updated",
    email: "lan.updated@example.com",
    address: "123 Nguyễn Huệ, Hồ Chí Minh City",
  });

  await page.getByLabel("Full Name", { exact: true }).fill("Unsaved name");
  await page.getByLabel("Address", { exact: true }).fill("Unsaved address");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Full Name", { exact: true })).toHaveValue("Lan Nguyễn Updated");
  await expect(page.getByLabel("Address", { exact: true })).toHaveValue("123 Nguyễn Huệ, Hồ Chí Minh City");
  expect((await history(request)).filter(entry => entry.method === "PUT")).toHaveLength(1);
});

test("400 phone validation is attached to the phone input", async ({ page, request }) => {
  await signIn(page);
  await openProfile(page);
  await populatedForm(page);
  await control(request, { putStatus: 400 });
  await page.getByLabel("Full Name", { exact: true }).fill("Server rejects this update");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  const phone = page.getByLabel("Phone Number", { exact: true });
  await expect(phone).toHaveAttribute("aria-invalid", "true");
  const describedBy = await phone.getAttribute("aria-describedby");
  expect(describedBy).toBeTruthy();
  const describedText = await page.evaluate(ids => ids!.split(/\s+/).map(id => document.getElementById(id)?.textContent).join(" "), describedBy);
  expect(describedText).toContain("Phone number is invalid");
  await expect(page.locator("header").getByRole("link", { name: `Hi ${originalName}` })).toBeVisible();
});

test("blank name and future birth date are rejected before PUT", async ({ page, request }) => {
  await signIn(page);
  await openProfile(page);
  await populatedForm(page);
  await page.getByLabel("Full Name", { exact: true }).fill("   ");
  await page.getByLabel("Date of Birth", { exact: true }).fill("2999-01-01");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page.getByLabel("Full Name", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Full name is required", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Date of Birth", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Date of birth must not be in the future", { exact: true })).toBeVisible();
  expect((await history(request)).filter(entry => entry.method === "PUT")).toEqual([]);
});

test("delayed GET shows skeleton before fields populate", async ({ page, request }) => {
  await signIn(page);
  await control(request, { getDelayMs: 1500 });
  await openProfile(page);
  await expect(page.getByRole("status", { name: "Loading profile" })).toBeVisible();
  await populatedForm(page);
  await expect(page.getByRole("status", { name: "Loading profile" })).toHaveCount(0);
});

test("a persistently rejected PUT renews once, retries once and clears local authentication without saving", async ({ page, request }) => {
  await signIn(page);
  await openProfile(page);
  await populatedForm(page);
  const before = await keycloakEvidence(request);
  await control(request, { putStatus: 401 });
  await page.getByLabel("Full Name", { exact: true }).fill("Expired session");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in(?:\?|$)/);
  const puts = (await history(request)).filter(entry => entry.method === "PUT" && entry.path === "/v1/users/me");
  expect(puts).toHaveLength(2);
  expect(puts.every(entry => entry.authenticated)).toBe(true);
  expect(puts.map(entry => entry.body)).toEqual([
    { fullName: "Expired session" }, { fullName: "Expired session" },
  ]);
  expect(await keycloakEvidence(request)).toMatchObject({
    tokenRequests: before.tokenRequests + 1,
    refreshRequests: before.refreshRequests + 1,
    logouts: before.logouts,
  });
  expect(await (await request.get(`${fixtureUrl}/__test/user`)).json()).toMatchObject({
    fullName: originalName, email: "lan.nguyen@example.com", address: originalAddress,
  });
});

test("a session refresh the gateway cannot serve keeps the user signed in and the edits", async ({ page, request }) => {
  await signIn(page);
  await openProfile(page);
  await populatedForm(page);
  await control(request, { putStatus: 401, refreshStatus: 503 });
  await page.getByLabel("Full Name", { exact: true }).fill("Lan after the outage");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page.getByRole("form", { name: "Personal information", exact: true }).getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByLabel("Full Name", { exact: true })).toHaveValue("Lan after the outage");
  await expect(page.locator("header").getByRole("link", { name: `Hi ${originalName}` })).toBeVisible();
  await control(request, { putStatus: 0, refreshStatus: 0 });
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page.locator("header").getByRole("link", { name: "Hi Lan after the outage" })).toBeVisible();
});

test("GET failure shows a retry and recovers the real form", async ({ page, request }) => {
  await signIn(page);
  await control(request, { getStatus: 503 });
  await openProfile(page);
  await expect(page.getByRole("heading", { name: "Unable to load your profile", exact: true })).toBeVisible();
  await expect(page.getByLabel("Full Name", { exact: true })).toHaveCount(0);
  await control(request, { getStatus: 0 });
  await page.getByRole("button", { name: "Retry profile", exact: true }).click();
  await populatedForm(page);
});

test("failed PUT keeps edits and retries without changing the header early", async ({ page, request }) => {
  await signIn(page);
  await openProfile(page);
  await populatedForm(page);
  await control(request, { putStatus: 503 });
  await page.getByLabel("Full Name", { exact: true }).fill("Lan retry update");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page.getByRole("form", { name: "Personal information", exact: true }).getByRole("alert")).toContainText("Unable to update your profile.");
  await expect(page.getByLabel("Full Name", { exact: true })).toHaveValue("Lan retry update");
  await expect(page.locator("header").getByRole("link", { name: `Hi ${originalName}` })).toBeVisible();
  await control(request, { putStatus: 0 });
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page.locator("header").getByRole("link", { name: "Hi Lan retry update" })).toBeVisible();
});

test("token renewal preserves dirty profile fields without starting another profile read", async ({ page, request }) => {
  const start = Date.now();
  expect((await request.get(`${simulation}/keycloak/test/control`, { params: { ttl: "120" } })).ok()).toBe(true);
  await clockTime(request, start);
  await page.clock.install({ time: start });
  await signIn(page);
  await openProfile(page);
  await populatedForm(page);
  const pausedAt = await page.evaluate(() => Date.now() + 1_000);
  await page.clock.pauseAt(pausedAt);
  await clockTime(request, pausedAt);
  const before = await keycloakEvidence(request);
  const profileReads = (await history(request)).filter(entry => entry.method === "GET" && entry.path === "/v1/users/me").length;
  await page.getByLabel("Full Name", { exact: true }).fill("Unsaved name during renewal");
  await page.getByLabel("Address", { exact: true }).fill("Unsaved address during renewal");
  // If token rotation accidentally refetches /me, the failure would replace the
  // dirty form. A normal proactive refresh should leave that form untouched.
  await control(request, { getStatus: 503 });
  const renewed = page.waitForResponse(response =>
    new URL(response.url()).pathname === "/api/v1/auth/refresh" && response.request().method() === "POST");
  await clockTime(request, pausedAt + 60_000);
  await page.clock.runFor(60_000);
  const tokenResponse = await renewed;
  expect(tokenResponse.status()).toBe(200);
  await tokenResponse.finished();
  await expect.poll(async () => (await keycloakEvidence(request)).refreshRequests).toBe(before.refreshRequests + 1);
  await page.clock.runFor(250);
  await expect(page.getByLabel("Full Name", { exact: true })).toHaveValue("Unsaved name during renewal");
  await expect(page.getByLabel("Address", { exact: true })).toHaveValue("Unsaved address during renewal");
  await expect(page.getByRole("heading", { name: "Unable to load your profile", exact: true })).toHaveCount(0);
  await expect(page.locator("header").getByRole("link", { name: `Hi ${originalName}` })).toBeVisible();
  expect((await history(request)).filter(entry => entry.method === "GET" && entry.path === "/v1/users/me")).toHaveLength(profileReads);
  expect((await history(request)).filter(entry => entry.method === "PUT")).toEqual([]);

  await control(request, { getStatus: 0 });
  // The renewal assertions use a paused clock. Resume normal scheduling before
  // saving so TanStack's timer-based cache notifications can reach the form.
  await page.clock.resume();
  const saved = page.waitForResponse(response =>
    response.request().method() === "PUT" && new URL(response.url()).pathname === "/api/v1/users/me");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  expect((await saved).status()).toBe(200);
  await expect(page.locator("header").getByRole("link", { name: "Hi Unsaved name during renewal" })).toBeVisible();
  await expect(page.getByLabel("Full Name", { exact: true })).toHaveValue("Unsaved name during renewal");
  await expect(page.getByLabel("Address", { exact: true })).toHaveValue("Unsaved address during renewal");
  const puts = (await history(request)).filter(entry => entry.method === "PUT");
  expect(puts).toHaveLength(1);
  expect(puts[0].authenticated).toBe(true);
  expect(puts[0].body).toEqual({
    fullName: "Unsaved name during renewal", address: "Unsaved address during renewal",
  });
});

test("profile fits 375x812 without clipped text and has desktop and mobile screenshots", async ({ page }, info) => {
  await signIn(page);
  await openProfile(page);
  await populatedForm(page);
  for (const card of ["Reputation", "Personal Information", "Change Password", "Penalty History"]) {
    await expect(page.getByRole("heading", { name: card, exact: true })).toBeVisible();
  }
  await responsiveChecks(page);
  const screenshotStyle = "nextjs-portal { display: none !important; }";
  await page.screenshot({ path: info.outputPath("profile-mobile-375x812.png"), fullPage: true, style: screenshotStyle });
  await page.setViewportSize({ width: 1440, height: 1634 });
  await page.screenshot({ path: info.outputPath("profile-desktop-1440.png"), fullPage: true, style: screenshotStyle });
});

test("unavailable profile features show explicit samples without changing the account", async ({ page, request }) => {
  await signIn(page);
  await openProfile(page);
  await populatedForm(page);
  await page.getByRole("button", { name: "Show sample reputation", exact: true }).click();
  await expect(page.getByText("Sample · Trusted · 78", { exact: true })).toBeVisible();
  await expect(page.getByText("Sample preview only. These values do not describe your account. The reputation API is not available.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Show sample penalty", exact: true }).click();
  await expect(page.getByText("AUC-SAMPLE-118", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Update Password", exact: true })).toBeDisabled();
  await expect(page.getByLabel("Current Password", { exact: true })).toBeDisabled();
  await responsiveChecks(page);
  expect((await history(request)).filter((entry) => entry.method === "PUT")).toEqual([]);
});
