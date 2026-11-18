import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const simulation = `http://127.0.0.1:${process.env.NEXUS_CHECKOUT_API_PORT || "3923"}`;
const groupId = "c8000000-0000-4000-8000-000000000006";
const paymentPath = `/checkout/payment/${groupId}`;
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
type OrderBody = {
  shippingAddress: {
    recipientName: string; phoneNumber: string; addressLine: string;
    provinceCode: string; wardCode: string; countryCode: string;
  };
  paymentMethod: string;
};
type OrderGroup = {
  orderGroupId: string; totalAmount: number;
  orders: Array<{ orderId: string; sellerId: string; totalAmount: number }>;
};
type Evidence = {
  requests: Array<{ method: string; path: string; query: string; authorized: boolean }>;
  orderRequests: number;
  rejectedAuth: number;
  orders: Array<{ key: string; body: OrderBody; status: number; orderGroupId?: string }>;
  groups: Array<{ key: string; body: OrderBody; group: OrderGroup }>;
  completedOrders: number;
  consumedCartPreviews: number;
};

async function evidence(request: APIRequestContext): Promise<Evidence> {
  const response = await request.get(`${simulation}/api/test/evidence`);
  expect(response.ok()).toBe(true);
  return response.json();
}
async function options(request: APIRequestContext, changes: Record<string, boolean>) {
  expect((await request.post(`${simulation}/api/test/options`, { data: changes })).ok()).toBe(true);
}
async function openCheckout(page: Page) {
  await page.goto("/sign-in?returnTo=%2Fcheckout");
  await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/keycloak\/realms\/nexus\/protocol\/openid-connect\/auth\?/);
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("buyer@nexus.local");
  await page.getByLabel("Password", { exact: true }).fill("Fixture-pass-123!");
  await page.getByRole("button", { name: "Sign in at Keycloak", exact: true }).click();
  await expect(page).toHaveURL(/\/checkout$/);
}
async function readyToOrder(page: Page) {
  await openCheckout(page);
  await page.getByLabel("Province / City", { exact: true }).selectOption("202");
  await page.getByLabel("Ward", { exact: true }).selectOption("20308");
  await expect(page.getByTestId("checkout-total")).toHaveText("455.000,00 ₫");
  await expect(page.getByRole("button", { name: "Place order", exact: true })).toBeEnabled();
}
const placeOrder = (page: Page) => page.getByRole("button", { name: "Place order", exact: true });

test.beforeEach(async ({ request }) => {
  expect((await request.get(`${simulation}/keycloak/test/reset`)).ok()).toBe(true);
  expect((await request.get(`${simulation}/api/test/reset`)).ok()).toBe(true);
});

test("placing an order requires a valid address and an available quote", async ({ page, request }) => {
  await openCheckout(page);
  await expect(placeOrder(page)).toBeDisabled();
  await page.getByLabel("Province / City", { exact: true }).selectOption("202");
  await page.getByLabel("Ward", { exact: true }).selectOption("20308");
  await expect(page.getByTestId("checkout-total")).toHaveText("455.000,00 ₫");
  await expect(placeOrder(page)).toBeEnabled();
  await page.getByLabel("Phone number", { exact: true }).fill("12");
  await expect(placeOrder(page)).toBeDisabled();
  expect((await evidence(request)).orderRequests).toBe(0);
});

