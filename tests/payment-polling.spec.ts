import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const simulation = "http://127.0.0.1:3914";
const groupId = "a1000000-0000-4000-8000-000000000001";
const orderIds = ["a2000000-0000-4000-8000-000000000001", "a2000000-0000-4000-8000-000000000002"];
const paymentPath = `/checkout/payment/${groupId}`;
const confirmationPath = `/orders?payment=confirmed&groupId=${groupId}`;

type PollEvidence = {
  groupRequests: { method: string; groupId: string; at: number }[];
  authenticatedGroups: number;
  orderPatches: { orderId: string; status: string }[];
  orderListRequests: number;
};

async function evidence(request: APIRequestContext): Promise<PollEvidence> {
  const response = await request.get(`${simulation}/api/test/evidence`);
  expect(response.ok()).toBe(true);
  return response.json();
}

async function orderMode(request: APIRequestContext, mode: string, delay = 0) {
  expect((await request.get(`${simulation}/api/test/order-mode?mode=${mode}&delay=${delay}`)).ok()).toBe(true);
}

async function changeOrder(request: APIRequestContext, index: number, status: "PAID" | "CANCELED") {
  const response = await request.patch(`${simulation}/api/v1/orders/${orderIds[index]}/status`, {
    headers: { Authorization: "Bearer fixture-admin" },
    data: { status, reason: "Local polling acceptance trigger" },
  });
  expect(response.ok()).toBe(true);
  expect((await response.json()).data.status).toBe(status);
}

