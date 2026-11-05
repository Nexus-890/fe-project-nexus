import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

// These scenarios exercise the real frontend against the proposed guest/merge
// contract in the local HTTP fixture. They do not establish backend readiness.
const simulation = `http://127.0.0.1:${process.env.NEXUS_TEST_PROVIDER_PORT ?? 3913}`;
const app = `http://127.0.0.1:${process.env.NEXUS_TEST_APP_PORT ?? 3103}`;
const productPath = "/products/fixture-tablet-00000004-1111-4111-8111-111111111111";
const storageKey = "nexus.cart.guest";

async function evidence(request: APIRequestContext, member: "api" | "keycloak" = "api") {
  const response = await request.get(`${simulation}/${member}/test/evidence`);
  expect(response.ok()).toBe(true);
  return response.json();
}

function badge(page: Page, quantity: number) {
  return page.getByRole("link", { name: `Shopping cart, ${quantity} items`, exact: true });
}

async function guestSession(page: Page): Promise<{ token: string; mergeKey: string } | null> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "null"), storageKey);
}

async function addGuest(page: Page, quantity = 2) {
  await page.goto(productPath);
  await expect(page.getByRole("heading", { name: "Guest cart fixture tablet", exact: true })).toBeVisible();
  await page.getByRole("spinbutton", { name: "Quantity", exact: true }).fill(String(quantity));
  await page.getByRole("button", { name: "Add to Cart", exact: true }).click();
  await expect(page.getByText("Added to cart.", { exact: true })).toBeVisible();
  await expect(badge(page, quantity)).toBeVisible();
  const session = await guestSession(page);
  expect(session?.token).toBeTruthy();
  expect(session?.mergeKey).toBeTruthy();
  return session!;
}