test("double-click sends one purchase and opens one payment page for two seller orders", async ({ page, request }) => {
  await options(request, { slowOrder: true });
  await readyToOrder(page);
  await placeOrder(page).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(page.getByRole("button", { name: /Placing order/ })).toBeDisabled();
  await expect(page.getByLabel("Recipient name", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Ward", { exact: true })).toBeDisabled();
  await expect(page).toHaveURL(new RegExp(`${paymentPath}$`));
  await expect(page.getByTestId("payment-order-group-id")).toHaveText(groupId);
  const actual = await evidence(request);
  expect(actual.orderRequests).toBe(1);
  expect(actual.orders[0].key).toMatch(uuid);
  expect(actual.orders[0].status).toBe(201);
  expect(actual.groups).toHaveLength(1);
  expect(actual.groups[0].group.orders).toHaveLength(2);
  expect(new Set(actual.groups[0].group.orders.map((order) => order.sellerId)).size).toBe(2);
  expect(actual.groups[0].group.totalAmount).toBe(425000);
  expect(actual.orders[0].body).toEqual({
    shippingAddress: {
      recipientName: "Nguyen Thi Lan", phoneNumber: "0901234567", addressLine: "227 Nguyen Van Cu",
      provinceCode: "202", wardCode: "20308", countryCode: "VN",
    },
    paymentMethod: "SEPAY",
    voucherCodes: [],
  });
  expect(actual.requests.filter((entry) => entry.path === "/v1/orders").every((entry) => entry.authorized)).toBe(true);
  expect(actual.rejectedAuth).toBe(0);
});

test("retry after an ambiguous response reuses the key and body and recovers the existing group", async ({ page, request }) => {
  await options(request, { orderLostResponse: true });
  await readyToOrder(page);
  await placeOrder(page).click();
  await expect(page.getByText("The order response was lost. Retry to retrieve the same purchase.", { exact: true })).toBeVisible();
  const first = await evidence(request);
  expect(first.orderRequests).toBe(1);
  expect(first.groups).toHaveLength(1);
  await expect(page.getByLabel("House number and street", { exact: true })).toBeDisabled();
  await placeOrder(page).click();
  await expect(page).toHaveURL(new RegExp(`${paymentPath}$`));
  const actual = await evidence(request);
  expect(actual.orders.map((entry) => entry.status)).toEqual([503, 200]);
  expect(actual.orders[1].key).toBe(actual.orders[0].key);
  expect(actual.orders[1].body).toEqual(actual.orders[0].body);
  expect(actual.orders[1].orderGroupId).toBe(actual.orders[0].orderGroupId);
  expect(actual.groups).toHaveLength(1);
});

test("an empty-cart refresh after an ambiguous write preserves the attempt for safe retry", async ({ page, request }) => {
  await options(request, { orderLostResponse: true });
  await readyToOrder(page);
  await placeOrder(page).click();
  await expect(page.getByText("The order response was lost. Retry to retrieve the same purchase.", { exact: true })).toBeVisible();
  const readsBeforeReconnect = (await evidence(request)).requests.filter((entry) => entry.path === "/v1/carts/me").length;
  await page.clock.install();
  await page.clock.setSystemTime(new Date(Date.now() + 31_000));
  await page.context().setOffline(true);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await page.clock.runFor(50);
  await page.context().setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.clock.runFor(50);
  await expect.poll(async () => (await evidence(request)).requests.filter((entry) => entry.path === "/v1/carts/me").length).toBeGreaterThan(readsBeforeReconnect);
  await expect.poll(async () => (await evidence(request)).consumedCartPreviews).toBeGreaterThan(0);
  await expect(page.getByRole("alert").filter({ hasText: "Your cart has already been checked out." })).toBeVisible();
  // The stand-in emptied the cart when it persisted the order. A background
  // refresh must not unmount checkout and lose the original idempotency key.
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(placeOrder(page)).toBeEnabled();
  await placeOrder(page).click();
  await expect(page).toHaveURL(new RegExp(`${paymentPath}$`));
  const actual = await evidence(request);
  expect(actual.orders.map((entry) => entry.status)).toEqual([503, 200]);
  expect(actual.orders[1].key).toBe(actual.orders[0].key);
  expect(actual.orders[1].body).toEqual(actual.orders[0].body);
  expect(actual.groups).toHaveLength(1);
});

test("price change displays both VND prices and creates nothing until explicit confirmation with a new key", async ({ page, request }, info) => {
  await options(request, { priceChanged: true });
  await readyToOrder(page);
  await placeOrder(page).click();
  await expect(page.getByRole("heading", { name: "Price changed", exact: true })).toBeVisible();
  const conflict = page.getByRole("alert").filter({ hasText: "Price changed" });
  await expect(conflict).toContainText("150.000,00 ₫");
  await expect(conflict).toContainText("180.000,00 ₫");
  await expect(page.getByRole("button", { name: "Confirm new price", exact: true })).toBeEnabled();
  const before = await evidence(request);
  expect(before.orderRequests).toBe(1);
  expect(before.groups).toHaveLength(0);
  await expect(placeOrder(page)).toBeDisabled();
  const screenshot = info.outputPath("place-order-price-conflict-mobile.png");
  await page.screenshot({ path: screenshot, fullPage: true, style: "nextjs-portal { visibility: hidden !important; }" });
  await info.attach("price-conflict-mobile", { path: screenshot, contentType: "image/png" });
  await page.getByRole("button", { name: "Confirm new price", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${paymentPath}$`));
  const actual = await evidence(request);
  expect(actual.orders.map((entry) => entry.status)).toEqual([409, 201]);
  expect(actual.orders[1].key).toMatch(uuid);
  expect(actual.orders[1].key).not.toBe(actual.orders[0].key);
  expect(actual.groups).toHaveLength(1);
  expect(actual.groups[0].group.totalAmount).toBe(485000);
});

for (const stockSkuOnly of [false, true]) {
  test(`stock rejection names the sold-out item (${stockSkuOnly ? "SKU resolved from catalog" : "server product name"})`, async ({ page, request }) => {
    await options(request, { insufficientStock: true, stockSkuOnly });
    await readyToOrder(page);
    await placeOrder(page).click();
    await expect(page.getByRole("alert").filter({ hasText: "Wireless earbuds with charging case" })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "doesn’t have enough stock for the quantity in your cart." })).toBeVisible();
    const actual = await evidence(request);
    expect(actual.orderRequests).toBe(1);
    expect(actual.groups).toHaveLength(0);
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(placeOrder(page)).toBeDisabled();
  });
}

test("unknown 409 renders its detail without an automatic retry or navigation", async ({ page, request }) => {
  await options(request, { orderUnknownConflict: true });
  await readyToOrder(page);
  await placeOrder(page).click();
  await expect(page.getByRole("alert").filter({ hasText: "This checkout cannot proceed. Review your cart before trying again." })).toBeVisible();
  await expect(page).toHaveURL(/\/checkout$/);
  expect((await evidence(request)).orderRequests).toBe(1);
  expect((await evidence(request)).groups).toHaveLength(0);
});

test("malformed price details block purchasing and retain the actionable server detail", async ({ page, request }) => {
  await options(request, { malformedPriceChanged: true });
  await readyToOrder(page);
  await placeOrder(page).click();
  await expect(page.getByRole("alert").filter({ hasText: "A price changed, but its updated amount is unavailable. Return to your cart." })).toBeVisible();
  await expect(placeOrder(page)).toBeDisabled();
  await expect(page.getByRole("button", { name: "Confirm new price", exact: true })).toHaveCount(0);
  const actual = await evidence(request);
  expect(actual.orderRequests).toBe(1);
  expect(actual.groups).toHaveLength(0);
});

test("order field validation stays on the address form and permits a corrected attempt", async ({ page, request }) => {
  await options(request, { orderValidation: true });
  await readyToOrder(page);
  await placeOrder(page).click();
  await expect(page.getByLabel("Phone number", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Enter a reachable Vietnamese phone number.", { exact: true }).first()).toBeVisible();
  const rejected = await evidence(request);
  expect(rejected.orderRequests).toBe(1);
  expect(rejected.groups).toHaveLength(0);
  await options(request, { orderValidation: false });
  await page.getByLabel("Phone number", { exact: true }).fill("0907654321");
  await placeOrder(page).click();
  await expect(page).toHaveURL(new RegExp(`${paymentPath}$`));
  const actual = await evidence(request);
  expect(actual.orders[1].key).not.toBe(actual.orders[0].key);
  expect(actual.orders[1].body.shippingAddress.phoneNumber).toBe("0907654321");
  expect(actual.groups).toHaveLength(1);
});

test("logout during an order response cannot open the previous session's payment page", async ({ page, request }) => {
  await options(request, { slowOrder: true });
  await readyToOrder(page);
  await placeOrder(page).click();
  await expect.poll(async () => (await evidence(request)).orderRequests).toBe(1);
  await page.locator("header summary", { hasText: /^Hi / }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByText("Hi Nguyen Thi Lan", { exact: true })).toHaveCount(0);
  await expect.poll(async () => (await evidence(request)).completedOrders).toBe(1);
  await expect(page).not.toHaveURL(/\/checkout\/payment\//);
  await expect(page.getByTestId("checkout-total")).toHaveCount(0);
});
