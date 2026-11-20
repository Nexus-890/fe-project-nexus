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

test("an SSE revision during the initial inbox load starts fresh reads and ignores late old responses", async ({ page, request }) => {
  await inboxFixture(page);
  let releaseOld!: () => void, releaseSnapshot!: () => void, firstList!: () => void, firstCount!: () => void;
  const oldResponse = new Promise<void>((resolve) => { releaseOld = resolve; });
  const snapshotReady = new Promise<void>((resolve) => { releaseSnapshot = resolve; });
  const listStarted = new Promise<void>((resolve) => { firstList = resolve; });
  const countStarted = new Promise<void>((resolve) => { firstCount = resolve; });
  let listReads = 0, countReads = 0, streamReads = 0, snapshotSent = false;
  const notice = { id: "arrived-during-load", type: "BID_OUTBID", title: "Arrived during initial load", content: "Your previous bid was exceeded.", readAt: null, createdAt: "2026-11-19T03:00:00Z" };
  await page.route(`${moderationApi}/api/v1/notifications?*`, async (route) => {
    listReads++;
    const initial = !snapshotSent;
    if (initial) { firstList(); await oldResponse; }
    try {
      await route.fulfill({ headers, json: envelope(initial ? [] : [notice], { number: 0, size: 10, totalElements: initial ? 0 : 1, totalPages: initial ? 0 : 1 }) });
    } catch (error) { if (!route.request().failure()) throw error; }
  });
  await page.route(`${moderationApi}/api/v1/notifications/unread-count`, async (route) => {
    countReads++;
    const initial = !snapshotSent;
    if (initial) { firstCount(); await oldResponse; }
    try { await route.fulfill({ headers, json: envelope({ count: initial ? 0 : 1 }) }); }
    catch (error) { if (!route.request().failure()) throw error; }
  });
  await page.route(`${moderationApi}/api/v1/notifications/stream`, async (route) => {
    streamReads++;
    await Promise.all([listStarted, countStarted, snapshotReady]); snapshotSent = true;
    try { await route.fulfill({ headers: { ...headers, "content-type": "text/event-stream" }, body: 'event: notifications\ndata: {"unreadCount":1,"revision":"during-initial-load"}\n\n' }); }
    catch (error) { if (!route.request().failure()) throw error; }
  });
  try {
    await signInModeration(page, request, "BUYER", "/notifications");
    await expect(page.getByRole("heading", { name: "Notification settings", exact: true })).toBeVisible();
    await Promise.all([listStarted, countStarted]);
    await expect.poll(() => streamReads).toBeGreaterThan(0);
    const initialReads = [listReads, countReads];
    releaseSnapshot();
    await expect.poll(() => snapshotSent).toBe(true);
    // Count from the committed mount, after StrictMode's initial effect replay, while every stale response remains held.
    await expect.poll(() => listReads > initialReads[0] && countReads > initialReads[1]).toBe(true);
    releaseOld();
    await page.getByRole("button", { name: "Notifications, 1 unread", exact: true }).click();
    await expect(page.getByRole("button", { name: "Arrived during initial load, unread", exact: true })).toBeVisible();
    const settledReads = [listReads, countReads], nextConnection = streamReads + 1;
    await expect.poll(() => streamReads).toBeGreaterThanOrEqual(nextConnection);
    expect([listReads, countReads]).toEqual(settledReads);
  } finally { releaseOld(); releaseSnapshot(); }
});