async function signIn(page: Page, atProvider?: () => Promise<void>) {
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${app}/sign-in\\?returnTo=`));
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Keycloak sign in", exact: true })).toBeVisible();
  await atProvider?.();
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("buyer@nexus.local");
  await page.getByLabel("Password", { exact: true }).fill("Fixture-pass-123!");
  await page.getByRole("button", { name: "Sign in at Keycloak", exact: true }).click();
  await expect(page).toHaveURL(`${app}${productPath}`);
  await expect(page.getByText("Hi Fixture Buyer", { exact: true })).toBeVisible();
}

async function assertOnlyGuestSessionPersisted(page: Page) {
  const storage = await page.evaluate(() => [
    ...Object.entries(localStorage), ...Object.entries(sessionStorage),
  ].map(([key, value]) => `${key}:${value}`).join("\n"));
  expect(storage).not.toContain("access_token");
  expect(storage).not.toContain("id_token");
  expect(storage).not.toMatch(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\./);
}

test.beforeEach(async ({ request, page }) => {
  expect((await request.get(`${simulation}/keycloak/test/reset`)).ok()).toBe(true);
  expect((await request.get(`${simulation}/api/test/reset`)).ok()).toBe(true);
  // The cart service keeps its configured same-origin default. Forward its
  // requests over HTTP to the existing dependency simulation for this suite.
  await page.route(`${app}/api/v1/carts/**`, async (route) => {
    const response = await route.fetch({ url: `${simulation}${new URL(route.request().url()).pathname}` });
    await route.fulfill({ response });
  });
});

test("signed-out additions create one guest cart and restore its quantity after a reload", async ({ page, request }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const session = await addGuest(page);
  expect(await evidence(request)).toMatchObject({
    guestCreations: 1, guestAdds: 1, guestBearerLeaks: 0, mergeRequests: 0, cartAdds: 0,
  });
  await page.reload();
  await expect(badge(page, 2)).toBeVisible();
  expect(await guestSession(page)).toEqual(session);
  // Count quantities across additions, rather than the number of distinct SKUs.
  await page.getByRole("button", { name: "Add to Cart", exact: true }).click();
  await expect(badge(page, 3)).toBeVisible();
  expect(await evidence(request)).toMatchObject({ guestCreations: 1, guestAdds: 2, guestBearerLeaks: 0 });
  await assertOnlyGuestSessionPersisted(page);
});

test("Keycloak callback merges once before returning, shows the merged quantity and clears the guest token", async ({ page, request }) => {
  const session = await addGuest(page);
  const mergeAt: string[] = [];
  const mergedTokens: string[] = [];
  page.on("request", (req) => {
    if (new URL(req.url()).pathname === "/api/v1/carts/me/merge" && req.method() === "POST") {
      mergeAt.push(new URL(page.url()).pathname);
      mergedTokens.push(req.headers()["x-guest-token"]);
    }
  });
  await signIn(page, async () => {
    // Observe the shop's storage while its document is unloaded at Keycloak.
    // Routing a redirected callback cannot observe this: Playwright invokes
    // route handlers only for the initial URL in an HTTP redirect chain.
    const saved = (await page.context().storageState()).origins.find((origin) => origin.origin === app)
      ?.localStorage.find((entry) => entry.name === storageKey)?.value;
    expect(saved && JSON.parse(saved)).toEqual(session);
  });
  await expect(badge(page, 5)).toBeVisible();
  expect(mergeAt).toEqual(["/auth/callback"]);
  expect(mergedTokens).toEqual([session.token]);
  expect(await guestSession(page)).toBeNull();
  expect(await evidence(request)).toMatchObject({
    guestCreations: 1, guestAdds: 1, mergeRequests: 1, mergesApplied: 1,
    buyerQuantity: 5, mergeKeys: [session.mergeKey], passwordLeaks: 0, guestBearerLeaks: 0,
  });
  expect(await evidence(request, "keycloak")).toMatchObject({ tokenRequests: 1, pkceVerified: 1 });
  await assertOnlyGuestSessionPersisted(page);

  // Client navigation keeps the same session and must not submit another merge.
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(`${app}/`);
  await expect(badge(page, 5)).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(`${app}${productPath}`);
  await expect(badge(page, 5)).toBeVisible();
  expect(await evidence(request)).toMatchObject({ mergeRequests: 1, mergesApplied: 1 });

  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  await expect(badge(page, 0)).toBeVisible();
  await page.reload();
  await expect(badge(page, 0)).toBeVisible();
  expect(await guestSession(page)).toBeNull();
  expect(await evidence(request)).toMatchObject({ mergeRequests: 1, mergesApplied: 1, buyerQuantity: 5 });
});

test("a temporary profile failure keeps guest items until account retry then merges once", async ({ page, request }) => {
  await request.get(`${simulation}/api/test/reset?mode=profile-503-once`);
  const session = await addGuest(page);
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Keycloak sign in", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("buyer@nexus.local");
  await page.getByLabel("Password", { exact: true }).fill("Fixture-pass-123!");
  await page.getByRole("button", { name: "Sign in at Keycloak", exact: true }).click();
  await expect(page).toHaveURL(`${app}/auth/callback`);
  const retry = page.getByRole("button", { name: "Retry loading account", exact: true });
  await expect(retry).toBeVisible();
  expect(await guestSession(page)).toEqual(session);
  expect(await evidence(request)).toMatchObject({ meRequests: 1, mergeRequests: 0, mergesApplied: 0 });
  expect(await evidence(request, "keycloak")).toMatchObject({ tokenRequests: 1 });

  await retry.click();
  await expect(page).toHaveURL(`${app}${productPath}`);
  await expect(badge(page, 5)).toBeVisible();
  expect(await guestSession(page)).toBeNull();
  expect(await evidence(request)).toMatchObject({
    meRequests: 2, mergeRequests: 1, mergesApplied: 1, buyerQuantity: 5,
    mergeKeys: [session.mergeKey],
  });
  expect(await evidence(request, "keycloak")).toMatchObject({ tokenRequests: 1, pkceVerified: 1 });
  await assertOnlyGuestSessionPersisted(page);
});

for (const mode of ["merge-503-once", "merge-committed-503-once"] as const) {
  test(`${mode} keeps the guest token and retries with the same merge key without duplicating quantities`, async ({ page, request }) => {
    await request.get(`${simulation}/api/test/reset?mode=${mode}`);
    const session = await addGuest(page);
    await signIn(page);
    const retry = page.getByRole("button", { name: "Retry merging cart", exact: true });
    await expect(retry).toBeVisible();
    await expect(badge(page, mode === "merge-503-once" ? 3 : 5)).toBeVisible();
    expect(await guestSession(page)).toEqual(session);
    expect(await evidence(request)).toMatchObject({
      mergeRequests: 1, mergesApplied: mode === "merge-503-once" ? 0 : 1,
      mergeKeys: [session.mergeKey],
    });
    await retry.click();
    await expect(retry).toHaveCount(0);
    await expect(badge(page, 5)).toBeVisible();
    expect(await guestSession(page)).toBeNull();
    expect(await evidence(request)).toMatchObject({
      mergeRequests: 2, mergesApplied: 1, buyerQuantity: 5,
      mergeKeys: [session.mergeKey, session.mergeKey],
    });
    expect(await evidence(request, "keycloak")).toMatchObject({ tokenRequests: 1 });
    await assertOnlyGuestSessionPersisted(page);
  });
}

test("when the server disables guest carts the add action asks the visitor to sign in", async ({ page, request }) => {
  await request.get(`${simulation}/api/test/reset?mode=guest-disabled`);
  await page.goto(productPath);
  await page.getByRole("button", { name: "Add to Cart", exact: true }).click();
  await expect(page.getByText("Please sign in before adding items.", { exact: false })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  await expect(badge(page, 0)).toBeVisible();
  expect(await guestSession(page)).toBeNull();
  expect(await evidence(request)).toMatchObject({
    guestCreationRequests: 1, guestCreations: 0, guestAdds: 0, cartAdds: 0, mergeRequests: 0,
  });
});
