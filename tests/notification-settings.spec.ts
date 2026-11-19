import { expect, test, type Page } from "@playwright/test";
import { moderationApi, signInModeration } from "./moderationBrowserHelpers";

const envelope = (data: unknown, page?: unknown) => ({ code: 0, message: "response success", data, page });
const headers = { "access-control-allow-origin": "*", "content-type": "application/json" };
const preferences = [
  { notificationType: "BID_OUTBID", channel: "EMAIL", enabled: true, mandatory: false },
  { notificationType: "BID_OUTBID", channel: "IN_APP", enabled: true, mandatory: false },
  { notificationType: "ORDER_CREATED", channel: "EMAIL", enabled: true, mandatory: true },
  { notificationType: "ORDER_CREATED", channel: "IN_APP", enabled: true, mandatory: true },
];
const row = { id: "delivery-1", notificationId: "notification-1", userId: "68000000-0000-4000-8000-000000000003", type: "BID_OUTBID", title: "Your bid was exceeded", channel: "EMAIL", status: "FAILED", attemptCount: 2, nextAttemptAt: null,
  createdAt: "2026-11-19T01:00:00Z", updatedAt: "2026-11-19T01:05:00Z", lastErrorCode: "SMTP_TIMEOUT" };

async function inboxFixture(page: Page) {
  await page.route(`${moderationApi}/api/v1/notifications`, (route) => route.fulfill({ headers, json: envelope([], { number: 0, size: 10, totalElements: 0, totalPages: 0 }) }));
  await page.route(`${moderationApi}/api/v1/notifications?*`, (route) => route.fulfill({ headers, json: envelope([], { number: 0, size: 10, totalElements: 0, totalPages: 0 }) }));
  await page.route(`${moderationApi}/api/v1/notifications/unread-count`, (route) => route.fulfill({ headers, json: envelope({ count: 0 }) }));
  await page.route(`${moderationApi}/api/v1/notifications/stream`, (route) => route.fulfill({ headers: { ...headers, "content-type": "text/event-stream" }, body: 'event: notifications\ndata: {"unreadCount":0,"revision":"start"}\n\n' }));
}

test.beforeEach(async ({ request }) => {
  expect((await request.get(`${moderationApi}/keycloak/test/reset`)).ok()).toBe(true);
  expect((await request.post(`${moderationApi}/api/test/reset`)).ok()).toBe(true);
});