test("unsaved preferences survive stale offline reconnect and saving establishes a clean baseline", async ({ page, request, context }) => {
  test.setTimeout(90_000);
  await inboxFixture(page);
  let current = structuredClone(preferences), reads = 0;
  const writes: unknown[] = [];
  await page.route(`${moderationApi}/api/v1/notifications/preferences`, async (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON(); writes.push(body);
      current = current.map((entry) => ({ ...entry, enabled: body.preferences.find((change: typeof entry) => change.notificationType === entry.notificationType && change.channel === entry.channel)?.enabled ?? entry.enabled }));
    } else reads++;
    await route.fulfill({ headers, json: envelope({ preferences: current }) });
  });
  await signInModeration(page, request, "BUYER", "/notifications");
  const email = page.getByRole("checkbox", { name: "Bid Outbid email", exact: true });
  const save = page.getByRole("button", { name: "Save preferences", exact: true });
  await email.uncheck();
  const beforeReconnect = reads;
  try {
    await context.setOffline(true);
    // Expire the real 30s staleTime while retaining the mounted form and its edits.
    await page.waitForTimeout(31_000);
  } finally { await context.setOffline(false); }
  await expect.poll(() => reads).toBeGreaterThan(beforeReconnect);
  await expect(email).not.toBeChecked();
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByText("Notification preferences saved.", { exact: true })).toBeVisible();
  await expect(save).toBeDisabled();
  expect(writes).toEqual([{ preferences: [{ notificationType: "BID_OUTBID", channel: "EMAIL", enabled: false }] }]);
  await page.reload();
  await expect(email).not.toBeChecked();
  await expect(save).toBeDisabled();
});

test("background settings errors keep edits mounted and reordered server rows update only untouched cells", async ({ page, request }) => {
  await inboxFixture(page);
  let current = structuredClone(preferences), reads = 0, failReads = false;
  await page.route(`${moderationApi}/api/v1/notifications/preferences`, (route) => {
    reads++;
    return route.fulfill(failReads ? { status: 403, headers, json: { title: "Settings temporarily unavailable", detail: "Settings temporarily unavailable" } }
      : { headers, json: envelope({ preferences: current }) });
  });
  await signInModeration(page, request, "BUYER", "/notifications");
  const email = page.getByRole("checkbox", { name: "Bid Outbid email", exact: true });
  const inApp = page.getByRole("checkbox", { name: "Bid Outbid in app", exact: true });
  await email.uncheck(); failReads = true;
  await page.clock.install(); await page.clock.fastForward(31_000);
  await page.evaluate(() => { window.dispatchEvent(new Event("offline")); window.dispatchEvent(new Event("online")); });
  const section = page.getByRole("region", { name: "Notification settings", exact: true });
  await expect(section.getByRole("alert")).toContainText("Settings temporarily unavailable");
  await expect(email).not.toBeChecked();
  await expect(section.getByRole("button", { name: "Save preferences", exact: true })).toBeEnabled();
  const oldReads = reads;
  failReads = false;
  current = current.map((entry) => entry.notificationType === "BID_OUTBID" && entry.channel === "IN_APP" ? { ...entry, enabled: false } : entry).reverse();
  await section.getByRole("button", { name: "Retry", exact: true }).click();
  await expect.poll(() => reads).toBeGreaterThan(oldReads);
  await expect(email).not.toBeChecked(); await expect(inApp).not.toBeChecked();
  await expect(section.getByRole("alert")).toHaveCount(0);
});

test("an old preferences GET cannot overwrite the successful save response", async ({ page, request }) => {
  await inboxFixture(page);
  let heldReads = 0, holdReads = false, releaseOld!: () => void, oldReturned!: () => void;
  const oldResponse = new Promise<void>((resolve) => { releaseOld = resolve; });
  const oldResponseReturned = new Promise<void>((resolve) => { oldReturned = resolve; });
  let current = structuredClone(preferences);
  await page.route(`${moderationApi}/api/v1/notifications/preferences`, async (route) => {
    if (route.request().method() === "PUT") {
      current = current.map((entry) => entry.notificationType === "BID_OUTBID" && entry.channel === "EMAIL" ? { ...entry, enabled: false } : entry);
      await route.fulfill({ headers, json: envelope({ preferences: current }) });
      return;
    }
    const snapshot = structuredClone(current);
    const held = holdReads;
    if (held) { heldReads++; await oldResponse; }
    try { await route.fulfill({ headers, json: envelope({ preferences: snapshot }) }); }
    catch (error) { if (!route.request().failure()) throw error; }
    finally { if (held) oldReturned(); }
  });
  try {
    await signInModeration(page, request, "BUYER", "/notifications");
    const email = page.getByRole("checkbox", { name: "Bid Outbid email", exact: true });
    const save = page.getByRole("button", { name: "Save preferences", exact: true });
    await email.uncheck();
    holdReads = true;
    await page.clock.install(); await page.clock.fastForward(31_000);
    await page.evaluate(() => { window.dispatchEvent(new Event("offline")); window.dispatchEvent(new Event("online")); });
    await expect.poll(() => heldReads).toBeGreaterThan(0);
    await save.click();
    await expect(page.getByText("Notification preferences saved.", { exact: true })).toBeVisible();
    releaseOld();
    await oldResponseReturned;
    await expect(email).not.toBeChecked(); await expect(save).toBeDisabled();
  } finally { releaseOld(); }
});

