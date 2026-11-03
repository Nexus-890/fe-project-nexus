import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

const fixtureUrl = "http://127.0.0.1:3913/api";
const productId = "91300001-1111-4111-8111-111111111111";
const skuId = "91300002-1111-4111-8111-111111111111";
const productName = "Wireless Headphones Silver";
// CartResponse contains IDs/prices only; the UI uses its deterministic fallback label.
const cartItemName = `Product ${productId}`;

type RecordedRequest = {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
  authenticated: boolean;
};

async function control(request: APIRequestContext, body: Record<string, unknown>) {
  expect((await request.post(`${fixtureUrl}/__test/control`, { data: body })).ok()).toBe(true);
}

async function reset(request: APIRequestContext, body: Record<string, unknown> = {}) {
  expect((await request.post(`${fixtureUrl}/__test/reset`, { data: body })).ok()).toBe(true);
}

async function history(request: APIRequestContext): Promise<RecordedRequest[]> {
  return (await request.get(`${fixtureUrl}/__test/requests`)).json();
}

const cartRequests = (requests: RecordedRequest[]) => requests.filter(entry => entry.path.startsWith("/v1/carts/me"));
const cartLink = (page: Page) => page.locator("header").getByRole("link", { name: /Shopping cart/i });

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("cart.buyer@example.com");
  await page.getByLabel("Password", { exact: true }).fill("cart-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("header").getByRole("link", { name: "Hi Cart Buyer" })).toBeVisible();
}

async function openCart(page: Page) {
  await cartLink(page).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByRole("heading", { name: "Cart", exact: true })).toBeVisible();
}

async function openProduct(page: Page) {
  await page.locator("main").getByRole("link", { name: "Electronics", exact: true }).click();
  await page.getByRole("article", { name: productName, exact: true }).getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`${productId}$`));
  await expect(page.getByRole("heading", { name: productName, exact: true })).toBeVisible();
}

async function expectCount(page: Page, quantity: number) {
  await expect(cartLink(page)).toHaveAccessibleName(new RegExp(`Shopping cart.*\\b${quantity}\\s+items?\\b`, "i"));
}

test.beforeEach(async ({ request }) => reset(request));

test("anonymous header has no count and makes no cart request", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator("main").getByRole("link", { name: "Electronics", exact: true })).toBeVisible();
  await expect(cartLink(page)).toHaveAccessibleName("Shopping cart");
  expect(cartRequests(await history(request))).toEqual([]);
  await openCart(page);
  await expect(page.getByText(/sign in/i).last()).toBeVisible();
  expect(cartRequests(await history(request))).toEqual([]);
});

test("quantity two from the product updates the header without reloading", async ({ page, request }) => {
  await signIn(page);
  await openProduct(page);
  await page.getByRole("spinbutton", { name: "Quantity", exact: true }).fill("2");
  await page.evaluate(() => Object.assign(window, { cartAcceptanceMarker: "same-document" }));
  const addition = page.waitForResponse(response => response.request().method() === "POST"
    && new URL(response.url()).pathname === "/api/v1/carts/me/items");
  await page.getByRole("button", { name: "Add to Cart", exact: true }).click();
  expect((await addition).status()).toBe(201);
  await expectCount(page, 2);
  expect(await page.evaluate(() => (window as typeof window & { cartAcceptanceMarker?: string }).cartAcceptanceMarker)).toBe("same-document");

  const posts = cartRequests(await history(request)).filter(entry => entry.method === "POST");
  expect(posts).toHaveLength(1);
  expect(posts[0]).toMatchObject({ path: "/v1/carts/me/items", authenticated: true, body: { skuId, quantity: 2 } });
  await openCart(page);
  await expect(page.getByText(cartItemName, { exact: true })).toBeVisible();
  await expectCount(page, 2);
});

test("the header and cart list share one authenticated GET", async ({ page, request }) => {
  await reset(request, { seeded: true, quantity: 3 });
  await signIn(page);
  await expectCount(page, 3);
  await openCart(page);
  await expect(page.getByText(cartItemName, { exact: true })).toBeVisible();
  const gets = cartRequests(await history(request)).filter(entry => entry.method === "GET");
  expect(gets).toHaveLength(1);
  expect(gets[0]).toMatchObject({ path: "/v1/carts/me", authenticated: true });
});

test("minimal backend DTO sums quantities across lines and derives money totals", async ({ page, request }) => {
  await reset(request, { seeded: true, quantity: 3, secondQuantity: 2 });
  const response = page.waitForResponse(entry => entry.request().method() === "GET"
    && new URL(entry.url()).pathname === "/api/v1/carts/me");
  await signIn(page);
  const payload = await (await response).json();
  expect(Object.keys(payload).sort()).toEqual(["code", "data", "message"]);
  expect(payload).toMatchObject({ code: 0, message: "response success" });
  expect(Object.keys(payload.data).sort()).toEqual(["id", "items", "status", "userId"]);
  expect(payload.data.items).toHaveLength(2);
  for (const item of payload.data.items) {
    expect(Object.keys(item).sort()).toEqual(["id", "productId", "quantity", "skuId", "unitPrice"]);
    expect(typeof item.unitPrice).toBe("number");
  }

  await expectCount(page, 5);
  await openCart(page);
  await expect(page.getByText(cartItemName, { exact: true })).toBeVisible();
  await expect(page.getByText("Product 91300007-1111-4111-8111-111111111111", { exact: true })).toBeVisible();
  await expect(page.getByText("Subtotal (5 items)", { exact: true })).toBeVisible();
  await expect(page.getByText("5.500.001,00 ₫", { exact: true })).toBeVisible();
  expect(cartRequests(await history(request)).filter(entry => entry.method === "GET")).toHaveLength(1);
});

