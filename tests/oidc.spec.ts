import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { fillLocalityAddress, mockLocalities } from "./localityFixture";

const simulation = `http://127.0.0.1:${process.env.NEXUS_TEST_PROVIDER_PORT || process.env.NEXUS_OIDC_SIM_PORT || "3913"}`;
const app = process.env.NEXUS_OIDC_APP_ORIGIN || `http://127.0.0.1:${process.env.NEXUS_TEST_APP_PORT || "3103"}`;
const issuerPath = "/keycloak/realms/nexus/protocol/openid-connect/";
const sessionPaths = new Set(["/api/v1/auth/session", "/api/v1/auth/refresh"]);

async function sessionCookie(page: Page) {
  // cookies(url) filters by path, so ask for a URL under the cookie's /api/v1/auth path.
  return (await page.context().cookies(`${simulation}/api/v1/auth/refresh`)).find((cookie) => cookie.name === "nexus_rt");
}

async function evidence(request: APIRequestContext, member: "api" | "keycloak") {
  const response = await request.get(`${simulation}/${member}/test/evidence`);
  expect(response.ok()).toBe(true);
  return response.json();
}

async function beginSignIn(page: Page, returnTo = "/") {
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  // Credentials are entered exclusively into the provider's page.
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${issuerPath}auth\\?`));
  const authorization = new URL(page.url());
  expect(authorization.searchParams.get("client_id")).toBe("nexus-web");
  expect(authorization.searchParams.get("response_type")).toBe("code");
  expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
  expect(authorization.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(authorization.searchParams.get("redirect_uri")).toBe(`${app}/auth/callback`);
}

async function submitProvider(page: Page) {
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("buyer@nexus.local");
  await page.getByLabel("Password", { exact: true }).fill("Fixture-pass-123!");
  await page.getByRole("button", { name: "Sign in at Keycloak", exact: true }).click();
}

async function assertNoPersistedTokens(page: Page) {
  const stored = await page.evaluate(() => [
    ...Object.entries(localStorage), ...Object.entries(sessionStorage),
  ].map(([key, value]) => `${key}:${value}`).join("\n"));
  expect(stored).not.toContain("access_token");
  expect(stored).not.toContain("id_token");
  expect(stored).not.toMatch(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\./);
}

test.beforeEach(async ({ request, page }) => {
  expect((await request.get(`${simulation}/keycloak/test/reset`)).ok()).toBe(true);
  expect((await request.get(`${simulation}/api/test/reset`)).ok()).toBe(true);
  const issuedTokens = new Set<string>();
  // The gateway exchanges the code and refreshes; the browser only ever sees its envelope.
  page.on("response", async (response) => {
    // 204 is an anonymous refresh with no body.
    if (sessionPaths.has(new URL(response.url()).pathname) && response.status() === 200) {
      const body = await response.json();
      issuedTokens.add(body.data.accessToken);
    }
  });
  // Cart uses a blank service origin, so isolate the header's same-origin GET.
  await page.route("**/api/v1/carts/me", async (route) => {
    expect(route.request().method()).toBe("GET");
    const authorization = route.request().headers().authorization;
    expect(authorization).toMatch(/^Bearer .+$/);
    await expect.poll(() => issuedTokens.has(authorization.slice("Bearer ".length))).toBe(true);
    return route.fulfill({
      json: { code: 0, message: "response success", data: {
        id: "oidc-header-cart",
        userId: "68000000-0000-4000-8000-000000000003",
        status: "ACTIVE",
        items: [],
      } },
    });
  });
});

test("code + PKCE accepts the backend 200 profile envelope, returns to the requested page and ends the provider session", async ({ page, request }, info) => {
  const ownApiPosts: { path: string; body: string }[] = [];
  page.on("request", (req) => {
    if (req.url().startsWith(`${simulation}/api/`) && req.method() === "POST")
      ownApiPosts.push({ path: new URL(req.url()).pathname, body: req.postData() || "" });
  });
  await beginSignIn(page, "/?source=oidc#daily-deals");
  const profileResponse = page.waitForResponse((response) => response.url() === `${simulation}/api/v1/users/me` && response.request().method() === "GET");
  await submitProvider(page);
  const profile = await profileResponse;
  expect(profile.status()).toBe(200);
  expect(await profile.json()).toMatchObject({ code: 0, message: "response success", data: { fullName: "Fixture Buyer", roles: ["BUYER"] } });
  await expect(page).toHaveURL(`${app}/?source=oidc#daily-deals`);
  await expect(page.getByText("Hi Fixture Buyer", { exact: true })).toBeVisible();
  await assertNoPersistedTokens(page);
  await page.screenshot({ path: info.outputPath("signed-in.png"), fullPage: true });

  expect(await evidence(request, "keycloak")).toMatchObject({ passwordSubmissions: 1, codeExchanges: 1, pkceVerified: 1, sessions: 1 });
  expect(await evidence(request, "api")).toMatchObject({
    meRequests: 1, bearerRequests: 1, loginRequests: 0, passwordLeaks: 0, sessionExchanges: 1, csrfRejected: 0, cookieLeaks: 0,
  });
  // The only POSTs are the gateway session calls, and none carries a password.
  expect(ownApiPosts.map((post) => post.path)).toContain("/api/v1/auth/session");
  for (const post of ownApiPosts) {
    expect(["/api/v1/auth/session", "/api/v1/auth/refresh"]).toContain(post.path);
    expect(post.body).not.toMatch(/password/i);
  }
  expect(await sessionCookie(page)).toMatchObject({ httpOnly: true, path: "/api/v1/auth", sameSite: "Lax" });

  await page.locator("header summary", { hasText: /^Hi / }).click();

  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect.poll(async () => (await evidence(request, "keycloak")).logouts).toBe(1);
  await expect(page).toHaveURL(new RegExp(`^${app}/`));
  await expect(page.getByText("Hi Fixture Buyer", { exact: true })).toHaveCount(0);
  expect(await evidence(request, "keycloak")).toMatchObject({ sessions: 0, revocations: 1 });
  expect(await evidence(request, "api")).toMatchObject({ sessionLogouts: 1 });
  expect(await sessionCookie(page)).toBeUndefined();
  await page.reload();
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toHaveCount(0);
  await assertNoPersistedTokens(page);
  expect(await evidence(request, "api")).toMatchObject({ meRequests: 1, passwordLeaks: 0 });
  expect(await evidence(request, "keycloak")).toMatchObject({ refreshRequests: 0 });
  await beginSignIn(page);
  await expect(page.getByRole("heading", { name: "Keycloak sign in" })).toBeVisible();
});