test("buyer saves optional channels, required choices stay locked and a failed save preserves edits", async ({ page, request }) => {
  await inboxFixture(page);
  let current = structuredClone(preferences), fail = true;
  const writes: unknown[] = [];
  await page.route(`${moderationApi}/api/v1/notifications/preferences`, async (route) => {
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON(); writes.push(body);
      if (fail) { await route.fulfill({ status: 503, headers, json: { title: "Settings unavailable", detail: "Please retry saving your settings." } }); return; }
      current = current.map((entry) => ({ ...entry, enabled: body.preferences.find((change: typeof entry) => change.notificationType === entry.notificationType && change.channel === entry.channel)?.enabled ?? entry.enabled }));
    }
    await route.fulfill({ headers, json: envelope({ preferences: current }) });
  });
  await signInModeration(page, request, "BUYER", "/notifications");
  await expect(page.getByRole("heading", { name: "Notification settings", exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Order Created email", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Order Created email", exact: true })).toBeDisabled();
  const optional = page.getByRole("checkbox", { name: "Bid Outbid email", exact: true });
  await optional.uncheck();
  await page.getByRole("button", { name: "Save preferences", exact: true }).click();
  await expect(page.getByRole("region", { name: "Notification settings", exact: true }).getByRole("alert")).toContainText("Please retry saving");
  await expect(optional).not.toBeChecked();
  fail = false;
  await page.getByRole("button", { name: "Save preferences", exact: true }).click();
  await expect(page.getByText("Notification preferences saved.", { exact: true })).toBeVisible();
  expect(writes).toEqual([1, 2].map(() => ({ preferences: [{ notificationType: "BID_OUTBID", channel: "EMAIL", enabled: false }] })));
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/notification-settings/preferences-${width}.png`, fullPage: true });
  }
});

test("SSE updates the bell without reloading and reconnects with scoped headers", async ({ page, request }) => {
  await inboxFixture(page);
  let received = false, connects = 0;
  const authorization: string[] = [];
  await page.route(`${moderationApi}/api/v1/notifications?*`, (route) => route.fulfill({ headers, json: envelope(received ? [{ id: "notice-1", type: "AUCTION_WON", title: "You won the auction", content: "Continue to your order to pay.", readAt: null, createdAt: "2026-11-19T03:00:00Z" }] : [], { number: 0, size: 10, totalElements: received ? 1 : 0, totalPages: received ? 1 : 0 }) }));
  await page.route(`${moderationApi}/api/v1/notifications/unread-count`, (route) => route.fulfill({ headers, json: envelope({ count: received ? 1 : 0 }) }));
  await page.route(`${moderationApi}/api/v1/notifications/stream`, (route) => {
    connects++; authorization.push(route.request().headers().authorization);
    received = connects >= 2;
    return route.fulfill({ headers: { ...headers, "content-type": "text/event-stream" }, body: `event: notifications\ndata: {"unreadCount":${received ? 1 : 0},"revision":"${received ? "new" : "initial"}"}\n\n` });
  });
  await signInModeration(page, request, "BUYER", "/notifications");
  const origin = await page.evaluate(() => performance.timeOrigin);
  await page.getByRole("button", { name: "Notifications, 1 unread", exact: true }).click();
  await expect(page.getByRole("button", { name: "You won the auction, unread", exact: true })).toBeVisible();
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(origin);
  expect(connects).toBeGreaterThanOrEqual(2);
  expect(authorization.every((value) => value?.startsWith("Bearer "))).toBe(true);
});

test("administrator filters failed deliveries, opens attempts, and can recover from detail errors", async ({ page, request }) => {
  const reads: string[] = []; let detailFails = true;
  await page.route(`${moderationApi}/api/v1/notifications/deliveries?*`, (route) => {
    const url = new URL(route.request().url()); reads.push(url.search);
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    return route.fulfill({ headers, json: envelope([row], { number: 0, size: 20, totalElements: 1, totalPages: 1 }) });
  });
  await page.route(`${moderationApi}/api/v1/notifications/deliveries/${row.id}`, (route) => route.fulfill(detailFails ? { status: 503, headers, json: { title: "Attempt history unavailable" } } : {
    headers, json: envelope({ ...row, attempts: [{ id: "attempt-1", attemptNumber: 1, status: "FAILED", attemptedAt: row.createdAt, completedAt: row.updatedAt, errorCode: "SMTP_TIMEOUT", retryable: true }] }),
  }));
  await signInModeration(page, request);
  await expect(page.getByRole("heading", { name: "Notification deliveries", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Status", exact: true }).selectOption("FAILED");
  await page.getByRole("combobox", { name: "Channel", exact: true }).selectOption("EMAIL");
  await page.getByLabel("Error code", { exact: true }).fill("SMTP_TIMEOUT");
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect.poll(() => reads.some((value) => value.includes("status=FAILED") && value.includes("channel=EMAIL") && value.includes("errorCode=SMTP_TIMEOUT"))).toBe(true);
  await page.getByRole("button", { name: "View attempts for Your bid was exceeded", exact: true }).click();
  const detail = page.getByRole("region", { name: "Delivery detail", exact: true });
  await expect(detail.getByRole("alert")).toContainText("Attempt history unavailable");
  detailFails = false;
  await detail.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(detail.getByRole("table", { name: "Delivery attempts", exact: true })).toContainText("SMTP_TIMEOUT");
  await expect(detail.getByRole("cell", { name: "Yes", exact: true })).toBeVisible();
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/notification-settings/deliveries-${width}.png`, fullPage: true });
  }
});

test("support staff cannot read administrator notification deliveries", async ({ page, request }) => {
  let reads = 0;
  await page.route(`${moderationApi}/api/v1/notifications/deliveries**`, (route) => { reads++; return route.fulfill({ headers, json: envelope([]) }); });
  await signInModeration(page, request, "SUPPORT_STAFF", "/backoffice");
  await page.goto("/backoffice/notification-deliveries");
  await expect(page.getByRole("heading", { name: "Access denied", exact: true })).toBeVisible();
  expect(reads).toBe(0);
});
