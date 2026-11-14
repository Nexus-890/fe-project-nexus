import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

test.skip(!process.env.NEXUS_ORDER_LIST_TEST, "Requires the order HTTP simulation.");

const simulation = `http://127.0.0.1:${process.env.NEXUS_ORDER_LIST_PORT || "3914"}/api`;
const provider = `http://127.0.0.1:${process.env.NEXUS_TEST_PROVIDER_PORT || process.env.NEXUS_OIDC_SIM_PORT || "3913"}`;
const orderId = "68000000-0000-4000-8000-000000000002";

async function control(request: APIRequestContext, path: string) {
  expect((await request.get(`${simulation}/test/${path}`)).ok()).toBe(true);
}

async function signIn(page: Page) {
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(`/order/${orderId}`)}`);
  await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("buyer@nexus.local");
  await page.getByLabel("Password", { exact: true }).fill("Fixture-pass-123!");
  await page.getByRole("button", { name: "Sign in at Keycloak", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/order/${orderId}$`));
}

test.beforeEach(async ({ page, request }) => {
  expect((await request.get(`${provider}/keycloak/test/reset`)).ok()).toBe(true);
  expect((await request.get(`${provider}/api/test/reset`)).ok()).toBe(true);
  await control(request, "reset");
  await page.route("**/api/v1/carts/me", (route) => route.fulfill({ json: {
    code: 0, message: "response success", data: {
      id: "order-header-cart", userId: "68000000-0000-4000-8000-000000000003", status: "ACTIVE", items: [],
    },
  } }));
});

