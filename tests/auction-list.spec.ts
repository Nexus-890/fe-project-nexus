import { test, expect, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";

const simulation = "http://127.0.0.1:3928";
const auctionId = "00000051-1111-4111-8111-111111111111";
const offerId = "00000092-1111-4111-8111-111111111111";
const orderId = "00000081-1111-4111-8111-111111111111";
const orderGroupId = "00000091-1111-4111-8111-111111111111";
const title = "Rolex Submariner Watch — Two-Tone, Box & Papers";
const offerLabel = `Second chance offer for ${title}`;
const countdownPattern = /^\d{2,}:\d{2}:\d{2}$/;
const countdownSeconds = (text: string) => text.split(":").reduce((total, part) => total * 60 + Number(part), 0);
type Evidence = {
  requests: { method: string; path: string; query: string; authorized: boolean; bearer: boolean }[];
  offerRequests: { action: string; authorized: boolean; path: string; body: unknown }[];
  offerOrders: number;
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
async function capture(page: Page, info: TestInfo, name: string, hasAuctionClock = true) {
  if (hasAuctionClock) await expect(page.getByRole("main").getByText(countdownPattern).first()).toBeVisible();
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
async function fillOfferAddress(page: Page) {
  const card = page.getByRole("article", { name: offerLabel, exact: true });
  await card.getByRole("button", { name: "Confirm address and pay", exact: true }).click();
  const checkout = card.getByRole("region", { name: "Winner checkout", exact: true });
  await checkout.getByLabel("Recipient name", { exact: true }).fill("Second Chance Buyer");
  await checkout.getByLabel("Phone number", { exact: true }).fill("0901234567");
  await checkout.getByLabel("House number and street", { exact: true }).fill("12 Nguyen Hue");
  await checkout.getByLabel("Province / City", { exact: true }).selectOption("202");
  await checkout.getByLabel("Ward", { exact: true }).selectOption("20308");
  return checkout;
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
  const countdown = firstCard.getByText(countdownPattern);
  await expect(countdown).toBeVisible();
  const before = countdownSeconds(await countdown.innerText());
  expect(before).toBeGreaterThan(0);
  expect(before).toBeLessThanOrEqual(252);
  await expect.poll(async () => countdownSeconds(await countdown.innerText())).toBeLessThan(before);
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
  expect((await evidence(request)).requests.filter((call) => call.path === "/v1/bids/mine" || call.path === "/v1/auctions/offers/me")).toHaveLength(0);
  await signIn(page);
  const main = page.getByRole("main");
  await expect(main.getByText("Awaiting order", { exact: true })).toBeVisible();
  await expect(main.getByText("Awaiting payment", { exact: true })).toHaveCount(0);
  await expect(main.getByText("Leading", { exact: true }).first()).toBeVisible();
  await expect(main.getByText("Outbid", { exact: true }).first()).toBeVisible();
  await expect(main.getByText(countdownPattern).first()).toBeVisible();
  await expect.poll(async () => (await evidence(request)).requests.some((call) => call.path === "/v1/bids/mine" && new URLSearchParams(call.query).get("page") === "1")).toBe(true);
  await capture(page, info, "my-bids-desktop");
  await main.getByRole("navigation", { name: "My bid status", exact: true }).getByRole("link", { name: /^Won\b/ }).click();
  await expect(main.getByRole("link", { name: "Won collector watch", exact: true }).first()).toBeVisible();
  await expect(main.getByRole("cell", { name: "Won", exact: true })).toBeVisible();
  await expect(main.getByText("Settled", { exact: true })).toHaveCount(0);
  await main.getByRole("navigation", { name: "My bid status", exact: true }).getByRole("link", { name: /^Lost\b/ }).click();
  await expect(main.getByRole("link", { name: "Lost collector watch", exact: true }).first()).toBeVisible();
  const result = await evidence(request);
  expect(result.requests.filter((call) => call.path === "/v1/bids/mine").every((call) => call.authorized)).toBe(true);
});

test("an auction payment timeout alone never displays or accepts an offer", async ({ page, request }) => {
  await control(request, { status: "PAYMENT_TIMEOUT" });
  await signIn(page);
  await expect.poll(async () => (await evidence(request)).requests.filter((call) => call.path === "/v1/auctions/offers/me").length).toBeGreaterThan(0);
  await expect(page.getByRole("article", { name: offerLabel, exact: true })).toHaveCount(0);
  expect((await evidence(request)).offerRequests).toHaveLength(0);
  expect((await evidence(request)).offerOrders).toBe(0);
});

test("T5 seller offer accepts once then confirms the address and opens the returned payment group", async ({ page, request }, info) => {
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
  expect(result.offerRequests).toHaveLength(1);
  expect(result.offerRequests[0]).toMatchObject({ action: "accept", authorized: true, path: `/v1/auctions/offers/${offerId}/accept` });
  expect(Object.keys(result.offerRequests[0].body ?? {})).toEqual([]);
  expect(result.offerOrders).toBe(1);
  expect(result.shippingRequests).toHaveLength(0);
  expect(result.paymentRequests).toHaveLength(0);
  await control(request, { mode: "shipping-slow" });
  const checkout = await fillOfferAddress(page);
  await checkout.getByRole("button", { name: "Review address", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "Confirm shipping address", exact: true });
  await expect(confirmation).toContainText("12 Nguyen Hue");
  await expect(confirmation).toContainText("Ben Nghe Ward");
  expect((await evidence(request)).shippingRequests).toHaveLength(0);
  await confirmation.getByRole("button", { name: "Back to address", exact: true }).click();
  await expect(confirmation).not.toBeVisible();
  await checkout.getByLabel("House number and street", { exact: true }).fill("22 Le Loi");
  await checkout.getByRole("button", { name: "Review address", exact: true }).click();
  await expect(confirmation).toContainText("22 Le Loi");
  await expect(confirmation).not.toContainText("12 Nguyen Hue");
  expect((await evidence(request)).shippingRequests).toHaveLength(0);
  await confirmation.getByRole("button", { name: "Confirm shipping address", exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(confirmation.getByRole("button", { name: "Confirming…", exact: true })).toBeDisabled();
  const total = card.getByRole("region", { name: "Confirmed auction total", exact: true });
  await expect(total.getByText("4.800.490 ₫", { exact: true })).toBeVisible();
  await expect(total.getByText("490 ₫", { exact: true })).toBeVisible();
  await expect(total.getByRole("link", { name: "Continue to payment", exact: true })).toHaveAttribute("href", `/checkout/payment/${orderGroupId}`);
  const confirmed = await evidence(request);
  expect(confirmed.shippingRequests).toEqual([{ authorized: true, body: { recipientName: "Second Chance Buyer", phoneNumber: "0901234567", addressLine: "22 Le Loi", wardCode: "20308", provinceCode: "202", countryCode: "VN" } }]);
  expect(confirmed.shippingWrites).toBe(1);
  expect(confirmed.requests.some((call) => call.method === "POST" && call.path === `/v1/orders/${orderId}/shipping-confirmation` && call.authorized)).toBe(true);
  await capture(page, info, "second-chance-shipping");
  await total.getByRole("link", { name: "Continue to payment", exact: true }).click();
  await expect(page).toHaveURL(`/checkout/payment/${orderGroupId}`);
  await expect(page.getByRole("heading", { name: "Scan to pay", exact: true })).toBeVisible();
  const qr = page.getByRole("img", { name: "Payment QR code", exact: true });
  await expect(qr).toBeVisible();
  await expect.poll(async () => qr.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByTestId("payment-order-group-id")).toHaveText(orderGroupId);
  const payment = await evidence(request);
  expect(payment.offerOrders).toBe(1);
  expect(payment.shippingWrites).toBe(1);
  expect(payment.paymentRequests.length).toBeGreaterThan(0);
  expect(payment.paymentRequests.every((call) => call.authorized && JSON.stringify(call.body) === JSON.stringify({ orderGroupId }))).toBe(true);
  expect(payment.qrRequests).toBeGreaterThan(0);
  await capture(page, info, "second-chance-payment", false);
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

test("accepted offer shipping recovers a lost response with the same immutable address", async ({ page, request }) => {
  await control(request, { sellerOffers: true });
  await signIn(page);
  const card = page.getByRole("article", { name: offerLabel, exact: true });
  await card.getByRole("button", { name: "Accept offer", exact: true }).click();
  await expect(card.getByText("Offer accepted. Your order has been created.", { exact: true })).toBeVisible();
  await control(request, { mode: "shipping-lost-response" });
  const checkout = await fillOfferAddress(page);
  await checkout.getByRole("button", { name: "Review address", exact: true }).click();
  await page.getByRole("dialog", { name: "Confirm shipping address", exact: true }).getByRole("button", { name: "Confirm shipping address", exact: true }).click();
  await expect(checkout.getByRole("alert").filter({ hasText: /result is unknown/ })).toBeVisible();
  await expect(checkout.getByLabel("House number and street", { exact: true })).toBeDisabled();
  await control(request, { mode: "offers-unavailable" });
  // The existing global query configuration disables focus refresh. Observe
  // the offer feature's real 15-second background read with the form mounted.
  await expect(page.getByRole("alert").filter({ hasText: "Second chance offers are currently unavailable." })).toBeVisible({ timeout: 20_000 });
  await expect(checkout.getByLabel("House number and street", { exact: true })).toHaveValue("12 Nguyen Hue");
  await control(request, { mode: "normal" });
  await checkout.getByRole("button", { name: "Retry same address", exact: true }).click();
  await expect(card.getByRole("link", { name: "Continue to payment", exact: true })).toHaveAttribute("href", `/checkout/payment/${orderGroupId}`);
  const result = await evidence(request);
  expect(result.shippingRequests).toHaveLength(2);
  expect(result.shippingRequests[0].body).toEqual(result.shippingRequests[1].body);
  expect(result.shippingRequests.every((call) => call.authorized)).toBe(true);
  expect(result.shippingWrites).toBe(1);
  expect(result.offerOrders).toBe(1);
});

test("accepted offer payment deadline closes an already-open address form without a shipping write", async ({ page, request }) => {
  await control(request, { sellerOffers: true });
  await signIn(page);
  const card = page.getByRole("article", { name: offerLabel, exact: true });
  await card.getByRole("button", { name: "Accept offer", exact: true }).click();
  await expect(card.getByText("Offer accepted. Your order has been created.", { exact: true })).toBeVisible();
  await fillOfferAddress(page);
  await control(request, { offerPaymentDueAt: new Date(Date.now() - 1000).toISOString() });
  await expect(card.getByText(/payment deadline has passed/i)).toBeVisible({ timeout: 20_000 });
  await expect(card.getByRole("button", { name: "Confirm address and pay", exact: true })).toHaveCount(0);
  await expect(card.getByRole("link", { name: "Continue to payment", exact: true })).toHaveCount(0);
  expect((await evidence(request)).shippingRequests).toHaveLength(0);
});

test("multiple accepted offers keep shipping field labels and values independent", async ({ page, request }) => {
  await control(request, { sellerOffers: true });
  await signIn(page);
  const first = page.getByRole("article", { name: offerLabel, exact: true });
  await first.getByRole("button", { name: "Accept offer", exact: true }).click();
  await expect(first.getByText("Offer accepted. Your order has been created.", { exact: true })).toBeVisible();
  await control(request, { secondAcceptedOffer: true });
  await page.reload();
  const second = page.getByRole("article", { name: "Second chance offer for Rolex Datejust 36mm, Jubilee Bracelet", exact: true });
  await first.getByRole("button", { name: "Confirm address and pay", exact: true }).click();
  await second.getByRole("button", { name: "Confirm address and pay", exact: true }).click();
  const firstName = first.getByLabel("Recipient name", { exact: true });
  const secondName = second.getByLabel("Recipient name", { exact: true });
  await firstName.fill("First Recipient");
  await secondName.fill("Second Recipient");
  await expect(firstName).toHaveValue("First Recipient");
  await expect(secondName).toHaveValue("Second Recipient");
  expect(await firstName.getAttribute("id")).not.toEqual(await secondName.getAttribute("id"));
  const ids = await page.getByRole("main").locator("[id]").evaluateAll((nodes) => nodes.map((node) => node.id));
  expect(new Set(ids).size).toBe(ids.length);
  expect((await evidence(request)).shippingRequests).toHaveLength(0);
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
  await expect(page.getByRole("link", { name: title, exact: true }).getByText(countdownPattern)).toBeVisible();
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
