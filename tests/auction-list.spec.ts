import { test, expect, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";

const simulation = "http://127.0.0.1:3928";
const auctionId = "00000051-1111-4111-8111-111111111111";
const title = "Rolex Submariner Watch — Two-Tone, Box & Papers";
const offerLabel = `Second chance offer for ${title}`;
type Evidence = {
  requests: { method: string; path: string; query: string; authorized: boolean; bearer: boolean }[];
  offerRequests: { action: string; authorized: boolean }[];
  offerOrders: number;
};
async function evidence(request: APIRequestContext): Promise<Evidence> {
  const response = await request.get(`${simulation}/api/test/evidence`);
  expect(response.ok()).toBe(true);
  return response.json();
}
async function control(request: APIRequestContext, changes: Record<string, unknown>) {
  expect((await request.post(`${simulation}/api/test/control`, { data: changes })).ok()).toBe(true);
}
async function signIn(page: Page) {
  await page.goto("/sign-in?returnTo=%2Fmy-bids");
  await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("buyer@nexus.local");
  await page.getByLabel("Password", { exact: true }).fill("Fixture-pass-123!");
  await page.getByRole("button", { name: "Sign in at Keycloak", exact: true }).click();
  await expect(page).toHaveURL("/my-bids");
  await expect(page.getByRole("heading", { name: "My Bids", exact: true })).toBeVisible();
}
async function capture(page: Page, info: TestInfo, name: string) {
  await expect(page.getByRole("main").getByText(/^00:04:\d{2}$/).first()).toBeVisible();
  // Full-page screenshots include offscreen cards; load their test images too.
  await page.getByRole("main").locator("img").evaluateAll(async (images) => {
    await Promise.all(images.map(async (image) => {
      if (!(image instanceof HTMLImageElement)) return;
      image.loading = "eager";
      await image.decode().catch(() => undefined);
    }));
  });
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true, style: "nextjs-portal { visibility: hidden !important; }" });
  await info.attach(name, { path, contentType: "image/png" });
}

test.beforeEach(async ({ request }) => {
  expect((await request.get(`${simulation}/keycloak/test/reset`)).ok()).toBe(true);
  expect((await request.get(`${simulation}/api/test/reset`)).ok()).toBe(true);
  await control(request, { listMode: true });
});