for (const mode of ["bad-state", "denied", "token-error"] as const) {
  test(`rejects ${mode} without loading a profile or persisting a session`, async ({ page, request }) => {
    await request.get(`${simulation}/keycloak/test/reset?mode=${mode}`);
    await beginSignIn(page);
    await submitProvider(page);
    await expect(page).toHaveURL(new RegExp(`^${app}/auth/callback`));
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await assertNoPersistedTokens(page);
    expect(await evidence(request, "api")).toMatchObject({ meRequests: 0, loginRequests: 0, passwordLeaks: 0 });
    expect(await evidence(request, "keycloak")).toMatchObject({ codeExchanges: mode === "token-error" ? 1 : 0 });
  });
}

test("rejects unsolicited callbacks before token exchange", async ({ page, request }) => {
  await page.goto("/auth/callback?code=unsolicited&state=missing");
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  expect(await evidence(request, "keycloak")).toMatchObject({ codeExchanges: 0 });
  expect(await evidence(request, "api")).toMatchObject({ meRequests: 0 });
});

test("a reload restores the session from the HttpOnly cookie, rotates it and refuses the old one", async ({ page, request }) => {
  await beginSignIn(page, "/?source=reload");
  await submitProvider(page);
  await expect(page.getByText("Hi Fixture Buyer", { exact: true })).toBeVisible();
  const first = await sessionCookie(page);
  expect(first).toMatchObject({ httpOnly: true, path: "/api/v1/auth" });

  await page.reload();
  await expect(page.getByText("Hi Fixture Buyer", { exact: true })).toBeVisible();
  await assertNoPersistedTokens(page);
  const second = await sessionCookie(page);
  expect(second?.value).toBeTruthy();
  expect(second?.value).not.toBe(first?.value);
  expect(await evidence(request, "keycloak")).toMatchObject({ codeExchanges: 1, refreshRequests: 1, refreshRejected: 0 });
  expect(await evidence(request, "api")).toMatchObject({ meRequests: 2, bearerRequests: 2, sessionRefreshes: 1, cookieLeaks: 0 });

  // A copied refresh token works once at most: the rotated-out value is refused and its cookie cleared.
  const replay = await request.post(`${simulation}/api/v1/auth/refresh`, {
    headers: { Cookie: `nexus_rt=${first?.value}`, "X-Requested-With": "nexus-web", Origin: app },
  });
  expect(replay.status()).toBe(401);
  expect(replay.headers()["set-cookie"]).toContain("Max-Age=0");
  expect(await evidence(request, "keycloak")).toMatchObject({ refreshRequests: 2, refreshRejected: 1 });

  // Without the CSRF header the gateway refuses before touching Keycloak.
  const forged = await request.post(`${simulation}/api/v1/auth/refresh`, {
    headers: { Cookie: `nexus_rt=${second?.value}`, Origin: app },
  });
  expect(forged.status()).toBe(403);
  expect(await evidence(request, "keycloak")).toMatchObject({ refreshRequests: 2, refreshRejected: 1 });
});

