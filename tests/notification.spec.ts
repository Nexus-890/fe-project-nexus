import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { GUEST_CART_STORAGE_KEY } from "../features/guestCartStorage";

const fixtureOrigin = `http://127.0.0.1:${process.env.NEXUS_TEST_API_PORT ?? 3911}`;
const providerOrigin = `http://127.0.0.1:${process.env.NEXUS_TEST_PROVIDER_PORT ?? 3913}/keycloak`;
const sessions = new WeakMap<Page, { authorization: string; account: string }>();
const firstReadPath = "/api/v1/notifications/20000000-0000-4000-8000-000000000001/read";
type NotificationRequest = {
  method: string;
  path: string;
  query: Record<string, string>;
  authorization: string | null;
  canceled: boolean;
};

const evidence = async (request: APIRequestContext): Promise<NotificationRequest[]> =>
  (await request.get(`${fixtureOrigin}/test/notifications/evidence`)).json();

const setCase = async (request: APIRequestContext, query: string) => {
  await request.post(`${fixtureOrigin}/test/notifications/case?${query}`);
};

async function signIn(page: Page, account = "a") {
  // Register every gateway-issued access token, including reload renewal,
  // before the provider loads the profile against the notification fixture.
  // The gateway retains the refresh token in its cookie.
  await page.route(`${fixtureOrigin}/api/v1/auth/{session,refresh}`, async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers()["x-requested-with"]).toBe("nexus-web");
    expect(route.request().headers().authorization).toBeUndefined();
    const response = await route.fetch();
    if (new URL(route.request().url()).pathname.endsWith("/session")) expect(response.ok()).toBe(true);
    if (!response.ok() || response.status() === 204) return route.fulfill({ response });
    const { data: { accessToken } } = await response.json();
    expect(accessToken).toEqual(expect.any(String));
    const registered = await page.request.post(`${fixtureOrigin}/test/notifications/session`, {
      data: { account, accessToken },
    });
    expect(registered.ok()).toBe(true);
    sessions.set(page, { account, authorization: `Bearer ${accessToken}` });
    await route.fulfill({ response });
  });
  await page.goto("/sign-in");
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/keycloak\/realms\/nexus\/protocol\/openid-connect\/auth\?/);
  await page.getByLabel("Email", { exact: true }).fill(`notification-${account}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("Fixture123!");
  await page.getByRole("button", { name: "Sign in at Keycloak", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(`Hi Notification ${account.toUpperCase()}`, { exact: true })).toBeVisible();
  const cookie = (await page.context().cookies(`${fixtureOrigin}/api/v1/auth/refresh`))
    .find((entry) => entry.name === "nexus_rt");
  expect(cookie).toMatchObject({ httpOnly: true, path: "/api/v1/auth" });
  return sessions.get(page)!.authorization;
}

async function signOutAndVerifyCleanup(page: Page, verifyCleanup: () => Promise<void>) {
  const documentStarted = await page.evaluate(() => performance.timeOrigin);
  // Cancel the external redirect so these cleanup assertions use the existing
  // document rather than browser unload; the OIDC suite covers end-session.
  await page.route(`${providerOrigin}/realms/nexus/protocol/openid-connect/logout?*`, async (route) => {
    await route.abort("aborted");
  }, { times: 1 });
  const logoutFailed = page.waitForEvent("requestfailed", (request) =>
    new URL(request.url()).pathname === "/keycloak/realms/nexus/protocol/openid-connect/logout",
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click({ noWaitAfter: true });
  await logoutFailed;
  await expect(page.getByRole("dialog", { name: "Notifications", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Notifications/ })).toHaveCount(0);
  await verifyCleanup();
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentStarted);
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
}

test.beforeEach(async ({ request, page }) => {
  expect((await request.post(`${fixtureOrigin}/test/notifications/reset`)).ok()).toBe(true);
  expect((await request.get(`${providerOrigin}/test/reset`)).ok()).toBe(true);
  // Cart deliberately uses the app's same-origin route. Keep the merged header
  // exercised alongside notifications with its actual scoped Bearer token.
  await page.route("**/api/v1/carts/me", async (route) => {
    expect(route.request().method()).toBe("GET");
    const session = sessions.get(page);
    expect(session).toBeDefined();
    expect(route.request().headers().authorization).toBe(session!.authorization);
    await route.fulfill({ json: { code: 0, message: "response success", data: {
      id: `notification-cart-${session!.account}`,
      userId: `notification-user-${session!.account}`,
      status: "ACTIVE",
      items: [{
        id: "cart-line", productId: "1", skuId: "cart-sku", quantity: 2, unitPrice: 150000,
      }],
    } } });
  });
});

test("anonymous browsing sends no notification request", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator("#categories > ul > li")).toHaveCount(3);
  await expect(page.getByRole("button", { name: /^Notifications/ })).toHaveCount(0);
  await page.locator("#categories").getByRole("link", { name: "Electronics", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(2);
  expect(await evidence(request)).toEqual([]);
});

test("authenticated bell shows latest ten, marks opened notifications read and clears all unread", async ({ page, request }, info) => {
  const authorization = await signIn(page);
  const cart = page.getByRole("link", { name: "Shopping cart, 2 items", exact: true });
  await expect(cart).toBeVisible();
  await expect(cart).toHaveAttribute("href", "/cart");
  const trigger = page.getByRole("button", { name: /^Notifications/ });
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-label", "Notifications, 18 unread");
  const triggerBounds = await trigger.boundingBox();
  expect(triggerBounds?.width).toBeGreaterThanOrEqual(44);
  expect(triggerBounds?.height).toBeGreaterThanOrEqual(44);
  await trigger.focus();
  await trigger.press("Enter");
  const popup = page.getByRole("dialog", { name: "Notifications", exact: true });
  const list = popup.getByRole("list", { name: "Recent notifications" });
  await expect(list.getByRole("listitem")).toHaveCount(10);
  await expect(list.getByRole("listitem").first()).toContainText("A update 24");
  await expect(list.getByRole("listitem").last()).toContainText("A update 15");
  await expect(popup.getByRole("button", { name: "A update 21, read", exact: true })).toHaveAttribute("aria-expanded", "false");
  const markAll = popup.getByRole("button", { name: "Mark all as read", exact: true });
  await expect(markAll).toBeEnabled();
  await expect(popup.getByText("Read status updates are unavailable.", { exact: true })).toHaveCount(0);
  const beforeOpening = await evidence(request);
  expect(new Set(beforeOpening.map((entry) => entry.path))).toEqual(new Set([
    "/api/v1/notifications", "/api/v1/notifications/unread-count",
  ]));
  expect(beforeOpening.every((entry) => entry.method === "GET" && entry.authorization === authorization)).toBe(true);
  expect(beforeOpening.find((entry) => entry.path === "/api/v1/notifications")?.query).toEqual({ page: "0", size: "10" });
  expect(beforeOpening.find((entry) => entry.path.endsWith("/unread-count"))?.query).toEqual({});
  const firstUnread = popup.getByRole("button", { name: "A update 24, unread", exact: true });
  const readResponse = page.waitForResponse((response) =>
    response.request().method() === "PATCH" && new URL(response.url()).pathname === firstReadPath,
  );
  await firstUnread.click();
  expect((await readResponse).status()).toBe(204);
  const firstRead = popup.getByRole("button", { name: "A update 24, read", exact: true });
  await expect(firstRead).toHaveAttribute("aria-expanded", "true");
  await expect(trigger).toHaveAttribute("aria-label", "Notifications, 17 unread");
  await firstRead.click();
  await firstRead.click();
  expect((await evidence(request)).filter((entry) => entry.method === "PATCH")).toEqual([{
    method: "PATCH", path: firstReadPath, query: {}, authorization, canceled: false,
  }]);
  const markAllResponse = page.waitForResponse((response) =>
    response.request().method() === "PATCH" && new URL(response.url()).pathname === "/api/v1/notifications/read-all",
  );
  await markAll.click();
  expect((await markAllResponse).status()).toBe(204);
  await expect(trigger).toHaveAttribute("aria-label", "Notifications");
  await expect(trigger).toHaveText("");
  await expect(list.getByRole("button", { name: /, unread$/ })).toHaveCount(0);
  await expect(markAll).toBeDisabled();
  const afterReadAll = await evidence(request);
  expect(afterReadAll.filter((entry) => entry.method === "PATCH").map((entry) => entry.path)).toEqual([
    firstReadPath, "/api/v1/notifications/read-all",
  ]);
  expect(afterReadAll.every((entry) => entry.authorization === authorization)).toBe(true);
  for (const path of ["/api/v1/notifications", "/api/v1/notifications/unread-count"]) {
    expect(afterReadAll.filter((entry) => entry.path === path)).toHaveLength(
      beforeOpening.filter((entry) => entry.path === path).length + 2,
    );
  }
  const popupBounds = await popup.boundingBox();
  expect(popupBounds?.x).toBeGreaterThanOrEqual(0);
  expect((popupBounds?.x ?? 0) + (popupBounds?.width ?? 0)).toBeLessThanOrEqual(375);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("notification-mobile.png"), fullPage: true });
  await page.keyboard.press("Escape");
  await expect(popup).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await trigger.click();
  await expect(popup).toBeVisible();
  await page.screenshot({ path: info.outputPath("notification-desktop.png"), fullPage: true });
});

test("pending read prevents duplicate actions and allows the next unread notification after completion", async ({ page, request }) => {
  await setCase(request, "read=delayed");
  await signIn(page);
  const trigger = page.getByRole("button", { name: /^Notifications/ });
  await trigger.click();
  const popup = page.getByRole("dialog", { name: "Notifications", exact: true });
  const first = popup.getByRole("button", { name: "A update 24, unread", exact: true });
  const second = popup.getByRole("button", { name: "A update 23, unread", exact: true });
  await first.click();
  await expect(popup.getByRole("button", { name: "Mark all as read", exact: true })).toBeDisabled();
  await expect(first).toBeDisabled();
  await expect(second).toBeDisabled();
  await expect(second).toHaveAttribute("aria-expanded", "false");
  expect((await evidence(request)).filter((entry) => entry.method === "PATCH")).toHaveLength(1);
  await expect(trigger).toHaveAttribute("aria-label", "Notifications, 18 unread");
  await request.post(`${fixtureOrigin}/test/notifications/release`);
  await expect(trigger).toHaveAttribute("aria-label", "Notifications, 17 unread");
  await setCase(request, "read=default");
  await expect(second).toBeEnabled();
  await second.click();
  await expect(popup.getByRole("button", { name: "A update 23, read", exact: true })).toHaveAttribute("aria-expanded", "true");
  await expect(trigger).toHaveAttribute("aria-label", "Notifications, 16 unread");
});

test("failed read preserves unread state and can be retried by reopening the notification", async ({ page, request }) => {
  await setCase(request, "read=error");
  await signIn(page);
  const trigger = page.getByRole("button", { name: /^Notifications/ });
  await trigger.click();
  const popup = page.getByRole("dialog", { name: "Notifications", exact: true });
  const first = popup.getByRole("button", { name: "A update 24, unread", exact: true });
  await first.click();
  await expect(popup.getByText("Unable to update read status. Please try again.", { exact: true })).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-label", "Notifications, 18 unread");
  await expect(first).toHaveAttribute("aria-expanded", "true");
  expect((await evidence(request)).filter((entry) => entry.method === "PATCH")).toHaveLength(1);
  await setCase(request, "read=default");
  await first.click();
  await first.click();
  await expect(popup.getByRole("button", { name: "A update 24, read", exact: true })).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-label", "Notifications, 17 unread");
  await expect(popup.getByRole("alert")).toHaveCount(0);
});

test("failed mark-all preserves unread state and a successful retry clears the full inbox", async ({ page, request }) => {
  await setCase(request, "readAll=error");
  const authorization = await signIn(page);
  const trigger = page.getByRole("button", { name: /^Notifications/ });
  await trigger.click();
  const popup = page.getByRole("dialog", { name: "Notifications", exact: true });
  const markAll = popup.getByRole("button", { name: "Mark all as read", exact: true });
  await markAll.click();
  await expect(popup.getByText("Unable to update read status. Please try again.", { exact: true })).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-label", "Notifications, 18 unread");
  await expect(popup.getByRole("button", { name: "A update 24, unread", exact: true })).toBeVisible();
  expect((await evidence(request)).filter((entry) => entry.method === "PATCH")).toHaveLength(1);
  await setCase(request, "readAll=default");
  await markAll.click();
  await expect(trigger).toHaveAttribute("aria-label", "Notifications");
  await expect(markAll).toBeDisabled();
  await expect(popup.getByRole("button", { name: /, unread$/ })).toHaveCount(0);
  await expect(popup.getByRole("alert")).toHaveCount(0);
  const response = await request.get(`${fixtureOrigin}/api/v1/notifications?page=1&size=10`, {
    headers: { Authorization: authorization },
  });
  const { data } = await response.json();
  expect(data).toHaveLength(10);
  expect(data.every((item: { readAt: string | null }) => item.readAt !== null)).toBe(true);
});

test("an empty inbox has no unread badge", async ({ page, request }) => {
  await setCase(request, "list=empty&count=zero");
  await signIn(page);
  const trigger = page.getByRole("button", { name: "Notifications", exact: true });
  await trigger.click();
  const popup = page.getByRole("dialog", { name: "Notifications", exact: true });
  await expect(popup.getByText("No notifications yet.", { exact: true })).toBeVisible();
  await expect(popup.getByRole("list")).toHaveCount(0);
  await expect(popup.getByRole("button", { name: "Mark all as read", exact: true })).toBeDisabled();
  await expect(trigger).toHaveText("");
});

test("large unread count keeps the full accessible count and caps its badge", async ({ page, request }) => {
  await setCase(request, "count=large");
  await signIn(page);
  const trigger = page.getByRole("button", { name: "Notifications, 125 unread", exact: true });
  await expect(trigger).toHaveText("99+");
});

test("notification list failure can retry while the valid unread count remains visible", async ({ page, request }) => {
  await setCase(request, "list=error");
  await signIn(page);
  await page.getByRole("button", { name: "Notifications, 18 unread", exact: true }).click();
  const popup = page.getByRole("dialog", { name: "Notifications", exact: true });
  await expect(popup.getByText("Unable to load notifications.", { exact: true })).toBeVisible();
  await setCase(request, "list=default");
  await popup.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(popup.getByRole("listitem")).toHaveCount(10);
  await expect(popup.getByText("Unable to load notifications.", { exact: true })).toHaveCount(0);
});

test("malformed notification data displays a recoverable error", async ({ page, request }) => {
  await setCase(request, "list=malformed");
  await signIn(page);
  await page.getByRole("button", { name: "Notifications, 18 unread", exact: true }).click();
  const popup = page.getByRole("dialog", { name: "Notifications", exact: true });
  await expect(popup.getByText("Unable to load notifications.", { exact: true })).toBeVisible();
  await expect(popup.getByRole("listitem")).toHaveCount(0);
  await setCase(request, "list=default");
  await popup.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(popup.getByRole("listitem")).toHaveCount(10);
});

test("unread count failure preserves the list and offers retry", async ({ page, request }) => {
  await setCase(request, "count=error");
  await signIn(page);
  const trigger = page.getByRole("button", { name: "Notifications", exact: true });
  await trigger.click();
  const popup = page.getByRole("dialog", { name: "Notifications", exact: true });
  await expect(popup.getByRole("listitem")).toHaveCount(10);
  await expect(popup.getByText("The unread count is temporarily unavailable.", { exact: true })).toBeVisible();
  await expect(trigger).toHaveText("");
  await setCase(request, "count=default");
  await popup.getByRole("button", { name: "Retry unread count", exact: true }).click();
  await expect(page.getByRole("button", { name: "Notifications, 18 unread", exact: true })).toBeVisible();
  await expect(popup.getByText("The unread count is temporarily unavailable.", { exact: true })).toHaveCount(0);
  await expect(popup.getByRole("listitem")).toHaveCount(10);
});

test("logout cancels a pending inbox and a late old response cannot enter the next account", async ({ page, request }) => {
  await setCase(request, "list=delayed");
  await signIn(page);
  await page.getByRole("button", { name: "Notifications, 18 unread", exact: true }).click();
  const popup = page.getByRole("dialog", { name: "Notifications", exact: true });
  await expect(popup.getByText("Loading notifications…", { exact: true })).toBeVisible();
  await signOutAndVerifyCleanup(page, async () => {
    await expect.poll(async () => (await evidence(request)).some((entry) => entry.path === "/api/v1/notifications" && entry.canceled)).toBe(true);
  });
  const anonymousEvidence = await evidence(request);
  await page.getByRole("link", { name: "Nexus home", exact: true }).click();
  await expect(page.locator("#categories > ul > li")).toHaveCount(3);
  expect(await evidence(request)).toEqual(anonymousEvidence);
  await setCase(request, "list=default");
  const authorization = await signIn(page, "b");
  await page.getByRole("button", { name: "Notifications, 18 unread", exact: true }).click();
  await expect(popup.getByRole("listitem")).toHaveCount(10);
  await expect(popup.getByRole("button", { name: "B update 24, unread", exact: true })).toBeVisible();
  await request.post(`${fixtureOrigin}/test/notifications/release`);
  await expect(popup.getByRole("button", { name: /^A update/ })).toHaveCount(0);
  const accountRequests = (await evidence(request)).slice(anonymousEvidence.length);
  expect(new Set(accountRequests.map((entry) => entry.path))).toEqual(new Set([
    "/api/v1/notifications", "/api/v1/notifications/unread-count",
  ]));
  expect(accountRequests.every((entry) => entry.authorization === authorization)).toBe(true);
});

test("logout cancels a pending read and a late mutation cannot change the next account", async ({ page, request }) => {
  await setCase(request, "read=delayed");
  await signIn(page);
  await page.getByRole("button", { name: "Notifications, 18 unread", exact: true }).click();
  const popup = page.getByRole("dialog", { name: "Notifications", exact: true });
  await popup.getByRole("button", { name: "A update 24, unread", exact: true }).click();
  await expect.poll(async () => (await evidence(request)).some((entry) => entry.method === "PATCH")).toBe(true);
  await signOutAndVerifyCleanup(page, async () => {
    await expect.poll(async () => (await evidence(request)).some((entry) => entry.path === firstReadPath && entry.canceled)).toBe(true);
  });
  const anonymousEvidence = await evidence(request);
  await page.getByRole("link", { name: "Nexus home", exact: true }).click();
  await expect(page.locator("#categories > ul > li")).toHaveCount(3);
  await expect(page.getByRole("button", { name: /^Notifications/ })).toHaveCount(0);
  expect(await evidence(request)).toEqual(anonymousEvidence);
  await setCase(request, "read=default");
  const authorization = await signIn(page, "b");
  const trigger = page.getByRole("button", { name: "Notifications, 18 unread", exact: true });
  await trigger.click();
  await expect(popup.getByRole("button", { name: "B update 24, unread", exact: true })).toBeVisible();
  await request.post(`${fixtureOrigin}/test/notifications/release`);
  await expect(trigger).toBeVisible();
  await expect(popup.getByRole("button", { name: /^A update/ })).toHaveCount(0);
  await expect(popup.getByRole("alert")).toHaveCount(0);
  const accountRequests = (await evidence(request)).slice(anonymousEvidence.length);
  expect(accountRequests.every((entry) => entry.method === "GET" && entry.authorization === authorization)).toBe(true);
});

test("account notification page paginates, filters and shares read state with the header", async ({ page, request }) => {
  await signIn(page);
  await page.goto("/notifications");
  await expect(page.getByRole("heading", { name: "Notifications", exact: true })).toBeVisible();
  const list = page.getByRole("list", { name: "Account notifications", exact: true });
  await expect(list.getByRole("button")).toHaveCount(10);
  await list.getByRole("button").first().click();
  await expect(page.getByRole("main")).toContainText("17 unread");
  await expect(page.getByRole("button", { name: "Notifications, 17 unread", exact: true })).toBeVisible();
  await page.getByRole("navigation", { name: "Notification categories", exact: true }).getByRole("button", { name: "Auctions", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No notifications found", exact: true })).toBeVisible();
  await page.getByRole("navigation", { name: "Notification categories", exact: true }).getByRole("button", { name: "Orders", exact: true }).click();
  await expect(list.getByRole("button")).toHaveCount(10);
  await page.getByRole("navigation", { name: "Notification pagination", exact: true }).getByRole("link", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/\/notifications\?page=2$/);
  await expect.poll(async () => (await evidence(request)).some((entry) => entry.path === "/api/v1/notifications" && entry.query.page === "1" && entry.query.size === "10")).toBe(true);
  await page.getByRole("main").getByRole("button", { name: "Mark All as Read", exact: true }).click();
  await expect(page.getByRole("main")).toContainText("0 unread");
  await expect(page.getByRole("main").getByRole("button", { name: "Mark All as Read", exact: true })).toBeDisabled();
  await page.getByRole("link", { name: "Notification preferences", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Notification Preferences", exact: true })).toBeVisible();
});

test("full notification page shows real errors and retries without replacing them with samples", async ({ page, request }) => {
  await signIn(page);
  await setCase(request, "list=error");
  await page.goto("/notifications?page=2");
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("list", { name: "Account notifications", exact: true })).toHaveCount(0);
  await setCase(request, "list=default");
  await page.getByRole("button", { name: "Retry notifications", exact: true }).click();
  await expect(page.getByRole("list", { name: "Account notifications", exact: true }).getByRole("button")).toHaveCount(10);
});

test("order detail reads snapshot and history, validates cancellation and refreshes server status", async ({ page }) => {
  const orderId = "68000000-0000-4000-8000-000000000001";
  const buyerId = "10000000-0000-4000-8000-000000000001";
  let status = "PAID";
  const order = () => ({ orderId, orderNumber: "NX-FIXTURE-0001", userId: buyerId, sellerId: "28000000-0000-4000-8000-000000000001", orderType: "STANDARD", status, createdAt: "2026-11-11T01:00:00Z", totalAmount: 100000.25, items: [{ orderItemId: "38000000-0000-4000-8000-000000000001", productId: "48000000-0000-4000-8000-000000000001", skuId: "58000000-0000-4000-8000-000000000001", productName: "Snapshot trainers", skuCode: "US-9", imageUrl: null, quantity: 1, unitPrice: 100000.25, totalPrice: 100000.25 }] });
  const cancellations: unknown[] = [];
  await signIn(page);
  await page.route(`**/api/v1/orders/${orderId}**`, async (route) => {
    expect(route.request().headers().authorization).toBe(sessions.get(page)!.authorization);
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/history")) return route.fulfill({ json: { code: 0, message: "response success", data: [{ id: "98000000-0000-4000-8000-000000000001", previousStatus: null, newStatus: status, reason: "Fixture order state", changedBy: buyerId, createdAt: "2026-11-11T01:00:00Z" }], page: { number: 0, size: 1, totalElements: 1, totalPages: 1 } } });
    if (pathname.endsWith("/cancel")) {
      expect(route.request().method()).toBe("POST"); cancellations.push(route.request().postDataJSON()); status = "CANCELED";
      return route.fulfill({ json: { code: 0, message: "response success", data: { orderGroupId: "78000000-0000-4000-8000-000000000001", status, totalAmount: 100000.25, currency: "VND", dueAt: "2026-11-11T02:00:00Z", orders: [order()] } } });
    }
    return route.fulfill({ json: { code: 0, message: "response success", data: order() } });
  });
  await page.goto(`/orders/${orderId}`);
  await expect(page.getByRole("heading", { name: "Order NX-FIXTURE-0001", exact: true })).toBeVisible();
  await expect(page.getByText("Snapshot trainers", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Delivery status", exact: true })).toContainText("Fixture order state");
  await page.getByRole("button", { name: "Cancel Order", exact: true }).click();
  const confirm = page.getByRole("button", { name: "Confirm cancellation", exact: true });
  await expect(confirm).toBeDisabled();
  await page.getByLabel("Reason for cancellation", { exact: true }).fill("Changed my mind");
  await confirm.click();
  await expect(page.getByRole("status")).toContainText("Cancellation processed by the server.");
  await expect(page.getByRole("button", { name: "Cancel Order", exact: true })).toBeDisabled();
  expect(cancellations).toEqual([{ reason: "Changed my mind" }]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("seller-only callback completes without buyer cart calls or consuming saved guest items", async ({ page }) => {
  const saved = JSON.stringify({ token: "saved-guest-cart-credential-1234567890", mergeKey: "26d81980-257e-4860-98f8-c0ebc97c0474" });
  const cartCalls: string[] = [];
  await page.route("**/api/v1/carts/**", async (route) => { cartCalls.push(route.request().url()); await route.abort(); });
  await page.route(`${fixtureOrigin}/api/v1/users/me`, async (route) => {
    const response = await route.fetch();
    if (!response.ok()) return route.fulfill({ response });
    const body = await response.json();
    body.data.roles = ["SELLER"];
    await route.fulfill({ response, json: body });
  });
  await page.goto("/");
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: GUEST_CART_STORAGE_KEY, value: saved });
  await signIn(page);
  expect(await page.evaluate((key) => localStorage.getItem(key), GUEST_CART_STORAGE_KEY)).toBe(saved);
  await page.getByRole("link", { name: /^Shopping cart(?:, 0 items)?$/ }).click();
  await expect(page.getByRole("heading", { name: "A buyer account is required", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Seller Portal", exact: true })).toHaveAttribute("href", "/seller");
  expect(cartCalls).toEqual([]);
  expect(await page.evaluate((key) => localStorage.getItem(key), GUEST_CART_STORAGE_KEY)).toBe(saved);
});