test("profile retains own reputation and score penalties alongside action restrictions and disputes", async ({ page, request }) => {
  await inboxFixture(page);
  await page.route(`${moderationApi}/api/v1/users/me/reputation`, (route) => route.fulfill({ headers, json: envelope({
    score: 70, trustLevel: "TRUSTED", totalTransaction: 9, successfulTransaction: 7, failedTransaction: 1,
    ratingCount: 0, averageRating: null, successfulAuctions: 2, failedAuctions: 1, penaltyCount: 1, policyVersion: "reputation-policy-1",
  }) }));
  await page.route(`${moderationApi}/api/v1/users/me/penalties?*`, (route) => route.fulfill({ headers, json: envelope([{
    id: "68000000-0000-4000-8000-000000000001", changeType: "RATING_DISPUTE_APPROVED",
    sourceId: "68000000-0000-4000-8000-000000000002", delta: -30, previousScore: 100, newScore: 70,
    previousLevel: "TOP", newLevel: "TRUSTED", reason: "Favorable review was for a different order", changedAt: "2026-11-19T02:00:00Z",
  }], { number: 0, size: 10, totalElements: 1, totalPages: 1 }) }));
  await page.route(`${moderationApi}/api/v1/reputations/*/restrictions?*`, (route) => {
    const userId = new URL(route.request().url()).pathname.split("/")[4];
    return route.fulfill({ headers, json: envelope([{
      id: "68000000-0000-4000-8000-000000000003", userId, action: "BID", reason: "Action restriction retained after merge",
      restrictedUntil: "2030-01-01T12:00:00Z", createdAt: "2026-11-19T01:00:00Z", createdBy: "68000000-0000-4000-8000-000000000004",
      revokedAt: null, revokedBy: null, revocationReason: null, active: true,
    }], { number: 0, size: 20, totalElements: 1, totalPages: 1 }) });
  });
  await signInModeration(page, request, "BUYER", "/profile");
  await expect(page.locator("#reputation")).toHaveCount(1);
  await expect(page.locator("#reputation")).toContainText("70");
  await expect(page.locator("#reputation")).toContainText("Auctions won");
  await expect(page.locator("#penalty-history")).toHaveCount(1);
  await expect(page.locator("#penalty-history")).toContainText("Disputed rating removed");
  await expect(page.locator("#penalty-history")).toContainText("-30 (100 → 70)");
  await expect(page.getByRole("region", { name: "Action restrictions", exact: true })).toContainText("Action restriction retained after merge");
  await expect(page.getByRole("link", { name: "View ratings received and submit a dispute", exact: true })).toHaveAttribute("href", "/ratings");
});

test("seller sales retains transaction summary and the paid picking and packing workflow", async ({ page, request }) => {
  await inboxFixture(page);
  expect((await request.post(`${moderationApi}/api/test/seller-seed`, { data: {} })).ok()).toBe(true);
  await page.route(`${moderationApi}/api/v1/reputations/*`, (route) => {
    const userId = new URL(route.request().url()).pathname.split("/").at(-1);
    return route.fulfill({ headers, json: envelope({ userId, score: 78, trustLevel: "TRUSTED", totalTransaction: 42,
      successfulTransaction: 40, failedTransaction: 2, ratingCount: 20, policyVersion: "reputation-policy-1" }) });
  });
  await signInModeration(page, request, "SELLER", "/backoffice/sales", "68000000-0000-4000-8000-000000000002");
  await expect(page.getByRole("region", { name: "Your transaction summary", exact: true })).toContainText("40 successful transactions · 2 failed · 42 total");
  await page.getByRole("button", { name: "Mark NX-SELLER-1 picked", exact: true }).click();
  await page.getByRole("button", { name: "Mark NX-SELLER-1 packed", exact: true }).click();
  await expect(page.getByText("Packed for carrier", { exact: true })).toBeVisible();
});
