import { test, expect, type APIRequestContext, type Page, type Request, type TestInfo } from "@playwright/test";

test.skip(!process.env.NEXUS_ORDER_LIST_TEST, "Run with playwright.orders.config.ts for the order HTTP simulation.");

const simulation = `http://127.0.0.1:${process.env.NEXUS_ORDER_LIST_PORT || "3914"}/api`;
const provider = `http://127.0.0.1:${process.env.NEXUS_TEST_PROVIDER_PORT || process.env.NEXUS_OIDC_SIM_PORT || "3913"}`;
const paidId = "68000000-0000-4000-8000-000000000001";
const pendingId = "68000000-0000-4000-8000-000000000002";
const foreignId = "68000000-0000-4000-8000-000000000099";
const pendingGroupId = "c8000000-0000-4000-8000-000000000102";

async function control(request: APIRequestContext, endpoint: string) {
  expect((await request.get(`${simulation}/test/${endpoint}`)).ok()).toBe(true);
}

async function evidence(request: APIRequestContext) {
  const response = await request.get(`${simulation}/test/evidence`);
  expect(response.ok()).toBe(true);
  return response.json();
}

async function signIn(page: Page, destination = "/orders") {
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(destination)}`);
  await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/keycloak\/realms\/nexus\/protocol\/openid-connect\/auth\?/);
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("buyer@nexus.local");
  await page.getByLabel("Password", { exact: true }).fill("Fixture-pass-123!");
  await page.getByRole("button", { name: "Sign in at Keycloak", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${destination}$`));
}

async function capture(page: Page, info: TestInfo, filename: string) {
  const output = info.outputPath(filename);
  await page.screenshot({ path: output, fullPage: true, style: "nextjs-portal { visibility: hidden !important; }" });
  await info.attach(filename, { path: output, contentType: "image/png" });
}

async function assertNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const clipped = await page.locator("header :visible, main :visible, footer :visible").evaluateAll((elements) =>
    elements.filter((element) => element instanceof HTMLElement && element.clientWidth > 0 &&
      element.scrollWidth > element.clientWidth + 1 && !element.closest("script,style,svg,pre,.sr-only"))
      .map((element) => element.textContent?.trim()).filter(Boolean),
  );
  expect(clipped).toEqual([]);
}

async function cancel(page: Page, reason = "Changed my mind") {
  await page.getByRole("button", { name: "Cancel order", exact: true }).click();
  await page.getByLabel("Why do you want to cancel?", { exact: true }).fill(reason);
  await page.getByRole("button", { name: "Confirm cancellation", exact: true }).click();
}

test.beforeEach(async ({ page, request }) => {
  expect((await request.get(`${provider}/keycloak/test/reset`)).ok()).toBe(true);
  expect((await request.get(`${provider}/api/test/reset`)).ok()).toBe(true);
  await control(request, "reset");
  // Cart rendering in the shared shell is outside the order dependency under test.
  await page.route("**/api/v1/carts/me", (route) => route.fulfill({ json: {
    code: 0, message: "response success", data: {
      id: "order-header-cart", userId: "68000000-0000-4000-8000-000000000003", status: "ACTIVE", items: [],
    },
  } }));
});