test("ignores external return destinations", async ({ page, request }) => {
  await beginSignIn(page, "https://outside.example/account");
  await submitProvider(page);
  await expect(page).toHaveURL(`${app}/`);
  await expect(page.getByText("Hi Fixture Buyer", { exact: true })).toBeVisible();
  expect(await evidence(request, "api")).toMatchObject({ bearerRequests: 1 });
});

test("retries a temporary profile failure without exchanging the code again", async ({ page, request }) => {
  await request.get(`${simulation}/api/test/reset?mode=profile-503-once`);
  await beginSignIn(page, "/?source=profile-retry");
  await submitProvider(page);
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(`${app}/auth/callback`);
  await assertNoPersistedTokens(page);
  await expect(page.getByRole("button", { name: "Retry loading account", exact: true })).toBeVisible();
  expect(await evidence(request, "api")).toMatchObject({ meRequests: 1, bearerRequests: 1 });
  await page.getByRole("button", { name: "Retry loading account", exact: true }).click();
  await expect(page).toHaveURL(`${app}/?source=profile-retry`);
  await expect(page.getByText("Hi Fixture Buyer", { exact: true })).toBeVisible();
  expect(await evidence(request, "api")).toMatchObject({ meRequests: 2, bearerRequests: 2 });
  expect(await evidence(request, "keycloak")).toMatchObject({ codeExchanges: 1, pkceVerified: 1, logouts: 0 });
});

for (const mode of ["profile-missing-data-once", "profile-invalid-user-once"] as const) {
  test(`rejects ${mode} then retries profile parsing without another code exchange`, async ({ page, request }) => {
    await request.get(`${simulation}/api/test/reset?mode=${mode}`);
    await beginSignIn(page, "/?source=profile-contract-retry");
    await submitProvider(page);
    await expect(page).toHaveURL(`${app}/auth/callback`);
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    await expect(page.getByText("Hi Fixture Buyer", { exact: true })).toHaveCount(0);
    expect(await evidence(request, "api")).toMatchObject({ meRequests: 1, bearerRequests: 1 });
    await assertNoPersistedTokens(page);
    await page.getByRole("button", { name: "Retry loading account", exact: true }).click();
    await expect(page).toHaveURL(`${app}/?source=profile-contract-retry`);
    await expect(page.getByText("Hi Fixture Buyer", { exact: true })).toBeVisible();
    expect(await evidence(request, "api")).toMatchObject({ meRequests: 2, bearerRequests: 2 });
    expect(await evidence(request, "keycloak")).toMatchObject({ codeExchanges: 1, pkceVerified: 1 });
  });
}

