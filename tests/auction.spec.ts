import { test, expect, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const simulation = "http://127.0.0.1:3928";
const auctionId = "00000051-1111-4111-8111-111111111111";
const roomPath = `/auctions/${auctionId}`;
type Evidence = {
  requests: { method: string; path: string; query: string; authorized: boolean; bearer: boolean; at: number }[];
  bidRequests: { key: string; amount: number; authorized: boolean }[];
  bidWrites: number; sseConnections: number; sseEvents: number;
  streamEvents: { event: string; id: string; connectionId: number; at: number; currentPrice?: number; status?: string }[];
  shippingRequests: { body: Record<string, string>; authorized: boolean }[];
  shippingWrites: number;
  paymentRequests: { body: { orderGroupId: string }; authorized: boolean }[];
  qrRequests: number;
};
async function evidence(request: APIRequestContext): Promise<Evidence> {
  const response = await request.get(`${simulation}/api/test/evidence`);
  expect(response.ok()).toBe(true);
  return response.json();
}
async function control(request: APIRequestContext, changes: Record<string, unknown>) {
  const response = await request.post(`${simulation}/api/test/control`, { data: changes });
  expect(response.ok()).toBe(true);
}
async function signIn(page: Page) {
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(roomPath)}`);
  await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("buyer@nexus.local");
  await page.getByLabel("Password", { exact: true }).fill("Fixture-pass-123!");
  await page.getByRole("button", { name: "Sign in at Keycloak", exact: true }).click();
  await expect(page).toHaveURL(roomPath);
  await ready(page);
}
async function ready(page: Page) {
  await expect(page.getByRole("heading", { name: "Rolex Submariner Watch — Two-Tone, Box & Papers", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bid History", exact: true })).toBeVisible();
  await expect(page.getByRole("timer", { name: "Time remaining", exact: true })).not.toHaveText("00:00:00");
}
async function capture(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true, style: "nextjs-portal { visibility: hidden !important; }" });
  await info.attach(name, { path, contentType: "image/png" });
}
async function expectRoomControlTargets(page: Page) {
  const room = page.getByRole("main").getByRole("region", { name: "Rolex Submariner Watch — Two-Tone, Box & Papers", exact: true });
  const sizes = await room.locator('a, button, input, select, textarea, [role="button"], [tabindex="0"]').evaluateAll((controls) => controls.flatMap((control) => {
    const rect = control.getBoundingClientRect();
    if (!rect.width || !rect.height || getComputedStyle(control).visibility === "hidden") return [];
    return [{ name: control.getAttribute("aria-label") || control.textContent?.trim() || control.getAttribute("id"), width: rect.width, height: rect.height, left: rect.left, right: rect.right }];
  }));
  expect(sizes.length).toBeGreaterThan(8);
  for (const size of sizes) {
    expect(size.width, `${size.name} width`).toBeGreaterThanOrEqual(44);
    expect(size.height, `${size.name} height`).toBeGreaterThanOrEqual(44);
    expect(size.left, `${size.name} left edge`).toBeGreaterThanOrEqual(0);
    expect(size.right, `${size.name} right edge`).toBeLessThanOrEqual(375);
  }
}
const stateCalls = (calls: Evidence) => calls.requests.filter((call) => call.path.endsWith("/state"));
const timerSeconds = (text: string) => text.split(":").reduce((total, part) => total * 60 + Number(part), 0);

test.beforeEach(async ({ request }) => {
  expect((await request.get(`${simulation}/keycloak/test/reset`)).ok()).toBe(true);
  expect((await request.get(`${simulation}/api/test/reset`)).ok()).toBe(true);
});

test("public room polls every two seconds, updates price/history/extensions and matches the desktop layout", async ({ page, request }, info) => {
  await page.goto(roomPath);
  await ready(page);
  await expect(page.getByText("$9,850.00", { exact: true }).first()).toBeVisible();
  const timer = page.getByRole("timer", { name: "Time remaining", exact: true });
  const before = timerSeconds(await timer.innerText());
  const calls = stateCalls(await evidence(request)).length;
  await expect.poll(async () => stateCalls(await evidence(request)).length).toBeGreaterThanOrEqual(calls + 2);
  expect(timerSeconds(await timer.innerText())).toBeLessThan(before);
  await control(request, { price: 10000, extend: true });
  await expect(page.getByText("$10,000.00", { exact: true }).first()).toBeVisible({ timeout: 3500 });
  await expect(page.getByRole("region", { name: "Bid History" }).getByText("$10,000.00", { exact: true })).toBeVisible();
  await expect(page.getByText(/3 extensions/)).toBeVisible();
  const result = await evidence(request);
  expect(result.requests.filter((call) => /\/auctions\//.test(call.path)).every((call) => !call.bearer)).toBe(true);
  const steady = stateCalls(result).slice(-3);
  for (let index = 1; index < steady.length; index += 1) {
    expect(steady[index].at - steady[index - 1].at).toBeGreaterThanOrEqual(1700);
    expect(steady[index].at - steady[index - 1].at).toBeLessThan(2900);
  }
  expect(result.bidRequests).toHaveLength(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await capture(page, info, "auction-desktop");
});

test("countdown follows server time when the browser clock is one hour ahead", async ({ page, request }) => {
  await page.clock.setSystemTime(Date.now() + 3600000);
  await page.goto(roomPath);
  await ready(page);
  await expect.poll(async () => stateCalls(await evidence(request)).length).toBeGreaterThan(0);
  const timer = page.getByRole("timer", { name: "Time remaining", exact: true });
  await expect.poll(async () => timerSeconds(await timer.innerText())).toBeGreaterThan(200);
  expect(timerSeconds(await timer.innerText())).toBeLessThanOrEqual(252);
});

test("signed-in buyer starts at the minimum, submits numeric money once and sees own leading status", async ({ page, request }, info) => {
  await signIn(page);
  const amount = page.getByLabel("Bid amount", { exact: true });
  await expect(amount).toHaveValue("9900.00");
  await page.getByRole("button", { name: "Place Bid", exact: true }).click();
  await expect(page.getByText("$9,900.00", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/You’re the highest bidder|You're the highest bidder/)).toBeVisible();
  const result = await evidence(request);
  expect(result.bidWrites).toBe(1);
  expect(result.bidRequests).toHaveLength(1);
  expect(result.bidRequests[0]).toMatchObject({ amount: 9900, authorized: true });
  expect(result.bidRequests[0].key).toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27}$/i);
  expect(result.requests.filter((call) => call.path === "/v1/bids/mine").every((call) => call.authorized)).toBe(true);
  expect(result.requests.filter((call) => /\/auctions\/.+(?:state|bids)$/.test(call.path) && call.method === "GET").every((call) => !call.bearer)).toBe(true);
  await expect(page.getByRole("button", { name: "Place Bid", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Place Bid", exact: true }).hover();
  await capture(page, info, "auction-leading");
});

test("a rejected bid shows the server minimum and lets the buyer submit the corrected amount", async ({ page, request }) => {
  await signIn(page);
  await control(request, { mode: "low" });
  await page.getByRole("button", { name: "Place Bid", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert").filter({ hasText: /minimum|9,950|9950/i })).toBeVisible();
  await expect(page.getByLabel("Bid amount", { exact: true })).toHaveValue("9950.00");
  await control(request, { mode: "normal" });
  await page.getByRole("button", { name: "Place Bid", exact: true }).click();
  await expect(page.getByText("$9,950.00", { exact: true }).first()).toBeVisible();
  const result = await evidence(request);
  expect(result.bidWrites).toBe(1);
  expect(result.bidRequests.map((call) => call.amount)).toEqual([9900, 9950]);
  expect(result.bidRequests[0].key).not.toBe(result.bidRequests[1].key);
});

test("retry after a lost success response keeps its key and creates one bid", async ({ page, request }) => {
  await signIn(page);
  await control(request, { mode: "lost-response" });
  await page.getByRole("button", { name: "Place Bid", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert").filter({ hasText: /response was lost|retry/i })).toBeVisible();
  await page.getByRole("button", { name: "Retry same bid", exact: true }).click();
  await expect.poll(async () => (await evidence(request)).bidRequests.length).toBe(2);
  const result = await evidence(request);
  expect(result.bidWrites).toBe(1);
  expect(result.bidRequests[0].key).toBe(result.bidRequests[1].key);
  expect(result.bidRequests[0].amount).toBe(result.bidRequests[1].amount);
});

test("end states disable bidding and a verified winner can open the order", async ({ page, request }, info) => {
  await signIn(page);
  await control(request, { status: "SETTLED" });
  await expect(page.getByRole("heading", { name: "You won this auction", exact: true })).toBeVisible({ timeout: 3500 });
  await expect(page.getByRole("button", { name: "Place Bid", exact: true })).toHaveCount(0);
  await expect(page.locator('a[href="/order/00000081-1111-4111-8111-111111111111"]')).toBeVisible();
  await capture(page, info, "auction-won");
});

test("missing draft reads show snapshot fallback and an explicit history failure", async ({ page, request }) => {
  await control(request, { mode: "missing-read" });
  await signIn(page);
  await expect(page.getByRole("main").getByRole("status").filter({ hasText: "Live state is unavailable. Showing the latest auction snapshot." })).toBeVisible();
  await expect(page.getByRole("region", { name: "Bid History" }).getByRole("alert")).toBeVisible();
  expect((await evidence(request)).bidWrites).toBe(0);
});

test("named state events use the stream route and disconnects resume two-second polling", async ({ page, request }) => {
  await control(request, { mode: "stream" });
  await page.goto(roomPath);
  await ready(page);
  await expect(page.getByRole("status").filter({ hasText: "Live updates connected" })).toBeVisible();
  await control(request, { price: 10000, publish: true });
  await expect(page.getByText("$10,000.00", { exact: true }).first()).toBeVisible({ timeout: 3000 });
  expect((await evidence(request)).sseEvents).toBeGreaterThan(0);
  const streamEvidence = await evidence(request);
  expect(streamEvidence.requests.filter((call) => call.path.endsWith("/stream")).every((call) => !call.bearer)).toBe(true);
  expect(streamEvidence.requests.filter((call) => call.path.endsWith("/events"))).toHaveLength(0);
  expect(streamEvidence.streamEvents.every((event) => ["state", "heartbeat"].includes(event.event))).toBe(true);
  await control(request, { mode: "normal", disconnect: true });
  const calls = stateCalls(await evidence(request)).length;
  await expect.poll(async () => stateCalls(await evidence(request)).length).toBeGreaterThanOrEqual(calls + 2);
  await control(request, { price: 10200 });
  await expect(page.getByText("$10,200.00", { exact: true }).first()).toBeVisible({ timeout: 3500 });
});

test("every mobile room control has a 44px target and stays within the viewport", async ({ page, request }, info) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await control(request, { historyCount: 12 });
  await signIn(page);
  const amount = page.getByLabel("Bid amount", { exact: true });
  await amount.scrollIntoViewIfNeeded();
  await expectRoomControlTargets(page);
  const historyBounds = await page.getByRole("heading", { name: "Bid History", exact: true }).boundingBox();
  const detailsBounds = await page.getByRole("heading", { name: "Item Details", exact: true }).boundingBox();
  expect(historyBounds!.y).toBeLessThan(detailsBounds!.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await capture(page, info, "auction-mobile");
  await control(request, { failures: { history: 503, state: 503, mine: 503, product: 503 } });
  await page.reload();
  await expect(page.getByRole("button", { name: "Retry history", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry your status", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry item details", exact: true })).toBeVisible();
  await expectRoomControlTargets(page);
});

test("zero countdown closes bidding while ACTIVE and a late extension reopens the room", async ({ page, request }) => {
  await control(request, { remainingMs: 8000 });
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Confirming auction result", exact: true })).toBeVisible();
  await expect(page.getByRole("timer", { name: "Time remaining", exact: true })).toHaveText("00:00:00");
  await expect(page.getByRole("button", { name: "Place Bid", exact: true })).toHaveCount(0);
  const expiredAt = stateCalls(await evidence(request)).length;
  await expect.poll(async () => stateCalls(await evidence(request)).length).toBeGreaterThan(expiredAt);
  await control(request, { extend: true });
  await expect(page.getByRole("button", { name: "Place Bid", exact: true })).toBeEnabled({ timeout: 3500 });
  await expect(page.getByRole("heading", { name: "Confirming auction result", exact: true })).toHaveCount(0);
  await expect.poll(async () => timerSeconds(await page.getByRole("timer", { name: "Time remaining", exact: true }).innerText())).toBeGreaterThan(250);
  expect((await evidence(request)).bidRequests).toHaveLength(0);
});

test("stale history cannot label another row as the buyer's leading bid", async ({ page, request }) => {
  await signIn(page);
  const history = page.getByRole("region", { name: "Bid History" });
  await expect(history.getByText("You · Leading", { exact: true })).toBeVisible();
  await control(request, { freezeHistory: true });
  await page.getByRole("button", { name: "Place Bid", exact: true }).click();
  await expect(page.getByText("$9,900.00", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("You’re the highest bidder", { exact: true })).toBeVisible();
  await expect(history.getByRole("listitem").first()).toContainText("$9,850.00");
  await expect(history.getByText("You · Leading", { exact: true })).toHaveCount(0);
  await expect(history.getByText("Leading", { exact: true })).toHaveCount(0);
  await control(request, { freezeHistory: false });
  await expect(history.getByRole("listitem").first()).toContainText("$9,900.00");
  await expect(history.getByText("You · Leading", { exact: true })).toBeVisible();
});

test("429 state and history errors recover on later polls without a page refresh", async ({ page, request }) => {
  await page.goto(roomPath);
  await ready(page);
  await control(request, { mode: "rate-limited" });
  await expect(page.getByRole("status").filter({ hasText: "Live state is unavailable. Showing the latest auction snapshot." })).toBeVisible();
  const history = page.getByRole("region", { name: "Bid History" });
  await expect(history.getByRole("alert")).toBeVisible();
  const limitedAt = stateCalls(await evidence(request)).length;
  await control(request, { mode: "normal", price: 10000 });
  await expect(page.getByText("$10,000.00", { exact: true }).first()).toBeVisible({ timeout: 3500 });
  await expect(history.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Live state is unavailable. Showing the latest auction snapshot." })).toHaveCount(0);
  expect(stateCalls(await evidence(request)).length).toBeGreaterThan(limitedAt);
});

test("an SSE burst coalesces market refreshes and preserves the detail/private request budget", async ({ page, request }) => {
  await control(request, { mode: "stream" });
  await signIn(page);
  await expect(page.getByRole("status").filter({ hasText: "Live updates connected" })).toBeVisible();
  const baseline = await evidence(request);
  const startsAt = Date.now();
  await control(request, { price: 10000, publishCount: 30 });
  await expect(page.getByText("$10,000.00", { exact: true }).first()).toBeVisible({ timeout: 3500 });
  // Keep a real observation window longer than two coalescing intervals.
  await page.waitForTimeout(4300);
  const result = await evidence(request);
  expect(result.sseEvents - baseline.sseEvents).toBeGreaterThanOrEqual(30);
  const recent = result.requests.filter((call) => call.at >= startsAt);
  expect(recent.filter((call) => call.path.endsWith("/state")).length).toBeLessThanOrEqual(3);
  expect(recent.filter((call) => call.path.endsWith("/bids") && call.method === "GET").length).toBeLessThanOrEqual(3);
  expect(recent.filter((call) => call.path === `/v1/auctions/${auctionId}`).length).toBeLessThanOrEqual(1);
  expect(recent.filter((call) => call.path === "/v1/bids/mine").length).toBeLessThanOrEqual(1);
});

test("unsafe large money fails locally and leaves the amount editable for correction", async ({ page, request }) => {
  await signIn(page);
  const amount = page.getByLabel("Bid amount", { exact: true });
  await amount.fill("90071992547410.00");
  await page.getByRole("button", { name: "Place Bid", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "This amount is too large to submit safely." })).toBeVisible();
  await expect(amount).toBeEditable();
  expect((await evidence(request)).bidRequests).toHaveLength(0);
  await amount.fill("9900.00");
  await page.getByRole("button", { name: "Place Bid", exact: true }).click();
  await expect(page.getByText("$9,900.00", { exact: true }).first()).toBeVisible();
  expect((await evidence(request)).bidWrites).toBe(1);
});

test("a real bid reaches a second browser context over SSE in under one second", async ({ page, browser, request }, info) => {
  await control(request, { mode: "stream" });
  await signIn(page);
  const observerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const observer = await observerContext.newPage();
  try {
    await observer.goto(`http://127.0.0.1:3118${roomPath}`);
    await ready(observer);
    await expect(observer.getByRole("status").filter({ hasText: "Live updates connected" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Live updates connected" })).toBeVisible();
    // Freeze only the REST projection so an immediate observer update must use
    // the actual stream payload. Both pages and the bid POST remain real.
    await control(request, { freezeState: true });
    const started = performance.now();
    await page.getByRole("button", { name: "Place Bid", exact: true }).click();
    await expect(observer.getByText("$9,900.00", { exact: true }).first()).toBeVisible({ timeout: 950 });
    const elapsedMs = performance.now() - started;
    expect(elapsedMs).toBeLessThan(1000);
    const result = await evidence(request);
    expect(result.bidWrites).toBe(1);
    expect(result.sseConnections).toBeGreaterThanOrEqual(2);
    expect(result.streamEvents.filter((event) => event.currentPrice === 9900).length).toBeGreaterThanOrEqual(2);
    const timingPath = info.outputPath("two-context-push-timing.json");
    await writeFile(timingPath, JSON.stringify({ elapsedMs, evidence: "Next.js and local Postman HTTP dependencies; no live backend" }, null, 2));
    await info.attach("local-two-context-push-timing", { path: timingPath, contentType: "application/json" });
  } finally {
    await observerContext.close();
  }
});

test("an open stream that goes silent falls back after the thirty-second heartbeat deadline", async ({ page, request }) => {
  await control(request, { mode: "stream" });
  await page.goto(roomPath);
  await ready(page);
  await expect(page.getByRole("status").filter({ hasText: "Live updates connected" })).toBeVisible();
  const quietAt = Date.now();
  await control(request, { mode: "silent-stream", price: 10000 });
  // Keep actual network timing: the server's 15-second heartbeat contract must
  // tolerate one missing heartbeat before the 30-second watchdog expires.
  await page.waitForTimeout(20_000);
  await expect(page.getByRole("status").filter({ hasText: "Live updates connected" })).toBeVisible();
  await page.waitForTimeout(11_000);
  await expect(page.getByRole("status").filter({ hasText: "Refreshing every 2 seconds" })).toBeVisible({ timeout: 3000 });
  await expect(page.getByText("$10,000.00", { exact: true }).first()).toBeVisible({ timeout: 3500 });
  const fallbackAt = stateCalls(await evidence(request)).length;
  await expect.poll(async () => stateCalls(await evidence(request)).length).toBeGreaterThanOrEqual(fallbackAt + 2);
  const resumed = stateCalls(await evidence(request)).filter((call) => call.at >= quietAt + 30_000).slice(-2);
  expect(resumed).toHaveLength(2);
  expect(resumed[1].at - resumed[0].at).toBeGreaterThanOrEqual(1700);
  expect(resumed[1].at - resumed[0].at).toBeLessThan(2900);
  expect((await evidence(request)).streamEvents.filter((event) => event.event === "heartbeat" && event.at >= quietAt)).toHaveLength(0);
});

test("fifteen-second named heartbeats keep an unchanged stream healthy beyond thirty seconds", async ({ page, request }, info) => {
  await control(request, { mode: "stream" });
  await page.goto(roomPath);
  await ready(page);
  await expect(page.getByRole("status").filter({ hasText: "Live updates connected" })).toBeVisible();
  const startedAt = Date.now();
  const baseline = await evidence(request);
  const statePushes = baseline.streamEvents.filter((event) => event.event === "state").length;
  // Observe two real server heartbeats. Advancing the browser clock alone
  // would not exercise the dependency's actual 15-second emission cadence.
  await page.waitForTimeout(32_000);
  await expect(page.getByRole("status").filter({ hasText: "Live updates connected" })).toBeVisible();
  const result = await evidence(request);
  const heartbeats = result.streamEvents.filter((event) => event.event === "heartbeat" && event.at >= startedAt);
  // Development StrictMode can leave a proxy-held, canceled connection in
  // the mock until its next write. Compare emissions on the same connection.
  const connectionIds = [...new Set(heartbeats.map((event) => event.connectionId))];
  const sameConnection = connectionIds.map((id) => heartbeats.filter((event) => event.connectionId === id)).find((events) => events.length >= 2);
  expect(sameConnection).toBeDefined();
  expect(sameConnection![1].at - sameConnection![0].at).toBeGreaterThanOrEqual(14_000);
  expect(sameConnection![1].at - sameConnection![0].at).toBeLessThan(16_000);
  expect(result.streamEvents.filter((event) => event.event === "state")).toHaveLength(statePushes);
  const reads = stateCalls(result).filter((call) => call.at >= startedAt);
  expect(reads.length).toBeLessThanOrEqual(3);
  for (let index = 1; index < reads.length; index += 1) expect(reads[index].at - reads[index - 1].at).toBeGreaterThan(12_000);
  const timingPath = info.outputPath("heartbeat-contract-timing.json");
  await writeFile(timingPath, JSON.stringify({ observedMs: Date.now() - startedAt, connectionId: sameConnection![0].connectionId, heartbeatAt: sameConnection!.map((event) => event.at), reconciliationReadAt: reads.map((call) => call.at), evidence: "Actual local Postman HTTP SSE emissions; no live backend" }, null, 2));
  await info.attach("local-heartbeat-contract-timing", { path: timingPath, contentType: "application/json" });
});

test("malformed and other-auction stream payloads never replace the room state", async ({ page, request }) => {
  await control(request, { mode: "stream" });
  await page.goto(roomPath);
  await ready(page);
  await expect(page.getByRole("status").filter({ hasText: "Live updates connected" })).toBeVisible();
  await control(request, { publish: true, stateOverrides: { currentPrice: "999999.00" } });
  await control(request, { publish: true, stateOverrides: { auctionId: "00000052-1111-4111-8111-111111111111", currentPrice: 999999 } });
  await page.waitForTimeout(1200);
  await expect(page.getByText("$999,999.00", { exact: true })).toHaveCount(0);
  await expect(page.getByText("$9,850.00", { exact: true }).first()).toBeVisible();
});

test("ENDED keeps checking until delayed settlement confirms a loss", async ({ page, request }) => {
  await signIn(page);
  await control(request, { status: "ENDED" });
  await expect(page.getByRole("heading", { name: "Confirming auction result", exact: true })).toBeVisible({ timeout: 3500 });
  await expect(page.getByRole("heading", { name: "You didn’t win this auction", exact: true })).toHaveCount(0);
  const pendingAt = stateCalls(await evidence(request)).length;
  await expect.poll(async () => stateCalls(await evidence(request)).length).toBeGreaterThan(pendingAt);
  await control(request, { status: "WON", winner: false, price: 10000 });
  await expect(page.getByRole("heading", { name: "You didn’t win this auction", exact: true })).toBeVisible({ timeout: 3500 });
  await expect(page.getByRole("button", { name: "Place Bid", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Confirm address and pay", exact: true })).toHaveCount(0);
});

test("a stale private win cannot override a failed public result", async ({ page, request }) => {
  await signIn(page);
  await control(request, { status: "FAILED", mine: { won: true, leading: true, auctionStatus: "WON" } });
  await expect(page.getByRole("heading", { name: "Auction ended without a winner", exact: true })).toBeVisible({ timeout: 3500 });
  await expect(page.getByRole("heading", { name: "You won this auction", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Confirm address and pay", exact: true })).toHaveCount(0);
  await expect(page.locator('a[href^="/order/"]')).toHaveCount(0);
});

test("winner without an order reference waits without guessing a lookup or confirming shipping", async ({ page, request }) => {
  await signIn(page);
  await control(request, { status: "WON", orderId: null });
  await expect(page.getByRole("heading", { name: "You won this auction", exact: true })).toBeVisible({ timeout: 3500 });
  await expect(page.getByText(/Waiting for your order reference/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm address and pay", exact: true })).toHaveCount(0);
  const result = await evidence(request);
  expect(result.shippingRequests).toHaveLength(0);
  expect(result.requests.filter((call) => call.path.startsWith("/v1/orders"))).toHaveLength(0);
});

async function fillWinnerAddress(page: Page) {
  await page.getByRole("button", { name: "Confirm address and pay", exact: true }).click();
  const checkout = page.getByRole("region", { name: "Winner checkout", exact: true });
  await checkout.getByLabel("Recipient name", { exact: true }).fill("Auction Buyer");
  await checkout.getByLabel("Phone number", { exact: true }).fill("0901234567");
  await checkout.getByLabel("House number and street", { exact: true }).fill("12 Nguyen Hue");
  await checkout.getByLabel("Province / City", { exact: true }).selectOption("202");
  await checkout.getByLabel("Ward", { exact: true }).selectOption("20308");
  return checkout;
}

test("winner reviews the shipping address before POST and continues with the returned payment group", async ({ page, request }, info) => {
  await control(request, { currency: "VND" });
  await signIn(page);
  await control(request, { status: "WON" });
  await expect(page.getByRole("heading", { name: "You won this auction", exact: true })).toBeVisible({ timeout: 3500 });
  await expect(page.getByText(/Waiting for your order reference/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm address and pay", exact: true })).toHaveCount(0);
  const beforeSettlement = await evidence(request);
  expect(beforeSettlement.shippingRequests).toHaveLength(0);
  expect(beforeSettlement.paymentRequests).toHaveLength(0);
  const publicDetail = (await (await request.get(`${simulation}/api/v1/auctions/${auctionId}`)).json()).data;
  expect(publicDetail).not.toHaveProperty("orderId");
  expect(publicDetail).not.toHaveProperty("paymentDueAt");
  expect(publicDetail).not.toHaveProperty("finalPrice");
  await control(request, { status: "SETTLED" });
  await expect(page.getByRole("button", { name: "Confirm address and pay", exact: true })).toBeVisible({ timeout: 5000 });
  const checkout = await fillWinnerAddress(page);
  expect((await evidence(request)).shippingRequests).toHaveLength(0);
  await checkout.getByRole("button", { name: "Review address", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "Confirm shipping address", exact: true });
  await expect(confirmation).toContainText("12 Nguyen Hue");
  await expect(confirmation).toContainText("Ben Nghe Ward");
  expect((await evidence(request)).shippingRequests).toHaveLength(0);
  await confirmation.getByRole("button", { name: "Back to address", exact: true }).click();
  await expect(confirmation).not.toBeVisible();
  expect((await evidence(request)).shippingRequests).toHaveLength(0);
  await checkout.getByRole("button", { name: "Review address", exact: true }).click();
  await confirmation.getByRole("button", { name: "Confirm shipping address", exact: true }).click();
  const total = page.getByRole("region", { name: "Confirmed auction total", exact: true });
  await expect(total.getByText("10.340 ₫", { exact: true })).toBeVisible();
  await expect(total.getByText("490 ₫", { exact: true })).toBeVisible();
  await expect(total.getByRole("link", { name: "Continue to payment", exact: true })).toHaveAttribute("href", "/checkout/payment/00000091-1111-4111-8111-111111111111");
  const result = await evidence(request);
  expect(result.shippingWrites).toBe(1);
  expect(result.shippingRequests).toEqual([{ authorized: true, body: { recipientName: "Auction Buyer", phoneNumber: "0901234567", addressLine: "12 Nguyen Hue", wardCode: "20308", provinceCode: "202", countryCode: "VN" } }]);
  await capture(page, info, "auction-winner-shipping");
  await total.getByRole("link", { name: "Continue to payment", exact: true }).click();
  await expect(page).toHaveURL("/checkout/payment/00000091-1111-4111-8111-111111111111");
  await expect(page.getByRole("heading", { name: "Scan to pay", exact: true })).toBeVisible();
  const qr = page.getByRole("img", { name: "Payment QR code", exact: true });
  await expect(qr).toBeVisible();
  await expect.poll(async () => qr.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByTestId("payment-order-group-id")).toHaveText("00000091-1111-4111-8111-111111111111");
  const payment = await evidence(request);
  expect(payment.paymentRequests.length).toBeGreaterThan(0);
  expect(payment.paymentRequests.every((call) => call.authorized && call.body.orderGroupId === "00000091-1111-4111-8111-111111111111")).toBe(true);
  expect(payment.qrRequests).toBeGreaterThan(0);
  await capture(page, info, "auction-winner-payment");
});

test("lost shipping response retries the unchanged address and preserves one confirmation", async ({ page, request }) => {
  await signIn(page);
  await control(request, { status: "SETTLED", mode: "shipping-lost-response" });
  await expect(page.getByRole("heading", { name: "You won this auction", exact: true })).toBeVisible({ timeout: 3500 });
  const checkout = await fillWinnerAddress(page);
  await checkout.getByRole("button", { name: "Review address", exact: true }).click();
  await page.getByRole("dialog", { name: "Confirm shipping address", exact: true }).getByRole("button", { name: "Confirm shipping address", exact: true }).click();
  await expect(checkout.getByRole("alert").filter({ hasText: /result is unknown/ })).toBeVisible();
  await expect(checkout.getByLabel("House number and street", { exact: true })).toBeDisabled();
  await checkout.getByRole("button", { name: "Retry same address", exact: true }).click();
  await expect(page.getByRole("link", { name: "Continue to payment", exact: true })).toBeVisible();
  const result = await evidence(request);
  expect(result.shippingRequests).toHaveLength(2);
  expect(result.shippingRequests[0].body).toEqual(result.shippingRequests[1].body);
  expect(result.shippingWrites).toBe(1);
});

test("expired winner deadline prevents shipping submission and payment navigation", async ({ page, request }) => {
  await signIn(page);
  await control(request, { status: "SETTLED", paymentDueAt: new Date(Date.now() - 1000).toISOString() });
  await expect(page.getByRole("heading", { name: "You won this auction", exact: true })).toBeVisible({ timeout: 3500 });
  await page.getByRole("button", { name: "Confirm address and pay", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: /payment deadline has passed/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue to payment", exact: true })).toHaveCount(0);
  expect((await evidence(request)).shippingRequests).toHaveLength(0);
});

test("settled winner address draft survives a transient private-read failure", async ({ page, request }) => {
  await signIn(page);
  await control(request, { status: "SETTLED" });
  await expect(page.getByRole("heading", { name: "You won this auction", exact: true })).toBeVisible({ timeout: 3500 });
  const checkout = await fillWinnerAddress(page);
  await checkout.getByLabel("House number and street", { exact: true }).fill("22 Le Loi");
  await control(request, { failures: { mine: 503 } });
  // Terminal timers have stopped. Model returning to this tab to revalidate
  // the result, while keeping the mounted form and all HTTP requests real.
  for (const hidden of [true, false]) await page.evaluate((value) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => value ? "hidden" : "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
  await expect(page.getByRole("button", { name: "Retry your status", exact: true })).toBeVisible({ timeout: 5000 });
  await expect(checkout.getByLabel("House number and street", { exact: true })).toHaveValue("22 Le Loi");
  await expect(checkout.getByLabel("Ward", { exact: true })).toHaveValue("20308");
  await control(request, { failures: {} });
  await page.getByRole("button", { name: "Retry your status", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You won this auction", exact: true })).toBeVisible();
  await expect(checkout.getByLabel("House number and street", { exact: true })).toHaveValue("22 Le Loi");
  await expect(checkout.getByLabel("Ward", { exact: true })).toHaveValue("20308");
  expect((await evidence(request)).shippingRequests).toHaveLength(0);
});

test("a private payment timeout closes checkout while the public projection is still WON", async ({ page, request }) => {
  await signIn(page);
  await control(request, { status: "WON", mine: { won: true, auctionStatus: "PAYMENT_TIMEOUT" } });
  await expect(page.getByRole("heading", { name: "Payment deadline passed", exact: true })).toBeVisible({ timeout: 3500 });
  await expect(page.getByRole("button", { name: "Confirm address and pay", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Continue to payment", exact: true })).toHaveCount(0);
  expect((await evidence(request)).shippingRequests).toHaveLength(0);
});
