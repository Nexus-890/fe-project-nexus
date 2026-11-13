import { test, expect, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";

const simulation = "http://127.0.0.1:3928";
const auctionId = "00000051-1111-4111-8111-111111111111";
const roomPath = `/auctions/${auctionId}`;
type Evidence = {
  requests: { method: string; path: string; query: string; authorized: boolean; bearer: boolean; at: number }[];
  bidRequests: { key: string; amount: number; authorized: boolean }[];
  bidWrites: number; sseConnections: number; sseEvents: number;
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
  await control(request, { status: "WON" });
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

test("SSE events refresh reads and disconnects resume two-second polling", async ({ page, request }) => {
  await control(request, { mode: "stream" });
  await page.goto(roomPath);
  await ready(page);
  await expect.poll(async () => (await evidence(request)).sseConnections).toBeGreaterThan(0);
  await control(request, { price: 10000, publish: true });
  await expect(page.getByText("$10,000.00", { exact: true }).first()).toBeVisible({ timeout: 3000 });
  expect((await evidence(request)).sseEvents).toBeGreaterThan(0);
  await control(request, { mode: "normal", disconnect: true });
  const calls = stateCalls(await evidence(request)).length;
  await expect.poll(async () => stateCalls(await evidence(request)).length).toBeGreaterThanOrEqual(calls + 2);
  await control(request, { price: 10200 });
  await expect(page.getByText("$10,200.00", { exact: true }).first()).toBeVisible({ timeout: 3500 });
});

test("mobile room keeps controls within the viewport", async ({ page }, info) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signIn(page);
  const amount = page.getByLabel("Bid amount", { exact: true });
  await amount.scrollIntoViewIfNeeded();
  for (const control of [amount, page.getByRole("button", { name: "Place Bid", exact: true })]) {
    const bounds = await control.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375);
    expect(bounds!.height).toBeGreaterThanOrEqual(40);
  }
  const historyBounds = await page.getByRole("heading", { name: "Bid History", exact: true }).boundingBox();
  const detailsBounds = await page.getByRole("heading", { name: "Item Details", exact: true }).boundingBox();
  expect(historyBounds!.y).toBeLessThan(detailsBounds!.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await capture(page, info, "auction-mobile");
});

test("zero countdown closes bidding while ACTIVE and a late extension reopens the room", async ({ page, request }) => {
  await signIn(page);
  await control(request, { remainingMs: 1200 });
  await expect(page.getByRole("heading", { name: "Auction ended", exact: true })).toBeVisible();
  await expect(page.getByRole("timer", { name: "Time remaining", exact: true })).toHaveText("00:00:00");
  await expect(page.getByRole("button", { name: "Place Bid", exact: true })).toHaveCount(0);
  const expiredAt = stateCalls(await evidence(request)).length;
  await expect.poll(async () => stateCalls(await evidence(request)).length).toBeGreaterThan(expiredAt);
  await control(request, { extend: true });
  await expect(page.getByRole("button", { name: "Place Bid", exact: true })).toBeEnabled({ timeout: 3500 });
  await expect(page.getByRole("heading", { name: "Auction ended", exact: true })).toHaveCount(0);
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
  expect(result.sseEvents - baseline.sseEvents).toBe(30);
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
