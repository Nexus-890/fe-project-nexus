import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

const fixtureOrigin = `http://127.0.0.1:${process.env.NEXUS_TEST_API_PORT ?? 3911}`;
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
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(`notification-${account}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("Fixture123!");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.getByText(`Hi Notification ${account.toUpperCase()}`, { exact: true })).toBeVisible();
}

test.beforeEach(async ({ request }) => {
  await request.post(`${fixtureOrigin}/test/notifications/reset`);
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
  await signIn(page);
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
  expect(beforeOpening.every((entry) => entry.method === "GET" && entry.authorization === "Bearer notification-fixture-a")).toBe(true);
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
    method: "PATCH", path: firstReadPath, query: {}, authorization: "Bearer notification-fixture-a", canceled: false,
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
  expect(afterReadAll.every((entry) => entry.authorization === "Bearer notification-fixture-a")).toBe(true);
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
  await signIn(page);
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
    headers: { Authorization: "Bearer notification-fixture-a" },
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
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(popup).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Notifications/ })).toHaveCount(0);
  await expect.poll(async () => (await evidence(request)).some((entry) => entry.path === "/api/v1/notifications" && entry.canceled)).toBe(true);
  const anonymousEvidence = await evidence(request);
  await page.getByRole("link", { name: "Nexus home", exact: true }).click();
  await expect(page.locator("#categories > ul > li")).toHaveCount(3);
  expect(await evidence(request)).toEqual(anonymousEvidence);
  await setCase(request, "list=default");
  await signIn(page, "b");
  await page.getByRole("button", { name: "Notifications, 18 unread", exact: true }).click();
  await expect(popup.getByRole("listitem")).toHaveCount(10);
  await expect(popup.getByRole("button", { name: "B update 24, unread", exact: true })).toBeVisible();
  await request.post(`${fixtureOrigin}/test/notifications/release`);
  await expect(popup.getByRole("button", { name: /^A update/ })).toHaveCount(0);
  const accountRequests = (await evidence(request)).slice(anonymousEvidence.length);
  expect(new Set(accountRequests.map((entry) => entry.path))).toEqual(new Set([
    "/api/v1/notifications", "/api/v1/notifications/unread-count",
  ]));
  expect(accountRequests.every((entry) => entry.authorization === "Bearer notification-fixture-b")).toBe(true);
});

test("logout cancels a pending read and a late mutation cannot change the next account", async ({ page, request }) => {
  await setCase(request, "read=delayed");
  await signIn(page);
  await page.getByRole("button", { name: "Notifications, 18 unread", exact: true }).click();
  const popup = page.getByRole("dialog", { name: "Notifications", exact: true });
  await popup.getByRole("button", { name: "A update 24, unread", exact: true }).click();
  await expect.poll(async () => (await evidence(request)).some((entry) => entry.method === "PATCH")).toBe(true);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(popup).toHaveCount(0);
  await expect.poll(async () => (await evidence(request)).some((entry) => entry.path === firstReadPath && entry.canceled)).toBe(true);
  const anonymousEvidence = await evidence(request);
  await page.getByRole("link", { name: "Nexus home", exact: true }).click();
  await expect(page.locator("#categories > ul > li")).toHaveCount(3);
  await expect(page.getByRole("button", { name: /^Notifications/ })).toHaveCount(0);
  expect(await evidence(request)).toEqual(anonymousEvidence);
  await setCase(request, "read=default");
  await signIn(page, "b");
  const trigger = page.getByRole("button", { name: "Notifications, 18 unread", exact: true });
  await trigger.click();
  await expect(popup.getByRole("button", { name: "B update 24, unread", exact: true })).toBeVisible();
  await request.post(`${fixtureOrigin}/test/notifications/release`);
  await expect(trigger).toBeVisible();
  await expect(popup.getByRole("button", { name: /^A update/ })).toHaveCount(0);
  await expect(popup.getByRole("alert")).toHaveCount(0);
  const accountRequests = (await evidence(request)).slice(anonymousEvidence.length);
  expect(accountRequests.every((entry) => entry.method === "GET" && entry.authorization === "Bearer notification-fixture-b")).toBe(true);
});