test("completed order rates the seller once and retains that state after reload", async ({ page, request }, info) => {
  await control(request, `order?id=${orderId}&status=COMPLETED`);
  await signIn(page);
  await page.getByRole("button", { name: "Rate the seller", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Rate the seller", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("radio", { name: "4 stars", exact: true }).focus();
  await page.keyboard.press("Space");
  await dialog.getByLabel("Review (optional)", { exact: true }).fill("  Arrived quickly and well packed.  ");
  const mobileCapture = info.outputPath("rating-modal-mobile.png");
  await page.screenshot({ path: mobileCapture, fullPage: true });
  await info.attach("rating-modal-mobile", { path: mobileCapture, contentType: "image/png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1060 });
  const desktopCapture = info.outputPath("rating-modal-desktop.png");
  await page.screenshot({ path: desktopCapture, fullPage: true });
  await info.attach("rating-modal-desktop", { path: desktopCapture, contentType: "image/png" });
  await dialog.getByRole("button", { name: "Submit Rating", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "You rated this seller 4 out of 5." })).toBeVisible();
  const calls = await (await request.get(`${simulation}/test/evidence`)).json();
  expect(calls.ratingWrites).toHaveLength(1);
  expect(calls.ratingWrites[0]).toMatchObject({ authorized: true, body: {
    orderId, toUserId: "68000000-0000-4000-8000-000000000004", score: 4, comment: "Arrived quickly and well packed.",
  } });
  expect(calls.ratingWrites[0].body).not.toHaveProperty("fromUserId");
  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "You rated this seller 4 out of 5." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Rate the seller", exact: true })).toHaveCount(0);
});

test("delivered order does not grant rating eligibility", async ({ page, request }) => {
  await control(request, `order?id=${orderId}&status=DELIVERED`);
  await signIn(page);
  await expect(page.getByRole("button", { name: "Order received", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Rate the seller", exact: true })).toHaveCount(0);
  const calls = await (await request.get(`${simulation}/test/evidence`)).json();
  expect(calls.ratingReads).toEqual([]);
  expect(calls.ratingWrites).toEqual([]);
});

test("unavailable rating lookup prevents duplicate submissions and recovers independently", async ({ page, request }) => {
  await control(request, `order?id=${orderId}&status=COMPLETED`);
  await control(request, "rating-mode?mode=unavailable");
  await signIn(page);
  await expect(page.getByRole("alert").filter({ hasText: "Unable to check your rating." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Rate the seller", exact: true })).toHaveCount(0);
  await control(request, "rating-mode?mode=success");
  await page.getByRole("button", { name: "Retry rating", exact: true }).click();
  await expect(page.getByRole("button", { name: "Rate the seller", exact: true })).toBeVisible();
  const calls = await (await request.get(`${simulation}/test/evidence`)).json();
  expect(calls.ratingWrites).toEqual([]);
});

test("rating conflict refreshes the existing rating without retrying the write", async ({ page, request }) => {
  await control(request, `order?id=${orderId}&status=COMPLETED`);
  await control(request, "rating-mode?mode=conflict");
  await signIn(page);
  await page.getByRole("button", { name: "Rate the seller", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Rate the seller", exact: true });
  await dialog.getByRole("radio", { name: "5 stars", exact: true }).focus();
  await page.keyboard.press("Space");
  await dialog.getByRole("button", { name: "Submit Rating", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "You rated this seller 5 out of 5." })).toBeVisible();
  const calls = await (await request.get(`${simulation}/test/evidence`)).json();
  expect(calls.ratingWrites).toHaveLength(1);
});

test("product and auction views show the seller score and trust level returned over HTTP", async ({ page, request }) => {
  await signIn(page);
  const sellerId = "68000000-0000-4000-8000-000000000004";
  await page.route("**/api/v1/products/1", (route) => route.fulfill({ json: {
    code: 0, message: "response success", data: {
      id: "1", name: "Seller reputation product", slug: "seller-reputation", categoryId: "electronics",
      sellerId, status: "ACTIVE", minPrice: 150000, maxPrice: 150000,
      description: "Seller reputation acceptance fixture.", auctionEnable: true, images: [],
      skus: [{ id: "sku-1", productId: "1", skuCode: "DEFAULT", color: null, size: null, price: 150000, status: "ACTIVE" }],
    },
  } }));
  await page.goto("/products/seller-reputation?id=1");
  const reputation = page.getByRole("region", { name: "Seller reputation", exact: true });
  await expect(reputation).toContainText("78/100");
  await expect(reputation).toContainText("Trusted");
  const auctionId = "68000000-0000-4000-8000-000000000011";
  const auctionProductId = "68000000-0000-4000-8000-000000000012";
  const auction = {
    id: auctionId, sellerId, productId: auctionProductId, skuId: "68000000-0000-4000-8000-000000000013",
    title: "Auction reputation fixture", imageUrl: null, startingPrice: 100000, bidIncrement: 10000,
    currentPrice: 150000, bidCount: 2, currency: "VND", status: "ACTIVE",
    startAt: "2026-01-01T00:00:00Z", endAt: "2099-01-01T00:00:00Z", originalEndAt: "2099-01-01T00:00:00Z", extensionCount: 0,
  };
  await page.route(`**/api/v1/auctions/${auctionId}`, (route) => route.fulfill({ json: { code: 0, message: "response success", data: auction } }));
  await page.route(`**/api/v1/products/${auctionProductId}`, (route) => route.fulfill({ json: {
    code: 0, message: "response success", data: {
      id: auctionProductId, name: "Auction reputation fixture", slug: "auction-fixture", categoryId: "electronics",
      sellerId, status: "ACTIVE", minPrice: 150000, maxPrice: 150000,
      description: "Verified auction item details", auctionEnable: true, images: [], skus: [],
    },
  } }));
  await page.route("**/api/v1/auctions?**", (route) => route.fulfill({ json: {
    code: 0, message: "response success", data: [{
      ...auction,
    }], page: { number: 0, size: 5, totalElements: 1, totalPages: 1 },
  } }));
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Live auctions ending soon", exact: true })
    .getByRole("region", { name: "Seller reputation", exact: true })).toContainText("78/100");
  await page.getByRole("link").filter({ hasText: "Auction reputation fixture" }).click();
  await expect(page).toHaveURL(new RegExp(`/auctions/${auctionId}$`));
  await expect(page.getByRole("heading", { name: "Auction reputation fixture", exact: true })).toBeVisible();
  const roomSeller = page.getByRole("region", { name: "Seller information", exact: true });
  await expect(roomSeller).toContainText("78/100");
  await expect(roomSeller).toContainText("Trusted");
  await expect(page.getByRole("region", { name: "Item details", exact: true })).toContainText("Verified auction item details");
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const calls = await (await request.get(`${simulation}/test/evidence`)).json();
  expect(calls.reputations.some((call: { userId: string; authorized: boolean }) => call.userId === sellerId && call.authorized)).toBe(true);
});
