import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

const fixtureUrl = "http://127.0.0.1:3913/api";
const keycloakUrl = "http://127.0.0.1:3913/keycloak";
const originalName = "Nguyễn Thị Lan";
const originalAddress = "227 Nguyễn Văn Cừ, Ward 4, District 5, Ho Chi Minh City";

type RecordedRequest = { method: string; path: string; body: Record<string, unknown> | null; authenticated: boolean };

async function control(request: APIRequestContext, body: Record<string, unknown>) {
  expect((await request.post(`${fixtureUrl}/__test/control`, { data: body })).ok()).toBe(true);
}

async function history(request: APIRequestContext): Promise<RecordedRequest[]> {
  return (await request.get(`${fixtureUrl}/__test/requests`)).json();
}

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Keycloak sign in", exact: true })).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill("lan.nguyen@example.com");
  await page.getByLabel("Password", { exact: true }).fill("profile-password");
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
  expect((await request.get(`${keycloakUrl}/test/reset`)).ok()).toBe(true);
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
  await openProfile(page);
  await populatedForm(page);
  await expect.poll(async () => (await history(request)).filter(entry => entry.method === "GET" && entry.path === "/v1/users/me").length).toBeGreaterThanOrEqual(2);
  await expect(page.getByLabel("Phone Number", { exact: true })).toHaveAttribute("readonly", "");

  await page.getByLabel("Full Name", { exact: true }).fill("Lan Nguyễn Updated");
  await page.getByLabel("Email", { exact: true }).fill("lan.updated@example.com");
  await page.getByLabel("Address", { exact: true }).fill("123 Nguyễn Huệ, Hồ Chí Minh City");
  const saved = page.waitForResponse(response => response.request().method() === "PUT" && new URL(response.url()).pathname === "/api/v1/users/me");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  expect((await saved).status()).toBe(200);
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

test("an expired session during PUT returns to sign in", async ({ page, request }) => {
  await signIn(page);
  await openProfile(page);
  await populatedForm(page);
  await control(request, { putStatus: 401 });
  await page.getByLabel("Full Name", { exact: true }).fill("Expired session");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in(?:\?|$)/);
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
