import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { fillLocalityAddress, fixtureAddress, mockLocalities } from "./localityFixture";

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
  await expect(page.locator("header summary", { hasText: `Hi ${originalName}` })).toBeVisible();
}

async function openProfile(page: Page) {
  await page.locator("header summary", { hasText: `Hi ${originalName}` }).click();
  await page.locator("header").getByRole("link", { name: "My profile", exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
}

async function populatedForm(page: Page) {
  await expect(page.getByLabel("Full Name", { exact: true })).toHaveValue(originalName);
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("lan.nguyen@example.com");
  await expect(page.getByLabel("Phone Number", { exact: true })).toHaveValue("+84912345678");
  await expect(page.locator("#profile-address-current")).toHaveText(`Current: ${originalAddress}`);
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

test.beforeEach(async ({ page, request }) => {
  await mockLocalities(page);
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
  await fillLocalityAddress(page, "123 Nguyễn Huệ");
  const saved = page.waitForResponse(response => response.request().method() === "PUT" && new URL(response.url()).pathname === "/api/v1/users/me");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  const savedResponse = await saved;
  expect(savedResponse.status()).toBe(200);
  expect(await savedResponse.json()).toMatchObject({
    code: 0, message: "response success", data: { fullName: "Lan Nguyễn Updated" },
  });
  await expect(page.getByLabel("Full Name", { exact: true })).toHaveValue("Lan Nguyễn Updated");
  await expect(page.locator("header summary", { hasText: "Hi Lan Nguyễn Updated" })).toBeVisible();
  const puts = (await history(request)).filter(entry => entry.method === "PUT" && entry.path === "/v1/users/me");
  expect(puts).toHaveLength(1);
  expect(puts[0].authenticated).toBe(true);
  expect(puts[0].body).toEqual({
    fullName: "Lan Nguyễn Updated",
    email: "lan.updated@example.com",
    address: fixtureAddress("123 Nguyễn Huệ"),
  });

  await page.getByLabel("Full Name", { exact: true }).fill("Unsaved name");
  await fillLocalityAddress(page, "Unsaved street");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Full Name", { exact: true })).toHaveValue("Lan Nguyễn Updated");
  await expect(page.locator("#profile-address-current")).toHaveText(`Current: ${fixtureAddress("123 Nguyễn Huệ")}`);
  await expect(page.getByLabel("House number and street", { exact: true })).toHaveValue("");
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
  await expect(page.locator("header summary", { hasText: `Hi ${originalName}` })).toBeVisible();
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
  await expect(page.locator("header summary", { hasText: `Hi ${originalName}` })).toBeVisible();
  await control(request, { putStatus: 0, refreshStatus: 0 });
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page.locator("header summary", { hasText: "Hi Lan after the outage" })).toBeVisible();
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
  await expect(page.locator("header summary", { hasText: `Hi ${originalName}` })).toBeVisible();
  await control(request, { putStatus: 0 });
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page.locator("header summary", { hasText: "Hi Lan retry update" })).toBeVisible();
});

test("token renewal preserves dirty profile fields without starting another profile read", async ({ page, request }) => {
  const start = Date.now();
  expect((await request.get(`${simulation}/keycloak/test/control`, { params: { ttl: "120" } })).ok()).toBe(true);
  await clockTime(request, start);
  await page.clock.install({ time: start });
  await signIn(page);
  await openProfile(page);
  await populatedForm(page);
  await fillLocalityAddress(page, "Unsaved street during renewal");
  const pausedAt = await page.evaluate(() => Date.now() + 1_000);
  await page.clock.pauseAt(pausedAt);
  await clockTime(request, pausedAt);
  const before = await keycloakEvidence(request);
  const profileReads = (await history(request)).filter(entry => entry.method === "GET" && entry.path === "/v1/users/me").length;
  await page.getByLabel("Full Name", { exact: true }).fill("Unsaved name during renewal");
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
  await expect(page.getByLabel("House number and street", { exact: true })).toHaveValue("Unsaved street during renewal");
  await expect(page.getByRole("heading", { name: "Unable to load your profile", exact: true })).toHaveCount(0);
  await expect(page.locator("header summary", { hasText: `Hi ${originalName}` })).toBeVisible();
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
  await expect(page.locator("header summary", { hasText: "Hi Unsaved name during renewal" })).toBeVisible();
  await expect(page.getByLabel("Full Name", { exact: true })).toHaveValue("Unsaved name during renewal");
  await expect(page.locator("#profile-address-current")).toHaveText(`Current: ${fixtureAddress("Unsaved street during renewal")}`);
  const puts = (await history(request)).filter(entry => entry.method === "PUT");
  expect(puts).toHaveLength(1);
  expect(puts[0].authenticated).toBe(true);
  expect(puts[0].body).toEqual({
    fullName: "Unsaved name during renewal", address: fixtureAddress("Unsaved street during renewal"),
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

test("profile password action opens Keycloak credential settings with a safe profile referrer", async ({ page }) => {
  await signIn(page);
  await openProfile(page);
  await populatedForm(page);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  const profileOrigin = new URL(page.url()).origin;
  // The fixture only acknowledges navigation. Keycloak's actual forms, reset
  // tokens and email delivery require the documented live acceptance checks.
  await page.route("**/realms/nexus/account/**", (route) => route.fulfill({
    contentType: "text/html",
    body: "<!doctype html><html><body><h1>Account console fixture</h1></body></html>",
  }));
  const accountRequest = page.waitForRequest((request) => new URL(request.url()).pathname.endsWith("/realms/nexus/account/"));
  await page.getByRole("button", { name: "Change password", exact: true }).click();
  const destination = new URL((await accountRequest).url());
  expect(destination.origin).toBe(simulation);
  expect(destination.pathname).toBe("/keycloak/realms/nexus/account/");
  expect([...destination.searchParams]).toEqual([
    ["referrer", "nexus-web"],
    ["referrer_uri", `${profileOrigin}/profile`],
  ]);
  await expect(page).toHaveURL(/#\/account-security\/signing-in$/);
});

const resetToken = "Rk9yZ290LXBhc3N3b3JkLWZpeHR1cmUtdG9rZW4tMDE";

test("sign-in links to forgot password, which sends one public request and never reveals the account", async ({ page, request }) => {
  await page.goto("/sign-in");
  await page.getByRole("link", { name: "Forgot password?", exact: true }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page.getByRole("heading", { name: "Forgot your password?", exact: true })).toBeVisible();
  await page.getByLabel("Email address", { exact: true }).fill("  lan.nguyen@example.com ");
  await page.getByRole("button", { name: "Send reset link", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("If an account uses this email, we have sent a reset link. Check your inbox and spam folder.");
  await expect(page.getByRole("button", { name: /^Send again in \d+s$/ })).toBeDisabled();
  await responsiveChecks(page);
  const sent = (await history(request)).filter((entry) => entry.path === "/v1/auth/password-reset");
  expect(sent).toEqual([{ method: "POST", path: "/v1/auth/password-reset", body: { email: "lan.nguyen@example.com" }, authenticated: false }]);
});

test("the reset page checks the passwords, explains a reused one, saves once and then treats the link as used", async ({ page, request }) => {
  await page.goto(`/reset-password?token=${resetToken}`);
  await expect(page.getByRole("heading", { name: "Choose a new password", exact: true })).toBeVisible();
  const password = page.getByLabel("New password", { exact: true });
  const confirmation = page.getByLabel("Confirm new password", { exact: true });
  const save = page.getByRole("button", { name: "Set new password", exact: true });

  await password.fill("short");
  await confirmation.fill("short");
  await save.click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("Use at least 8 characters.");
  await password.fill("Another-pass-456!");
  await confirmation.fill("Another-pass-457!");
  await save.click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("The passwords do not match.");
  expect((await history(request)).filter((entry) => entry.path.startsWith("/v1/auth/password-reset"))).toEqual([]);

  await password.fill("Fixture-pass-123!");
  await confirmation.fill("Fixture-pass-123!");
  await save.click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("Choose a password that is different from your current one.");
  await expect(password).toHaveValue("Fixture-pass-123!");

  await password.fill("Another-pass-456!");
  await confirmation.fill("Another-pass-456!");
  await save.click();
  await expect(page.getByRole("heading", { name: "Password updated", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue to sign in", exact: true })).toHaveAttribute("href", "/sign-in");
  await responsiveChecks(page);
  const confirms = (await history(request)).filter((entry) => entry.path === "/v1/auth/password-reset/confirm");
  expect(confirms.map((entry) => [entry.body, entry.authenticated])).toEqual([
    [{ token: resetToken, newPassword: "Fixture-pass-123!" }, false],
    [{ token: resetToken, newPassword: "Another-pass-456!" }, false],
  ]);

  await page.goto(`/reset-password?token=${resetToken}`);
  await page.getByLabel("New password", { exact: true }).fill("Third-pass-789!");
  await page.getByLabel("Confirm new password", { exact: true }).fill("Third-pass-789!");
  await page.getByRole("button", { name: "Set new password", exact: true }).click();
  await expect(page.getByRole("heading", { name: "This link no longer works", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Request a new link", exact: true }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
});

test("a malformed reset link asks for a new one without calling the API", async ({ page, request }) => {
  await page.goto("/reset-password?token=not-a-token");
  await expect(page.getByRole("heading", { name: "This link no longer works", exact: true })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  expect((await history(request)).filter((entry) => entry.path.startsWith("/v1/auth/password-reset"))).toEqual([]);
});

const pngAvatar = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGO4Ga8DAAN5AWVLTgzuAAAAAElFTkSuQmCC", "base64");

test("reputation shows the own score and penalty history pages through every score loss", async ({ page, request }) => {
  await signIn(page);
  await openProfile(page);
  const reputation = page.locator("#reputation");
  await expect(reputation.getByLabel("Reputation score 62 out of 100")).toBeVisible();
  await expect(reputation.getByText("Trusted", { exact: true })).toBeVisible();
  await expect(reputation.getByRole("meter", { name: "Reputation score" })).toHaveAttribute("aria-valuenow", "62");
  for (const [label, value] of [["Transactions", "9"], ["Successful", "7"], ["Failed", "1"], ["Auctions won", "2"], ["Avg rating", "4.3"]]) {
    await expect(reputation.locator("dl > div", { has: page.getByText(label, { exact: true }) }).locator("dd")).toHaveText(value);
  }
  await expect(reputation.getByText("12 entries lowered your score.")).toBeVisible();
  const penaltyCard = page.locator("#penalty-history");
  const items = penaltyCard.getByRole("list", { name: "Penalty history" }).getByRole("listitem");
  await expect(items).toHaveCount(10);
  await expect(items.first()).toContainText("Unpaid auction");
  await expect(items.first()).toContainText("-2 (64 → 62)");
  await expect(items.first()).toContainText("Auction 5B1C2D3E");
  await expect(items.nth(2)).toContainText("Admin deduction");
  await expect(penaltyCard.getByText("Page 1 of 2")).toBeVisible();
  await expect(penaltyCard.getByRole("button", { name: "Previous" })).toBeDisabled();
  await penaltyCard.getByRole("button", { name: "Next" }).click();
  await expect(penaltyCard.getByText("Page 2 of 2")).toBeVisible();
  await expect(items).toHaveCount(2);
  await expect(penaltyCard.getByRole("button", { name: "Next" })).toBeDisabled();
  const reads = (await history(request)).filter(entry => entry.path.startsWith("/v1/users/me/"));
  expect(reads.every(entry => entry.authenticated && entry.method === "GET")).toBe(true);
  await responsiveChecks(page);
});

test("a reputation read failure keeps the profile usable and retries, and no penalties shows an empty state", async ({ page, request }) => {
  await control(request, { reputationStatus: 403, noPenalties: true });
  await signIn(page);
  await openProfile(page);
  await populatedForm(page);
  const reputation = page.locator("#reputation");
  await expect(reputation.getByRole("alert")).toContainText("Unable to load your reputation.");
  await expect(page.locator("#penalty-history").getByRole("status")).toHaveText("No penalties. Your score has never been lowered.");
  await control(request, { reputationStatus: 0 });
  await reputation.getByRole("button", { name: "Retry reputation" }).click();
  await expect(reputation.getByLabel("Reputation score 62 out of 100")).toBeVisible();
});

test("avatar upload checks the file, posts multipart and shows the stored photo", async ({ page, request }) => {
  await signIn(page);
  await openProfile(page);
  await populatedForm(page);
  const card = page.getByRole("complementary", { name: "Your account" });
  await expect(card.getByRole("button", { name: "Upload photo" })).toBeEnabled();
  await page.setInputFiles("#avatar-file", { name: "me.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") });
  await expect(card.getByRole("alert")).toHaveText("Use a JPEG, PNG or WebP image.");
  expect((await history(request)).filter(entry => entry.path === "/v1/users/me/avatar")).toEqual([]);
  await control(request, { avatarStatus: 503 });
  await page.setInputFiles("#avatar-file", { name: "me.png", mimeType: "image/png", buffer: pngAvatar });
  await expect(card.getByRole("alert")).toHaveText("Photo storage is unavailable right now. Please try again later.");
  await control(request, { avatarStatus: 0 });
  await page.setInputFiles("#avatar-file", { name: "me.png", mimeType: "image/png", buffer: pngAvatar });
  await expect(card.getByRole("status")).toHaveText("Your photo has been updated.");
  await expect(card.locator('[data-slot="avatar-image"]')).toHaveAttribute("src", /\/api\/test\/avatar\/1$/);
  await expect(card.getByRole("button", { name: "Change photo" })).toBeVisible();
  const posts = (await history(request)).filter(entry => entry.path === "/v1/users/me/avatar");
  expect(posts.map(entry => [entry.method, entry.authenticated, entry.body])).toEqual([
    ["POST", true, { multipart: true }], ["POST", true, { multipart: true }],
  ]);
  await page.reload();
  await expect(card.locator('[data-slot="avatar-image"]')).toHaveAttribute("src", /\/api\/test\/avatar\/1$/);
  const header = page.locator("header summary", { hasText: "Hi " });
  await expect(header.locator('[data-slot="avatar-image"]')).toHaveAttribute("src", /\/api\/test\/avatar\/1$/);
  await card.getByRole("button", { name: "Remove photo" }).click();
  await expect(card.getByRole("status")).toHaveText("Your photo has been removed.");
  await expect(card.locator('[data-slot="avatar-image"]')).toHaveCount(0);
  await expect(header.locator('[data-slot="avatar-image"]')).toHaveCount(0);
  await expect(header.locator('[data-slot="avatar-fallback"]')).toBeVisible();
  await expect(card.getByRole("button", { name: "Upload photo" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Remove photo" })).toHaveCount(0);
  expect((await history(request)).filter(entry => entry.path === "/v1/users/me/avatar").map(entry => [entry.method, entry.authenticated]))
    .toEqual([["POST", true], ["POST", true], ["DELETE", true]]);
  await page.reload();
  await expect(card.locator('[data-slot="avatar-image"]')).toHaveCount(0);
});