test("a persistently rejected profile is renewed and retried once before clearing local authentication", async ({ page, request }) => {
  await request.get(`${simulation}/api/test/reset?mode=profile-401`);
  await beginSignIn(page);
  await submitProvider(page);
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry loading account", exact: true })).toHaveCount(0);
  await assertNoPersistedTokens(page);
  // The first 401 renews once through the cookie and replays the request once; the second 401 ends the session.
  expect(await evidence(request, "api")).toMatchObject({ meRequests: 2, bearerRequests: 2, sessionRefreshes: 1 });
  expect(await evidence(request, "keycloak")).toMatchObject({ codeExchanges: 1, refreshRequests: 1, logouts: 0 });
  // The cookie is still valid at Keycloak, so each page load restores, renews once more on the 401 and then
  // stays signed out. No retry loop within a page load.
  await page.goto("/");
  await expect.poll(async () => (await evidence(request, "api")).meRequests).toBe(4);
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toHaveCount(0);
  await page.reload();
  await expect.poll(async () => (await evidence(request, "api")).meRequests).toBe(6);
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  expect(await evidence(request, "keycloak")).toMatchObject({ refreshRequests: 5, logouts: 0 });
});

test("develop registration accepts the backend 201 user envelope and continues to sign in", async ({ page, request }) => {
  await mockLocalities(page);
  await page.goto("/sign-up");
  await page.getByLabel("Full Name", { exact: true }).fill("New Buyer");
  await page.getByLabel("Email", { exact: true }).fill("new-buyer@nexus.local");
  await page.getByLabel("Phone Number", { exact: true }).fill("0901234567");
  await page.getByLabel("Identity Number", { exact: true }).fill("079203004512");
  await page.getByRole("combobox", { name: "Gender", exact: true }).selectOption("OTHER");
  await page.getByLabel("Date of Birth", { exact: true }).fill("2000-01-01");
  await fillLocalityAddress(page, "12 Nguyen Hue");
  await page.getByLabel("Password", { exact: true }).fill("Fixture-pass-123!");
  await page.getByLabel("Confirm Password", { exact: true }).fill("Fixture-pass-123!");
  await page.getByRole("checkbox").check();
  const registrationResponse = page.waitForResponse((response) => response.url() === `${simulation}/api/v1/auth/register` && response.request().method() === "POST");
  await page.getByRole("button", { name: "Create Account", exact: true }).click();
  const registration = await registrationResponse;
  expect(registration.status()).toBe(201);
  expect(await registration.json()).toMatchObject({ code: 0, message: "response success", data: { email: "new-buyer@nexus.local", fullName: "New Buyer" } });
  await expect(page).toHaveURL(`${app}/sign-in`);
  await expect(page.getByRole("button", { name: "Continue to sign in", exact: true })).toBeVisible();
  expect(await evidence(request, "api")).toMatchObject({ registrations: 1, loginRequests: 0, meRequests: 0, passwordLeaks: 0 });
  expect(await evidence(request, "keycloak")).toMatchObject({ authorizations: 0, codeExchanges: 0 });
});

test("switching account extensions off hides their operations and leaves a sign-in path", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (/\/phone\/verification|\/verification-email|\/users\/me\/addresses|\/sellers\/applications/.test(request.url())) requests.push(request.url());
  });
  await page.goto("/check-email?email=buyer%40nexus.local");
  await expect(page.getByRole("link", { name: "Continue to sign in", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Resend/ })).toHaveCount(0);
  await beginSignIn(page, "/profile");
  await submitProvider(page);
  await expect(page).toHaveURL(`${app}/profile`);
  await expect(page.getByRole("heading", { name: "Personal Information", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send verification code", exact: true })).toHaveCount(0);
  await page.goto("/addresses");
  await expect(page.getByText("Saved addresses are not available yet.", { exact: false })).toBeVisible();
  await expect(page.locator("header summary", { hasText: "Hi Fixture Buyer" })).toBeVisible();
  await page.goto("/become-a-seller");
  await expect(page.locator("header summary", { hasText: "Hi Fixture Buyer" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit application", exact: true })).toHaveCount(0);
  expect(requests).toEqual([]);
});