async function signIn(page: Page) {
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(paymentPath)}`);
  await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("buyer@nexus.local");
  await page.getByLabel("Password", { exact: true }).fill("Fixture-pass-123!");
  await page.getByRole("button", { name: "Sign in at Keycloak", exact: true }).click();
  await expect(page).toHaveURL(paymentPath);
  await expect(page.getByRole("heading", { name: "Payment", exact: true })).toBeVisible();
}

async function ready(page: Page, request: APIRequestContext) {
  await signIn(page);
  await expect(page.getByRole("img", { name: "Payment QR code", exact: true })).toBeVisible();
  await expect.poll(async () => (await evidence(request)).groupRequests.length).toBeGreaterThan(0);
}

async function visibility(page: Page, hidden: boolean) {
  // Chrome's headless tab focus is not an OS visibility signal. Replace only
  // the browser visibility boundary; HTTP, the app and elapsed time stay real.
  await page.evaluate((value) => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => value });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => value ? "hidden" : "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
}

test.beforeEach(async ({ request }) => {
  expect((await request.get(`${simulation}/keycloak/test/reset`)).ok()).toBe(true);
  expect((await request.get(`${simulation}/api/test/reset`)).ok()).toBe(true);
});

test("polls child statuses every three seconds and confirms only after every order is PAID", async ({ page, request }, info) => {
  // Warm compilation outside the measured poll-to-navigation window.
  expect((await request.get("http://127.0.0.1:3104/orders")).ok()).toBe(true);
  await ready(page, request);
  const baseline = (await evidence(request)).groupRequests.length;
  await expect.poll(async () => (await evidence(request)).groupRequests.length).toBeGreaterThanOrEqual(baseline + 2);
  const calls = await evidence(request);
  expect(calls.groupRequests.every((call) => call.method === "GET" && call.groupId === groupId)).toBe(true);
  expect(calls.authenticatedGroups).toBe(calls.groupRequests.length);
  const steady = calls.groupRequests.slice(-3);
  for (let index = 1; index < steady.length; index += 1) {
    expect(steady[index].at - steady[index - 1].at).toBeGreaterThanOrEqual(2700);
    expect(steady[index].at - steady[index - 1].at).toBeLessThan(3500);
  }
  await changeOrder(request, 0, "PAID");
  const partial = (await evidence(request)).groupRequests.length;
  await expect.poll(async () => (await evidence(request)).groupRequests.length).toBeGreaterThan(partial);
  await expect(page).toHaveURL(paymentPath);
  await expect(page.getByRole("img", { name: "Payment QR code" })).toBeVisible();
  await changeOrder(request, 1, "PAID");
  const paidAt = performance.now();
  // Wait on the navigation event itself: repeated URL assertions can return
  // after their polling backoff even when navigation happened inside 3 seconds.
  await page.waitForURL(confirmationPath, { timeout: 3000 });
  expect(performance.now() - paidAt).toBeLessThan(3000);
  await expect(page.getByRole("status").filter({ hasText: "Payment confirmed. All orders in your group have been paid." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your orders", exact: true })).toBeVisible();
  await expect.poll(async () => (await evidence(request)).orderListRequests).toBeGreaterThan(0);
  for (const orderNumber of ["NX-20261104-0001", "NX-20261104-0002"]) {
    const row = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: orderNumber, exact: true }) });
    await expect(row.getByText("PAID", { exact: true })).toBeVisible();
  }
  const screenshotPath = info.outputPath("payment-confirmed.png");
  await page.screenshot({ path: screenshotPath, fullPage: true, style: "nextjs-portal { visibility: hidden !important; }" });
  await info.attach("payment-confirmed", { path: screenshotPath, contentType: "image/png" });
  const stoppedAt = (await evidence(request)).groupRequests.length;
  await page.waitForTimeout(3400);
  expect((await evidence(request)).groupRequests).toHaveLength(stoppedAt);
  expect((await evidence(request)).orderPatches).toEqual(orderIds.map((orderId) => ({ orderId, status: "PAID" })));
});

test("all CANCELED orders show canceled state on the next poll and stop requests", async ({ page, request }, info) => {
  await ready(page, request);
  await changeOrder(request, 0, "CANCELED");
  await changeOrder(request, 1, "CANCELED");
  await expect(page.getByRole("heading", { name: "Payment canceled", exact: true })).toBeVisible({ timeout: 3500 });
  await expect(page).toHaveURL(paymentPath);
  await expect(page.getByRole("img", { name: "Payment QR code" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copy transfer memo" })).toHaveCount(0);
  const screenshotPath = info.outputPath("payment-canceled.png");
  await page.screenshot({ path: screenshotPath, fullPage: true, style: "nextjs-portal { visibility: hidden !important; }" });
  await info.attach("payment-canceled", { path: screenshotPath, contentType: "image/png" });
  const stoppedAt = (await evidence(request)).groupRequests.length;
  await page.waitForTimeout(6400);
  expect((await evidence(request)).groupRequests).toHaveLength(stoppedAt);
});

test("countdown expiry stops polling and returning to a visible tab does not restart it", async ({ page, request }) => {
  expect((await request.get(`${simulation}/api/test/mode?mode=short`)).ok()).toBe(true);
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Payment expired", exact: true })).toBeVisible();
  await expect(page.getByTestId("payment-countdown")).toHaveText("00:00");
  const stoppedAt = (await evidence(request)).groupRequests.length;
  await visibility(page, true);
  await visibility(page, false);
  await page.waitForTimeout(6400);
  expect((await evidence(request)).groupRequests).toHaveLength(stoppedAt);
  await expect(page).toHaveURL(paymentPath);
});

test("a hidden tab sends no polls for thirty real seconds and resumes immediately when visible", async ({ page, request }) => {
  await ready(page, request);
  await visibility(page, true);
  const hiddenAt = (await evidence(request)).groupRequests.length;
  await page.waitForTimeout(30_000);
  expect((await evidence(request)).groupRequests).toHaveLength(hiddenAt);
  await changeOrder(request, 0, "PAID");
  await changeOrder(request, 1, "PAID");
  await expect(page).toHaveURL(paymentPath);
  await visibility(page, false);
  await expect(page).toHaveURL(confirmationPath, { timeout: 3000 });
  await expect(page.getByRole("status").filter({ hasText: "Payment confirmed. All orders in your group have been paid." })).toBeVisible();
});

test("mixed PAID and CANCELED children do not report a terminal group", async ({ page, request }) => {
  await orderMode(request, "mixed");
  await ready(page, request);
  const before = (await evidence(request)).groupRequests.length;
  await expect.poll(async () => (await evidence(request)).groupRequests.length).toBeGreaterThan(before);
  await expect(page).toHaveURL(paymentPath);
  await expect(page.getByRole("img", { name: "Payment QR code" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Payment canceled", exact: true })).toHaveCount(0);
});

test("an empty group is rejected and cannot produce a false confirmation", async ({ page, request }) => {
  await orderMode(request, "empty");
  await ready(page, request);
  await expect(page.getByRole("main").getByRole("alert")).not.toBeEmpty();
  const before = (await evidence(request)).groupRequests.length;
  await page.waitForTimeout(3400);
  expect((await evidence(request)).groupRequests).toHaveLength(before);
  await expect(page).toHaveURL(paymentPath);
  await expect(page.getByText(/Payment confirmed/)).toHaveCount(0);
});

test("polling displays Problem Details and recovers on a later poll without refreshing", async ({ page, request }) => {
  await orderMode(request, "unavailable");
  await ready(page, request);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Order status is temporarily unavailable.");
  await orderMode(request, "success");
  await changeOrder(request, 0, "PAID");
  await changeOrder(request, 1, "PAID");
  await expect(page).toHaveURL(confirmationPath, { timeout: 3500 });
  await expect(page.getByRole("status").filter({ hasText: "Payment confirmed. All orders in your group have been paid." })).toBeVisible();
});

test("an in-flight PAID response cannot navigate while hidden; visibility resumes with a fresh read", async ({ page, request }) => {
  await ready(page, request);
  await changeOrder(request, 0, "PAID");
  await changeOrder(request, 1, "PAID");
  await orderMode(request, "success", 2000);
  const before = (await evidence(request)).groupRequests.length;
  await expect.poll(async () => (await evidence(request)).groupRequests.length).toBeGreaterThan(before);
  await visibility(page, true);
  const hiddenAt = (await evidence(request)).groupRequests.length;
  await page.waitForTimeout(3500);
  await expect(page).toHaveURL(paymentPath);
  expect((await evidence(request)).groupRequests).toHaveLength(hiddenAt);
  await orderMode(request, "success");
  await visibility(page, false);
  await expect(page).toHaveURL(confirmationPath, { timeout: 3000 });
});

test("a PAID response arriving after countdown expiry cannot confirm payment", async ({ page, request }) => {
  expect((await request.get(`${simulation}/api/test/mode?mode=short`)).ok()).toBe(true);
  await changeOrder(request, 0, "PAID");
  await changeOrder(request, 1, "PAID");
  await orderMode(request, "success", 5000);
  await signIn(page);
  await expect.poll(async () => (await evidence(request)).groupRequests.length).toBeGreaterThan(0);
  await expect(page.getByRole("heading", { name: "Payment expired", exact: true })).toBeVisible();
  const stoppedAt = (await evidence(request)).groupRequests.length;
  await page.waitForTimeout(5500);
  expect((await evidence(request)).groupRequests).toHaveLength(stoppedAt);
  await expect(page).toHaveURL(paymentPath);
  await expect(page.getByText(/Payment confirmed/)).toHaveCount(0);
});