test("updating and removing an item updates the shared header count", async ({ page, request }) => {
  await reset(request, { seeded: true });
  await signIn(page);
  await openCart(page);
  await expectCount(page, 1);
  const update = page.waitForResponse(response => response.request().method() === "PUT"
    && new URL(response.url()).pathname.startsWith("/api/v1/carts/me/items/"));
  await page.getByRole("button", { name: new RegExp(`Increase quantity.*${cartItemName}`, "i") }).click();
  expect((await update).status()).toBe(200);
  await expectCount(page, 2);
  const updates = cartRequests(await history(request)).filter(entry => entry.method === "PUT");
  expect(updates).toHaveLength(1);
  expect(updates[0]).toMatchObject({ body: { quantity: 2 }, authenticated: true });
  const removal = page.waitForResponse(response => response.request().method() === "DELETE" && new URL(response.url()).pathname.startsWith("/api/v1/carts/me/items/"));
  await page.getByRole("button", { name: new RegExp(`Remove.*${cartItemName}`, "i") }).click();
  expect((await removal).status()).toBe(204);
  await expect(page.getByText(cartItemName, { exact: true })).toHaveCount(0);
  await expect(page.getByText(/your cart is empty/i)).toBeVisible();
  const removals = cartRequests(await history(request)).filter(entry => entry.method === "DELETE");
  expect(removals).toHaveLength(1);
  expect(removals[0].authenticated).toBe(true);
  expect(cartRequests(await history(request)).filter(entry => entry.method === "GET")).toHaveLength(2);
  await expect(cartLink(page)).not.toHaveAccessibleName(/\b[1-9]\d* items?\b/);
});

test("cart GET failure offers retry and recovers the cart", async ({ page, request }) => {
  await reset(request, { seeded: true, quantity: 2 });
  await control(request, { getStatus: 503 });
  await signIn(page);
  await openCart(page);
  await expect(page.locator("main").getByRole("alert")).toContainText(/cart/i);
  await control(request, { getStatus: 0 });
  await page.getByRole("button", { name: /retry cart|try again/i }).click();
  await expect(page.getByText(cartItemName, { exact: true })).toBeVisible();
  await expectCount(page, 2);
});

test("failed quantity update preserves the last confirmed cart and can retry", async ({ page, request }) => {
  await reset(request, { seeded: true });
  await signIn(page);
  await openCart(page);
  await control(request, { writeStatus: 503 });
  await page.getByRole("button", { name: new RegExp(`Increase quantity.*${cartItemName}`, "i") }).click();
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  await expectCount(page, 1);
  await control(request, { writeStatus: 0 });
  await page.getByRole("button", { name: new RegExp(`Increase quantity.*${cartItemName}`, "i") }).click();
  await expectCount(page, 2);
});

test("a late add response after sign out cannot restore the cart badge", async ({ page, request }) => {
  await signIn(page);
  await openProduct(page);
  await control(request, { postDelayMs: 1200 });
  await page.getByRole("spinbutton", { name: "Quantity", exact: true }).fill("2");
  await page.getByRole("button", { name: "Add to Cart", exact: true }).click();
  await expect.poll(async () => cartRequests(await history(request)).filter(entry => entry.method === "POST").length).toBe(1);
  await page.locator("header").getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByRole("link", { name: "Nexus home", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(async () => ((await (await request.get(`${fixtureUrl}/__test/cart`)).json()).items[0]?.quantity ?? 0)).toBe(2);
  await expect(cartLink(page)).toHaveAccessibleName("Shopping cart");
  await expect(page.locator("header").getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  expect(cartRequests(await history(request)).filter(entry => entry.method === "GET")).toHaveLength(1);
});

test("cart fits mobile and desktop and captures review screenshots", async ({ page, request }, info) => {
  await reset(request, { seeded: true, quantity: 2 });
  await signIn(page);
  await openCart(page);
  await expect(page.getByText(cartItemName, { exact: true })).toBeVisible();
  const screenshotStyle = "nextjs-portal { display: none !important; }";
  await page.screenshot({ path: info.outputPath("cart-desktop-1440.png"), fullPage: true, style: screenshotStyle });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const clipped = await page.locator("main h1:visible, main h2:visible, main p:visible, main button:visible, main a:visible")
    .evaluateAll(elements => elements.filter(el => el instanceof HTMLElement && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1)
      .map(el => (el.textContent ?? "").trim()).filter(Boolean));
  expect(clipped).toEqual([]);
  await page.screenshot({ path: info.outputPath("cart-mobile-375x812.png"), fullPage: true, style: screenshotStyle });
});