test("signed-out detail does not request private order data", async ({ page, request }) => {
  await page.goto(`/order/${pendingId}`);
  await expect(page.getByRole("heading", { name: "Sign in to view your order", exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Sign in", exact: true }))
    .toHaveAttribute("href", `/sign-in?returnTo=${encodeURIComponent(`/order/${pendingId}`)}`);
  const calls = await evidence(request);
  expect(calls.details).toEqual([]);
  expect(calls.histories).toEqual([]);
});

test("list opens a snapshot with lines, total, status and history on desktop and mobile", async ({ page, request }, info) => {
  await page.setViewportSize({ width: 1440, height: 1060 });
  await signIn(page);
  await page.getByTestId(`order-row-${pendingId}`).getByRole("link", { name: "NX-260929-0038", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Order NX-260929-0038", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Order items", exact: true })).toContainText("Rolex Submariner Watch");
  await expect(page.getByRole("region", { name: "Order items", exact: true })).toContainText("SILVER");
  await expect(page.getByRole("region", { name: "Order items", exact: true })).toContainText("Qty 1");
  await expect(page.getByRole("complementary", { name: "Order receipt", exact: true })).toContainText("9.854.900,00 ₫");
  await expect(page.getByRole("complementary", { name: "Order receipt", exact: true })).toContainText("To Pay");
  await expect(page.getByRole("region", { name: "Order history", exact: true })).toContainText("Order created from cart");
  await expect(page.getByRole("link", { name: "Pay now", exact: true })).toHaveAttribute("href", `/checkout/payment/${pendingGroupId}`);
  const calls = await evidence(request);
  expect(calls.details).toContainEqual({ method: "GET", orderId: pendingId, authorized: true });
  expect(calls.histories).toContainEqual({ method: "GET", orderId: pendingId, authorized: true });
  await assertNoOverflow(page);
  await capture(page, info, "order-detail-desktop-1440.png");
  await page.setViewportSize({ width: 375, height: 812 });
  await assertNoOverflow(page);
  await capture(page, info, "order-detail-mobile-375x812.png");
});

test("pending cancellation posts one trimmed reason and refreshes order and history", async ({ page, request }) => {
  let cartReads = 0;
  page.on("request", (outgoing) => {
    if (outgoing.method() === "GET" && new URL(outgoing.url()).pathname === "/api/v1/carts/me") cartReads += 1;
  });
  await signIn(page, `/order/${pendingId}`);
  await expect(page.getByRole("button", { name: "Cancel order", exact: true })).toBeVisible();
  await expect.poll(() => cartReads).toBeGreaterThan(0);
  const initialCartReads = cartReads;
  await cancel(page, "  Changed my mind  ");
  await expect(page.getByRole("status").filter({ hasText: "Your cancellation request was processed." })).toBeVisible();
  await expect(page.getByRole("region", { name: "Order history", exact: true })).toContainText("Changed my mind");
  await expect(page.getByRole("complementary", { name: "Order receipt", exact: true })).toContainText("Cancelled");
  await expect(page.getByRole("button", { name: "Cancel order", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Pay now", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Refund status", exact: true })).toHaveCount(0);
  const calls = await evidence(request);
  expect(calls.cancellations).toEqual([{ method: "POST", orderId: pendingId, authorized: true,
    body: { reason: "Changed my mind" }, contentType: "application/json" }]);
  expect(calls.details.length).toBeGreaterThanOrEqual(2);
  expect(calls.histories.length).toBeGreaterThanOrEqual(2);
  await expect.poll(() => cartReads).toBeGreaterThan(initialCartReads);
  await page.getByRole("link", { name: "All orders", exact: true }).click();
  await expect(page.getByTestId(`order-row-${pendingId}`)).toContainText("Cancelled");
});

test("paid cancellation displays awaiting, requested and completed refund states", async ({ page, request }, info) => {
  await signIn(page, `/order/${paidId}`);
  await expect(page.getByRole("region", { name: "Order history", exact: true })).toContainText("Payment confirmed");
  await cancel(page, "Please refund this purchase");
  const refund = page.getByRole("region", { name: "Refund status", exact: true });
  await expect(refund).toContainText("Awaiting refund");
  await expect(page.getByRole("button", { name: "Cancel order", exact: true })).toHaveCount(0);
  await control(request, `order?id=${paidId}&status=REFUND_REQUESTED`);
  await page.getByRole("button", { name: "Refresh refund status", exact: true }).click();
  await expect(refund).toContainText("Refund requested");
  await assertNoOverflow(page);
  await capture(page, info, "order-detail-refund-mobile-375x812.png");
  await control(request, `order?id=${paidId}&status=REFUNDED`);
  await page.getByRole("button", { name: "Refresh refund status", exact: true }).click();
  await expect(refund).toContainText("Refunded");
  await expect(page.getByRole("region", { name: "Order history", exact: true })).toContainText("Order moved to REFUNDED");
  expect((await evidence(request)).cancellations).toHaveLength(1);
});

for (const status of ["PENDING", "PAID"] as const) {
  test(`${status} without backend cancellation permission hides the action`, async ({ page, request }) => {
    await control(request, `order?id=${pendingId}&status=${status}&canCancel=false`);
    await signIn(page, `/order/${pendingId}`);
    await expect(page.getByRole("heading", { name: "Order NX-260929-0038", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel order", exact: true })).toHaveCount(0);
    expect((await evidence(request)).cancellations).toEqual([]);
  });
}

test("older detail without canCancel fails closed", async ({ page, request }) => {
  await control(request, `order?id=${pendingId}&omitCanCancel=true`);
  await signIn(page, `/order/${pendingId}`);
  await expect(page.getByRole("heading", { name: "Order NX-260929-0038", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel order", exact: true })).toHaveCount(0);
});

for (const status of ["SHIPPED", "DELIVERED", "COMPLETED", "CANCELED", "REFUND_REQUESTED", "REFUNDED"] as const) {
  test(`${status} order has no cancellation action`, async ({ page, request }) => {
    await control(request, `order?id=${pendingId}&status=${status}`);
    await signIn(page, `/order/${pendingId}`);
    await expect(page.getByRole("heading", { name: "Order NX-260929-0038", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel order", exact: true })).toHaveCount(0);
  });
}

test("409 keeps the backend message, refreshes stale eligibility and never retries cancellation", async ({ page, request }) => {
  await control(request, "detail-mode?mode=cancel-conflict");
  await signIn(page, `/order/${pendingId}`);
  await cancel(page);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("This order has shipped and can no longer be cancelled.");
  await expect(page.getByRole("complementary", { name: "Order receipt", exact: true })).toContainText("Shipping");
  await expect(page.getByRole("button", { name: "Cancel order", exact: true })).toHaveCount(0);
  expect((await evidence(request)).cancellations).toHaveLength(1);
});

test("another buyer's order displays the 403 message without requesting history", async ({ page, request }, info) => {
  const detailPath = `/api/v1/orders/${foreignId}`;
  const detailAttempts: { request: Request; afterForbidden: boolean }[] = [];
  let forbiddenReceived = false;
  page.on("request", (outgoing) => {
    if (new URL(outgoing.url()).pathname === detailPath)
      detailAttempts.push({ request: outgoing, afterForbidden: forbiddenReceived });
  });
  page.on("response", (response) => {
    if (new URL(response.url()).pathname === detailPath && response.status() === 403) forbiddenReceived = true;
  });
  await signIn(page, `/order/${foreignId}`);
  await expect(page.getByRole("heading", { name: "You cannot view this order", exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("You do not have access to this order.");
  await expect(page.getByRole("link", { name: "All orders", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry order", exact: true })).toHaveCount(0);
  await assertNoOverflow(page);
  await capture(page, info, "order-detail-forbidden-mobile-375x812.png");
  const outcomes = await Promise.all(detailAttempts.map(async (attempt) => {
    const response = await attempt.request.response();
    const responseFailure = response ? await response.finished() : null;
    return { status: response?.status() ?? null,
      failure: attempt.request.failure()?.errorText ?? responseFailure?.message ?? null,
      afterForbidden: attempt.afterForbidden };
  }));
  await info.attach("forbidden-request-outcomes", { body: JSON.stringify(outcomes), contentType: "application/json" });
  // Next dev replays the mount effect and can abort its first transport after it
  // reaches the mock. Exactly one completed 403, with no request started after
  // that response, verifies no retry without mistaking cancellation for a retry.
  const completed = outcomes.filter((outcome) => outcome.failure === null);
  expect(completed).toEqual([{ status: 403, failure: null, afterForbidden: false }]);
  for (const aborted of outcomes.filter((outcome) => outcome.failure !== null)) {
    expect(aborted).toEqual({ status: null, failure: "net::ERR_ABORTED", afterForbidden: false });
  }
  const calls = await evidence(request);
  expect(calls.details).toEqual(Array.from({ length: calls.details.length }, () => ({
    method: "GET", orderId: foreignId, authorized: true,
  })));
  // A cancelled transport can stop before the mock receives it.
  expect(calls.details.length).toBeGreaterThanOrEqual(completed.length);
  expect(calls.details.length).toBeLessThanOrEqual(outcomes.length);
  expect(calls.histories).toEqual([]);
});

test("history failure preserves the snapshot and retries independently", async ({ page, request }) => {
  await control(request, "detail-mode?mode=history-unavailable");
  await signIn(page, `/order/${pendingId}`);
  await expect(page.getByRole("region", { name: "Order items", exact: true })).toContainText("Rolex Submariner Watch");
  await expect(page.getByRole("region", { name: "Order history", exact: true }).getByRole("alert"))
    .toContainText("Order updates are temporarily unavailable.");
  expect((await evidence(request)).histories).toHaveLength(1);
  await control(request, "detail-mode?mode=success");
  await page.getByRole("button", { name: "Retry updates", exact: true }).click();
  await expect(page.getByRole("region", { name: "Order history", exact: true })).toContainText("Order created from cart");
  expect((await evidence(request)).histories).toHaveLength(2);
});

test("order failure has a retry and only requests history after recovery", async ({ page, request }) => {
  await control(request, "detail-mode?mode=detail-unavailable");
  await signIn(page, `/order/${pendingId}`);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("This order is temporarily unavailable.");
  const failedCalls = await evidence(request);
  expect(failedCalls.histories).toEqual([]);
  await control(request, "detail-mode?mode=success");
  await page.getByRole("button", { name: "Retry order", exact: true }).click();
  await expect(page.getByRole("region", { name: "Order history", exact: true })).toContainText("Order created from cart");
  // The initial dev mount may include a cancelled transport. The explicit
  // retry must add exactly one request to that observed baseline.
  expect((await evidence(request)).details).toHaveLength(failedCalls.details.length + 1);
});