test("public auctions preserve server paging, prices and scheduled room links", async ({ page, request }, info) => {
  await page.goto("/auctions");
  await expect(page.getByRole("heading", { name: "Auctions", exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByRole("article")).toHaveCount(8);
  await expect(page.getByText("$9,850.00", { exact: true })).toBeVisible();
  await expect(page.getByText("Showing 1–8 of 10 live auctions", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: title, exact: true })).toHaveAttribute("href", `/auctions/${auctionId}`);
  const firstCard = page.getByRole("link", { name: title, exact: true });
  const countdown = firstCard.getByText(/^00:04:\d{2}$/);
  await expect(countdown).toBeVisible();
  const before = await countdown.innerText();
  await expect(countdown).not.toHaveText(before);
  await capture(page, info, "auction-list-desktop");
  await page.getByRole("navigation", { name: "Auction pagination", exact: true }).getByRole("link", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/\/auctions\?page=2$/);
  await expect(page.getByRole("main").getByRole("article")).toHaveCount(2);
  await expect(page.getByText("Showing 9–10 of 10 live auctions", { exact: true })).toBeVisible();
  await page.getByRole("navigation", { name: "Auction status", exact: true }).getByRole("link", { name: "Scheduled", exact: true }).click();
  await expect(page).toHaveURL(/status=SCHEDULED/);
  await expect(page.getByRole("link", { name: "Scheduled Omega watch", exact: true })).toHaveAttribute("href", "/auctions/00000061-1111-4111-8111-111111111111");
  await expect(page.getByRole("main").getByText("Starting bid", { exact: true })).toHaveCount(2);
  const result = await evidence(request);
  const reads = result.requests.filter((call) => call.path === "/v1/auctions");
  expect(reads.length).toBeGreaterThanOrEqual(3);
  expect(reads.every((call) => !call.bearer)).toBe(true);
  expect(reads.some((call) => call.query === "?status=SCHEDULED&page=0&size=8")).toBe(true);
});

test("auction errors expose a retry and recover through the HTTP dependency", async ({ page, request }) => {
  await control(request, { mode: "list-unavailable" });
  await page.goto("/auctions");
  await expect(page.getByRole("alert").filter({ hasText: "Unable to load auctions" })).toBeVisible();
  await control(request, { mode: "normal" });
  await page.getByRole("button", { name: "Retry auctions", exact: true }).click();
  await expect(page.getByRole("main").getByRole("article")).toHaveCount(8);
});

test("my bids guards anonymous reads and shows leading, outbid and final results from all pages", async ({ page, request }, info) => {
  await page.goto("/my-bids");
  await expect(page.getByRole("link", { name: /Sign in/i }).first()).toBeVisible();
  expect((await evidence(request)).requests.filter((call) => call.path === "/v1/bids/mine" || call.path === "/v1/auctions/offers/mine")).toHaveLength(0);
  await signIn(page);
  const main = page.getByRole("main");
  await expect(main.getByText("Leading", { exact: true }).first()).toBeVisible();
  await expect(main.getByText("Outbid", { exact: true }).first()).toBeVisible();
  await expect(main.getByText(/^00:04:\d{2}$/).first()).toBeVisible();
  await expect.poll(async () => (await evidence(request)).requests.some((call) => call.path === "/v1/bids/mine" && new URLSearchParams(call.query).get("page") === "1")).toBe(true);
  await capture(page, info, "my-bids-desktop");
  await main.getByRole("navigation", { name: "My bid status", exact: true }).getByRole("link", { name: /^Won\b/ }).click();
  await expect(main.getByRole("link", { name: "Won collector watch", exact: true }).first()).toBeVisible();
  await main.getByRole("navigation", { name: "My bid status", exact: true }).getByRole("link", { name: /^Lost\b/ }).click();
  await expect(main.getByRole("link", { name: "Lost collector watch", exact: true }).first()).toBeVisible();
  const result = await evidence(request);
  expect(result.requests.filter((call) => call.path === "/v1/bids/mine").every((call) => call.authorized)).toBe(true);
});

test("an auction payment timeout alone never displays or accepts an offer", async ({ page, request }) => {
  await control(request, { status: "PAYMENT_TIMEOUT" });
  await signIn(page);
  await expect.poll(async () => (await evidence(request)).requests.filter((call) => call.path === "/v1/auctions/offers/mine").length).toBeGreaterThan(0);
  await expect(page.getByRole("article", { name: offerLabel, exact: true })).toHaveCount(0);
  expect((await evidence(request)).offerRequests).toHaveLength(0);
  expect((await evidence(request)).offerOrders).toBe(0);
});

test("seller offer uses the recipient's amount and acceptance submits once with a fresh order deadline", async ({ page, request }, info) => {
  await control(request, { sellerOffers: true, mode: "offer-slow" });
  await signIn(page);
  const card = page.getByRole("article", { name: offerLabel, exact: true });
  await expect(card.getByText("4.800.000 ₫", { exact: true })).toBeVisible();
  await expect(card.getByText("5.000.000 ₫", { exact: true })).toHaveCount(0);
  await expect(card.getByText(/Declining or letting this offer expire has no penalty/)).toBeVisible();
  await capture(page, info, "second-chance-offer");
  await card.getByRole("button", { name: "Accept offer", exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(card.getByRole("button", { name: "Accepting…", exact: true })).toBeDisabled();
  await expect(card.getByText("Offer accepted. Your order has been created.", { exact: true })).toBeVisible();
  await expect(card.getByText(/Payment deadline:/)).toBeVisible();
  await expect(card.getByRole("link", { name: "View order", exact: true })).toHaveAttribute("href", "/order/00000081-1111-4111-8111-111111111111");
  const result = await evidence(request);
  expect(result.offerRequests).toEqual([{ action: "accept", authorized: true, at: expect.any(Number) }]);
  expect(result.offerOrders).toBe(1);
});

test("declining an explicit seller offer creates no order and confirms no penalty", async ({ page, request }) => {
  await control(request, { sellerOffers: true });
  await signIn(page);
  const card = page.getByRole("article", { name: offerLabel, exact: true });
  await card.getByRole("button", { name: "Decline offer", exact: true }).click();
  await expect(card.getByText("You declined this offer. There is no penalty.", { exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Accept offer", exact: true })).toHaveCount(0);
  const result = await evidence(request);
  expect(result.offerOrders).toBe(0);
  expect(result.offerRequests.map((call) => call.action)).toEqual(["decline"]);
});

test("an interrupted acceptance checks server status without issuing a second order write", async ({ page, request }) => {
  await control(request, { sellerOffers: true, mode: "offer-lost-response" });
  await signIn(page);
  const card = page.getByRole("article", { name: offerLabel, exact: true });
  await card.getByRole("button", { name: "Accept offer", exact: true }).click();
  await expect(card.getByText("Offer accepted. Your order has been created.", { exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Accept offer", exact: true })).toHaveCount(0);
  const result = await evidence(request);
  expect(result.offerRequests.map((call) => call.action)).toEqual(["accept"]);
  expect(result.offerOrders).toBe(1);
});

test("expired offers cannot be accepted and unavailable offer endpoints can be retried", async ({ page, request }) => {
  await control(request, { sellerOffers: true, offerRemainingMs: -1000 });
  await signIn(page);
  const card = page.getByRole("article", { name: offerLabel, exact: true });
  await expect(card.getByText("This offer has expired. There is no penalty.", { exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Accept offer", exact: true })).toHaveCount(0);
  expect((await evidence(request)).offerRequests).toHaveLength(0);
  await control(request, { mode: "offers-unavailable" });
  await page.reload();
  await expect(page.getByRole("alert").filter({ hasText: "Second chance offers are currently unavailable." })).toBeVisible();
  await control(request, { mode: "normal" });
  await page.getByRole("button", { name: "Retry offers", exact: true }).click();
  await expect(card.getByText("This offer has expired. There is no penalty.", { exact: true })).toBeVisible();
});

test("list, my bids and offer controls fit the mobile viewport", async ({ page, request }, info) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/auctions");
  await expect(page.getByRole("main").getByRole("article")).toHaveCount(8);
  await expect(page.getByRole("link", { name: title, exact: true }).getByText(/^00:04:\d{2}$/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await capture(page, info, "auction-list-mobile");
  await control(request, { sellerOffers: true });
  await signIn(page);
  const card = page.getByRole("article", { name: offerLabel, exact: true });
  await expect(card).toBeVisible();
  const buttons = [card.getByRole("button", { name: "Accept offer", exact: true }), card.getByRole("button", { name: "Decline offer", exact: true })];
  for (const button of buttons) {
    const bounds = await button.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375);
    expect(bounds!.height).toBeGreaterThanOrEqual(40);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await capture(page, info, "my-bids-offer-mobile");
});
