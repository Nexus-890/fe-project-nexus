import { test, expect, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";
import type { OrderStatus } from "../types/orderResponseType";

// The focused config supplies a real HTTP stand-in; the general suite does not.
test.skip(!process.env.NEXUS_ORDER_LIST_TEST, "Run with playwright.orders.config.ts for the order HTTP simulation.");

const simulation = `http://127.0.0.1:${process.env.NEXUS_ORDER_LIST_PORT || "3914"}/api`;
const provider = `http://127.0.0.1:${process.env.NEXUS_TEST_PROVIDER_PORT || process.env.NEXUS_OIDC_SIM_PORT || "3913"}`;
const pendingId = "68000000-0000-4000-8000-000000000002";
const pendingGroupId = "c8000000-0000-4000-8000-000000000102";
const shipmentId = "69000000-0000-4000-8000-000000000050";
const shipmentEnvelope = (data: unknown) => ({ code: 0, message: "response success", data });
const shipmentList = (exists: boolean) => ({
  ...shipmentEnvelope(exists ? [{ id: shipmentId, orderId: pendingId }] : []),
  page: { number: 0, size: 1, totalElements: exists ? 1 : 0, totalPages: exists ? 1 : 0 },
});
const shipmentHistory = [
  { id: "69000000-0000-4000-8000-000000000051", status: "CREATED", description: "Shipment accepted by carrier", createdAt: "2026-11-10T01:00:00Z" },
  { id: "69000000-0000-4000-8000-000000000052", status: "SHIPPED", description: "Collected from the warehouse", createdAt: "2026-11-10T04:00:00Z" },
  { id: "69000000-0000-4000-8000-000000000053", status: "IN_TRANSIT", description: "Arrived at sorting facility", createdAt: "2026-11-11T04:00:00Z" },
];
const rows = (page: Page) => page.getByTestId(/^order-row-/);

async function evidence(request: APIRequestContext) {
  const response = await request.get(`${simulation}/test/evidence`);
  expect(response.ok()).toBe(true);
  return response.json();
}

async function mode(request: APIRequestContext, value: string) {
  expect((await request.get(`${simulation}/test/mode?mode=${value}`)).ok()).toBe(true);
}

async function signIn(page: Page, destination = "/orders") {
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(destination)}`);
  await finishSignIn(page);
}

async function finishSignIn(page: Page) {
  await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/keycloak\/realms\/nexus\/protocol\/openid-connect\/auth\?/);
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("buyer@nexus.local");
  await page.getByLabel("Password", { exact: true }).fill("Fixture-pass-123!");
  await page.getByRole("button", { name: "Sign in at Keycloak", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Orders", exact: true })).toBeVisible();
}

async function capture(page: Page, info: TestInfo, filename: string) {
  const output = info.outputPath(filename);
  await page.screenshot({ path: output, fullPage: true, style: "nextjs-portal { visibility: hidden !important; }" });
  await info.attach(filename, { path: output, contentType: "image/png" });
}

async function prepareShippedOrder(page: Page, status: OrderStatus = "SHIPPED") {
  const order = {
    orderId: pendingId, orderNumber: "NX-261110-SHIPPING", orderGroupId: pendingGroupId,
    userId: "68000000-0000-4000-8000-000000000003", sellerId: "69000000-0000-4000-8000-000000000001",
    orderType: "STANDARD", status, createdAt: "2026-11-10T00:30:00Z", totalAmount: 150000,
    items: [{ orderItemId: "69000000-0000-4000-8000-000000000011", productId: "69000000-0000-4000-8000-000000000012", skuId: "69000000-0000-4000-8000-000000000013", productName: "Purchased product snapshot", skuCode: "WHITE-M", imageUrl: null, quantity: 2, unitPrice: 75000, totalPrice: 150000 }],
  };
  await page.route(`**/api/v1/orders/${pendingId}`, (route) => route.fulfill({ json: shipmentEnvelope(order) }));
  await page.route(`**/api/v1/orders/${pendingId}/history`, (route) => route.fulfill({ json: shipmentEnvelope([]) }));
}

async function openShippedOrder(page: Page) {
  await signIn(page);
  await page.goto(`/order/${pendingId}`);
  await expect(page.getByRole("heading", { name: "Order NX-261110-SHIPPING", exact: true })).toBeVisible();
}

test.beforeEach(async ({ page, request }) => {
  expect((await request.get(`${provider}/keycloak/test/reset`)).ok()).toBe(true);
  expect((await request.get(`${provider}/api/test/reset`)).ok()).toBe(true);
  expect((await request.get(`${simulation}/test/reset`)).ok()).toBe(true);
  // The header's same-origin cart is outside this task's API dependency.
  await page.route("**/api/v1/carts/me", (route) => route.fulfill({ json: {
    code: 0, message: "response success", data: {
      id: "order-header-cart", userId: "68000000-0000-4000-8000-000000000003", status: "ACTIVE", items: [],
    },
  } }));
  // Existing order scenarios have no shipment; this models the delivered empty-list contract.
  await page.route(/\/api\/v1\/shipments(?:\?.*)?$/, (route) => route.fulfill({ json: shipmentList(false) }));
});

test("shipped order displays carrier, copyable tracking and chronological history at mobile and desktop sizes", async ({ page }, info) => {
  await prepareShippedOrder(page);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const trackingCode = "GHN-1234567890123456789012345678901234567890123456789012345678901234567890";
  let listReads = 0;
  let trackingReads = 0;
  await page.route(/\/api\/v1\/shipments(?:\?.*)?$/, (route) => {
    const url = new URL(route.request().url());
    expect(Object.fromEntries(url.searchParams)).toEqual({ orderId: pendingId, page: "0", size: "1" });
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    listReads++;
    return route.fulfill({ json: shipmentList(true) });
  });
  await page.route(`**/api/v1/shipments/${shipmentId}/tracking`, (route) => {
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    trackingReads++;
    return route.fulfill({ json: shipmentEnvelope({ shipmentId, orderId: pendingId, carrier: "GHN", trackingCode, status: "IN_TRANSIT", history: shipmentHistory }) });
  });
  await openShippedOrder(page);
  const region = page.getByRole("region", { name: "Shipment tracking", exact: true });
  await expect(region).toBeVisible();
  await expect(region.getByText("GHN", { exact: true })).toBeVisible();
  await expect(region.getByText(trackingCode, { exact: true })).toBeVisible();
  const updates = region.getByRole("list", { name: "Shipment status history" }).getByRole("listitem");
  await expect(updates).toHaveText([/Shipment created[\s\S]*Shipment accepted by carrier/, /Shipped[\s\S]*Collected from the warehouse/, /In transit[\s\S]*Arrived at sorting facility/]);
  await expect(updates.last()).toHaveAttribute("aria-current", "step");
  await region.getByRole("button", { name: "Copy tracking code", exact: true }).click();
  await expect(region.getByRole("status")).toHaveText("Tracking code copied.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(trackingCode);
  expect(listReads).toBeGreaterThan(0);
  expect(trackingReads).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await capture(page, info, "shipment-tracking-mobile-375x812.png");
  await page.setViewportSize({ width: 1440, height: 1060 });
  await expect(region).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await capture(page, info, "shipment-tracking-desktop-1440.png");
});

test("order with no shipment hides tracking completely without an error", async ({ page }) => {
  await prepareShippedOrder(page);
  await page.clock.install();
  let reads = 0;
  await page.route(/\/api\/v1\/shipments(?:\?.*)?$/, (route) => {
    reads++;
    return route.fulfill({ json: shipmentList(false) });
  });
  await openShippedOrder(page);
  await expect.poll(() => reads).toBe(1);
  await expect(page.getByText("Checking shipping updates…", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Shipment tracking", exact: true })).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Your items", exact: true })).toBeVisible();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.clock.runFor(61_000);
  expect(reads).toBe(1);
});

test("shipment awaiting a carrier code shows preparation and empty history without inventing updates", async ({ page }) => {
  await prepareShippedOrder(page);
  await page.route(/\/api\/v1\/shipments(?:\?.*)?$/, (route) => route.fulfill({ json: shipmentList(true) }));
  await page.route(`**/api/v1/shipments/${shipmentId}/tracking`, (route) => route.fulfill({ json: shipmentEnvelope({
    shipmentId, orderId: pendingId, carrier: "GHN", trackingCode: null, status: "PENDING_TRACKING", history: [],
  }) }));
  await openShippedOrder(page);
  const region = page.getByRole("region", { name: "Shipment tracking", exact: true });
  await expect(region.getByText("Preparing shipment", { exact: true })).toBeVisible();
  await expect(region.getByText("The carrier hasn’t assigned a tracking code yet.", { exact: true })).toBeVisible();
  await expect(region.getByText("No shipping updates yet.", { exact: true })).toBeVisible();
  await expect(region.getByRole("button", { name: "Copy tracking code", exact: true })).toHaveCount(0);
  await expect(region.getByRole("list", { name: "Shipment status history" })).toHaveCount(0);
});

test("shipment access failure remains visible and an explicit retry can recover", async ({ page }) => {
  await prepareShippedOrder(page);
  await page.clock.install();
  let fail = true;
  let reads = 0;
  await page.route(/\/api\/v1\/shipments(?:\?.*)?$/, (route) => {
    reads++;
    return fail ? route.fulfill({ status: 403, contentType: "application/problem+json", json: {
      title: "Forbidden", status: 403, code: "SHIPMENT_FORBIDDEN", detail: "You cannot view shipment updates.",
    } }) : route.fulfill({ json: shipmentList(false) });
  });
  await openShippedOrder(page);
  await expect(page.getByRole("alert").filter({ hasText: "You cannot view shipment updates." })).toBeVisible();
  expect(reads).toBe(1);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.clock.runFor(61_000);
  expect(reads).toBe(1);
  await page.clock.resume();
  fail = false;
  await page.getByRole("button", { name: "Retry shipping updates", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "You cannot view shipment updates." })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Retry shipping updates", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Shipment tracking", exact: true })).toHaveCount(0);
  expect(reads).toBe(2);
});

for (const status of ["PENDING", "CANCELED", "DELIVERED"] as const) {
  test(`${status.toLowerCase()} order preserves an existing shipment without periodically reading it`, async ({ page }) => {
    await prepareShippedOrder(page, status);
    await page.clock.install();
    let listReads = 0;
    let trackingReads = 0;
    await page.route(/\/api\/v1\/shipments(?:\?.*)?$/, (route) => {
      listReads++;
      return route.fulfill({ json: shipmentList(true) });
    });
    await page.route(`**/api/v1/shipments/${shipmentId}/tracking`, (route) => {
      trackingReads++;
      return route.fulfill({ json: shipmentEnvelope({ shipmentId, orderId: pendingId, carrier: "GHN", trackingCode: "GHN123456", status: "IN_TRANSIT", history: shipmentHistory }) });
    });
    await openShippedOrder(page);
    const region = page.getByRole("region", { name: "Shipment tracking", exact: true });
    await expect(region.getByText("GHN123456", { exact: true })).toBeVisible();
    await expect(region.getByRole("list", { name: "Shipment status history" }).getByRole("listitem")).toHaveCount(3);
    expect({ listReads, trackingReads }).toEqual({ listReads: 1, trackingReads: 1 });
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
    await page.clock.runFor(61_000);
    expect({ listReads, trackingReads }).toEqual({ listReads: 1, trackingReads: 1 });
    await expect(region).toBeVisible();
  });
}

for (const status of ["DELIVERED", "RETURNED", "CANCELLED"] as const) {
  test(`${status.toLowerCase()} shipment remains readable without periodic requests`, async ({ page }) => {
    await prepareShippedOrder(page);
    await page.clock.install();
    let listReads = 0;
    let trackingReads = 0;
    await page.route(/\/api\/v1\/shipments(?:\?.*)?$/, (route) => {
      listReads++;
      return route.fulfill({ json: shipmentList(true) });
    });
    await page.route(`**/api/v1/shipments/${shipmentId}/tracking`, (route) => {
      trackingReads++;
      return route.fulfill({ json: shipmentEnvelope({ shipmentId, orderId: pendingId, carrier: "GHN", trackingCode: "GHN123456", status, history: shipmentHistory }) });
    });
    await openShippedOrder(page);
    await expect(page.getByRole("region", { name: "Shipment tracking", exact: true })).toBeVisible();
    expect({ listReads, trackingReads }).toEqual({ listReads: 1, trackingReads: 1 });
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
    await page.clock.runFor(61_000);
    expect({ listReads, trackingReads }).toEqual({ listReads: 1, trackingReads: 1 });
  });
}

test("active shipment polling reads only tracking and stops when delivery is confirmed", async ({ page }) => {
  await prepareShippedOrder(page);
  await page.clock.install();
  let listReads = 0;
  let trackingReads = 0;
  await page.route(/\/api\/v1\/shipments(?:\?.*)?$/, (route) => {
    listReads++;
    return route.fulfill({ json: shipmentList(true) });
  });
  await page.route(`**/api/v1/shipments/${shipmentId}/tracking`, (route) => {
    trackingReads++;
    return route.fulfill({ json: shipmentEnvelope({ shipmentId, orderId: pendingId, carrier: "GHN", trackingCode: "GHN123456", status: trackingReads > 1 ? "DELIVERED" : "IN_TRANSIT", history: shipmentHistory }) });
  });
  await openShippedOrder(page);
  const region = page.getByRole("region", { name: "Shipment tracking", exact: true });
  await expect(region.getByText("In transit", { exact: true }).first()).toBeVisible();
  expect({ listReads, trackingReads }).toEqual({ listReads: 1, trackingReads: 1 });
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  const refreshed = page.waitForResponse((response) => new URL(response.url()).pathname === `/api/v1/shipments/${shipmentId}/tracking`);
  await page.clock.runFor(30_000);
  await (await refreshed).finished();
  // TanStack publishes completed HTTP reads on its notification timer.
  await page.clock.runFor(100);
  await expect(region.getByText("Delivered", { exact: true })).toBeVisible();
  expect({ listReads, trackingReads }).toEqual({ listReads: 1, trackingReads: 2 });
  await page.clock.runFor(61_000);
  expect({ listReads, trackingReads }).toEqual({ listReads: 1, trackingReads: 2 });
  await expect(region.getByRole("list", { name: "Shipment status history" }).getByRole("listitem")).toHaveCount(3);
});

test("buyer opens an order snapshot, reads history and cancels with a reason", async ({ page }) => {
  let canceled = false;
  let reason: unknown;
  const createdAt = "2026-09-29T10:30:00+07:00";
  const snapshot = () => ({
    orderId: pendingId, orderNumber: "NX-260929-DETAIL", orderGroupId: pendingGroupId,
    userId: "68000000-0000-4000-8000-000000000003", sellerId: "69000000-0000-4000-8000-000000000001",
    orderType: "STANDARD", status: canceled ? "CANCELED" : "PENDING", createdAt, totalAmount: 150000,
    items: [{ orderItemId: "69000000-0000-4000-8000-000000000011", productId: "69000000-0000-4000-8000-000000000012", skuId: "69000000-0000-4000-8000-000000000013", productName: "Purchased product snapshot", skuCode: "WHITE-M", imageUrl: null, quantity: 2, unitPrice: 75000, totalPrice: 150000 }],
  });
  const envelope = (data: unknown) => ({ code: 0, message: "response success", data });
  await page.route(`**/api/v1/orders/${pendingId}`, (route) => {
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    return route.fulfill({ json: envelope(snapshot()) });
  });
  await page.route(`**/api/v1/orders/${pendingId}/history`, (route) => route.fulfill({ json: envelope([
    { id: "69000000-0000-4000-8000-000000000014", changedBy: "68000000-0000-4000-8000-000000000003", previousStatus: null, newStatus: "PENDING", reason: "Order created", createdAt },
    ...(canceled ? [{ id: "69000000-0000-4000-8000-000000000015", changedBy: "68000000-0000-4000-8000-000000000003", previousStatus: "PENDING", newStatus: "CANCELED", reason: "Changed my mind", createdAt }] : []),
  ]) }));
  await page.route(`**/api/v1/orders/${pendingId}/cancel`, (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    reason = route.request().postDataJSON();
    canceled = true;
    return route.fulfill({ json: envelope({ orderGroupId: pendingGroupId, status: "CANCELED", currency: "VND", totalAmount: 150000, dueAt: createdAt, orders: [snapshot()] }) });
  });
  await signIn(page);
  await rows(page).filter({ has: page.locator(`a[href="/order/${pendingId}"]`) }).getByRole("link").first().click();
  await expect(page.getByRole("heading", { name: "Order NX-260929-DETAIL", exact: true })).toBeVisible();
  await expect(page.getByText("Purchased product snapshot", { exact: true })).toBeVisible();
  await expect(page.getByText("Order created", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Pay now", exact: true })).toHaveAttribute("href", `/checkout/payment/${pendingGroupId}`);
  await page.getByRole("button", { name: "Cancel order", exact: true }).click();
  await page.getByLabel("Why do you want to cancel?", { exact: true }).fill("  Changed my mind  ");
  await page.getByRole("button", { name: "Confirm cancellation", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Your cancellation request was processed." })).toBeVisible();
  await expect(page.getByText("Changed my mind", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Pay now", exact: true })).toHaveCount(0);
  expect(reason).toEqual({ reason: "Changed my mind" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("signed-out orders do not request private data", async ({ page, request }) => {
  await page.goto("/orders?status=PENDING");
  await expect(page.getByRole("main").getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
  expect((await evidence(request)).reads).toEqual([]);
});

test("three orders display number, date, total and status with only pending payment navigation", async ({ page, request }, info) => {
  await page.setViewportSize({ width: 1440, height: 1060 });
  await signIn(page);
  await expect(rows(page)).toHaveCount(3);
  const expected = [
    ["68000000-0000-4000-8000-000000000001", "NX-260929-0042", "300.000,50 ₫", "Processing"],
    [pendingId, "NX-260929-0038", "9.854.900,00 ₫", "To Pay"],
    ["68000000-0000-4000-8000-000000000003", "NX-260921-0311", "93.190,00 ₫", "Cancelled"],
  ];
  for (const [id, number, total, status] of expected) {
    const row = page.getByTestId(`order-row-${id}`);
    await expect(row).toContainText(number);
    await expect(row).toContainText(/Sep 29, 2026|29 Sep 2026|29\/09\/2026/);
    await expect(row).toContainText(total);
    await expect(row.getByText(status, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole("main").getByRole("link", { name: "Pay Now", exact: true })).toHaveCount(1);
  const pay = page.getByTestId(`order-row-${pendingId}`).getByRole("link", { name: "Pay Now", exact: true });
  await expect(pay).toHaveAttribute("href", `/checkout/payment/${pendingGroupId}`);
  expect((await evidence(request)).reads).toContainEqual({ method: "GET", status: null, page: "0", size: "10", authorized: true });
  await capture(page, info, "orders-desktop-1440.png");
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await capture(page, info, "orders-mobile-375x812.png");
  await pay.click();
  await expect(page).toHaveURL(new RegExp(`/checkout/payment/${pendingGroupId}$`));
});

test("status filter persists through refresh and cookie session restoration", async ({ page, request }) => {
  await signIn(page);
  await expect(rows(page)).toHaveCount(3);
  await page.getByRole("combobox", { name: "Order status", exact: true }).selectOption("PENDING");
  await expect(page).toHaveURL(/\/orders\?status=PENDING$/);
  await expect(rows(page)).toHaveCount(1);
  await expect(page.getByTestId(`order-row-${pendingId}`)).toContainText("To Pay");
  await page.reload();
  await expect(page).toHaveURL(/\/orders\?status=PENDING$/);
  await expect(page).toHaveURL(/\/orders\?status=PENDING$/);
  await expect(page.getByRole("combobox", { name: "Order status", exact: true })).toHaveValue("PENDING");
  await expect(rows(page)).toHaveCount(1);
  const reads = (await evidence(request)).reads;
  expect(reads.filter((read: { status: string | null }) => read.status === "PENDING").length).toBeGreaterThanOrEqual(2);
});

test("pagination sends zero-based pages and keeps the selected status", async ({ page, request }) => {
  await mode(request, "paged");
  await signIn(page, "/orders?status=PENDING");
  await expect(rows(page)).toHaveCount(10);
  await page.getByRole("navigation", { name: "Order pagination", exact: true }).getByRole("link", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/\/orders\?status=PENDING&page=2$/);
  await expect(rows(page)).toHaveCount(10);
  expect((await evidence(request)).reads).toContainEqual({ method: "GET", status: "PENDING", page: "1", size: "10", authorized: true });
  await page.getByRole("combobox", { name: "Order status", exact: true }).selectOption("CANCELED");
  await expect(page).toHaveURL(/\/orders\?status=CANCELED$/);
  await expect(rows(page)).toHaveCount(1);
  await expect(page.getByRole("main")).toContainText("Cancelled");
  expect((await evidence(request)).reads).toContainEqual({ method: "GET", status: "CANCELED", page: "0", size: "10", authorized: true });
});

test("empty results render a message", async ({ page, request }) => {
  await mode(request, "empty");
  await signIn(page);
  await expect(rows(page)).toHaveCount(0);
  await expect(page.getByRole("main")).toContainText(/no orders/i);
});

test("confirmation query alone cannot claim payment and survives filtering and reload", async ({ page }) => {
  const confirmation = "payment=confirmed&groupId=c8000000-0000-4000-8000-000000000102";
  await signIn(page, `/orders?${confirmation}`);
  await expect(rows(page)).toHaveCount(3);
  await expect(page.getByText("Payment confirmed. All orders in your group have been paid.", { exact: true })).toHaveCount(0);
  await page.getByRole("combobox", { name: "Order status", exact: true }).selectOption("PENDING");
  await expect(page).toHaveURL(`/orders?status=PENDING&${confirmation}`);
  await expect(rows(page)).toHaveCount(1);
  await page.reload();
  await expect(page).toHaveURL(`/orders?status=PENDING&${confirmation}`);
  await expect(rows(page)).toHaveCount(1);
  await expect(page.getByText("Payment confirmed. All orders in your group have been paid.", { exact: true })).toHaveCount(0);
});

test("problem detail is displayed and a retry reloads orders", async ({ page, request }) => {
  await mode(request, "unavailable");
  await signIn(page);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Orders are temporarily unavailable. Please try again.");
  await expect(rows(page)).toHaveCount(0);
  await mode(request, "success");
  await page.getByRole("button", { name: /retry orders/i }).click();
  await expect(rows(page)).toHaveCount(3);
});

test("pending order without a group cannot navigate to an invented payment", async ({ page, request }) => {
  await mode(request, "missing-group");
  await signIn(page);
  const pending = page.getByTestId(`order-row-${pendingId}`);
  await expect(pending).toBeVisible();
  await expect(pending.getByRole("link", { name: "Pay Now", exact: true })).toHaveCount(0);
  await expect(pending.getByRole("button", { name: "Pay Now", exact: true })).toBeDisabled();
});

test("commerce 401 refreshes once then asks for sign-in without another query retry", async ({ page, request }) => {
  await mode(request, "unauthenticated");
  await signIn(page, "/orders?status=PENDING");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Your order session has expired. Sign in again.");
  await expect(page.getByRole("button", { name: /retry orders/i })).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute("href", `/sign-in?returnTo=${encodeURIComponent("/orders?status=PENDING")}`);
  expect((await evidence(request)).reads).toHaveLength(2);
  const authEvidence = await request.get(`${provider}/api/test/evidence`);
  expect(authEvidence.ok()).toBe(true);
  expect((await authEvidence.json()).sessionRefreshes).toBe(1);
});

test("375x812 long order numbers wrap without horizontal scrolling or clipped text", async ({ page, request }, info) => {
  await mode(request, "long-number");
  await signIn(page);
  await expect(rows(page)).toHaveCount(3);
  expect(page.viewportSize()).toEqual({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const clipped = await page.locator("header :visible, main :visible, footer :visible").evaluateAll((elements) =>
    elements.filter((element) => element instanceof HTMLElement && element.clientWidth > 0 &&
      element.scrollWidth > element.clientWidth + 1 && !element.closest("script,style,svg,pre,.sr-only"))
      .map((element) => element.textContent?.trim()).filter(Boolean),
  );
  expect(clipped).toEqual([]);
  await expect(page.getByTestId(`order-row-${pendingId}`).getByRole("link", { name: "Pay Now", exact: true })).toBeVisible();
  await capture(page, info, "orders-mobile-long-number-375x812.png");
  await page.setViewportSize({ width: 1024, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const clippedAtTablet = await page.locator("header :visible, main :visible, footer :visible").evaluateAll((elements) =>
    elements.filter((element) => element instanceof HTMLElement && element.clientWidth > 0 &&
      element.scrollWidth > element.clientWidth + 1 && !element.closest("script,style,svg,pre,.sr-only"))
      .map((element) => element.textContent?.trim()).filter(Boolean),
  );
  expect(clippedAtTablet).toEqual([]);
});
