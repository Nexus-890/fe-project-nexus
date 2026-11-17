import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test.skip(!process.env.NEXUS_BACKOFFICE_TEST, "Uses the explicit seller Postman HTTP simulation.");
const simulationOrigin = `http://127.0.0.1:${process.env.NEXUS_BACKOFFICE_API_PORT || "3920"}`;
const api = `${simulationOrigin}/api`;
const provider = `${simulationOrigin}/keycloak`;
const ids = { SELLER: "68000000-0000-4000-8000-000000000002", ADMIN: "68000000-0000-4000-8000-000000000001" };
async function signIn(page: Page, request: APIRequestContext, role: keyof typeof ids, destination: string) {
  await request.get(`${provider}/test/control?roles=${role}&subject=${ids[role]}`);
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(destination)}`);
  await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(`${role.toLowerCase()}@nexus.local`);
  await page.getByLabel("Password", { exact: true }).fill("Fixture-pass-123!");
  await page.getByRole("button", { name: "Sign in at Keycloak", exact: true }).click();
  await expect(page).toHaveURL(destination);
}
async function screenshot(page: Page, name: string) {
  await mkdir("test-results/seller-operations", { recursive: true });
  await page.screenshot({ path: `test-results/seller-operations/${name}-1440.png`, fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/seller-operations/${name}-375.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
}
test.beforeEach(async ({ request }) => {
  await request.get(`${provider}/test/reset`);
  await request.post(`${api}/test/reset`);
  expect((await request.post(`${api}/test/seller-seed`)).ok()).toBe(true);
});

test("seller creates, edits and schedules a three-minute auction and can cancel another", async ({ page, request }) => {
  await signIn(page, request, "SELLER", "/backoffice/auctions");
  await expect(page.getByRole("heading", { name: "Auctions", exact: true })).toBeVisible();
  await screenshot(page, "auctions");
  await page.getByRole("link", { name: "Create Auction", exact: true }).click();
  await page.getByRole("combobox", { name: "Product", exact: true }).selectOption("a2250000-0000-4000-8000-000000000001");
  const state = await (await request.get(`${api}/test/evidence`)).json();
  expect(state.requests.some((row: { path: string; query: Record<string, string> }) => row.path === "/api/v1/products/mine" && row.query.status === "ACTIVE")).toBe(true);
  await page.getByRole("combobox", { name: "SKU", exact: true }).selectOption("a2250000-0000-4000-8000-000000000002");
  await page.getByRole("button", { name: "Use 3-minute demo", exact: true }).click();
  await page.getByLabel("Starting Price (VND)", { exact: true }).fill("4800000");
  await screenshot(page, "create-auction");
  await page.getByRole("button", { name: "Save Draft", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Edit Auction", exact: true })).toBeVisible();
  await page.getByLabel("Bid Increment (VND)", { exact: true }).fill("20000");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await page.getByRole("button", { name: "Schedule Auction", exact: true }).click();
  await expect(page.getByText("SCHEDULED", { exact: true })).toBeVisible();
  await page.goto("/backoffice/auctions");
  await page.getByRole("button", { name: "Scheduled", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: "Studio auction — scheduled" });
  await row.getByRole("button", { name: "Cancel", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Cancel auction", exact: true });
  await dialog.getByLabel("Reason", { exact: true }).fill("Demo complete");
  await dialog.getByRole("button", { name: "Cancel Auction", exact: true }).click();
  await expect(page.getByText("Auction cancelled.", { exact: true })).toBeVisible();
  // Accelerated dependency clock verifies rendered lifecycle responses; this is not a live scheduler test.
  await request.post(`${api}/test/auctions/advance`, { data: { milliseconds: 120_000 } });
  await page.getByRole("button", { name: "Active", exact: true }).click();
  const created = page.getByRole("row").filter({ hasText: "Studio Wireless Headphones" });
  await expect(created).toContainText("Live");
  await expect(created.getByRole("link", { name: "Edit", exact: true })).toHaveCount(0);
  await request.post(`${api}/test/auctions/advance`, { data: { milliseconds: 180_000 } });
  await page.getByRole("button", { name: "Failed", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: "Studio Wireless Headphones" })).toContainText("failed");
});

test("deleting a product clears its cached auction picker entry", async ({ page, request }) => {
  expect((await request.post(`${api}/test/seller-seed`, { data: { withoutOrders: true } })).ok()).toBe(true);
  await signIn(page, request, "SELLER", "/backoffice/auctions/new");
  const productId = "a2250000-0000-4000-8000-000000000001";
  const nav = page.getByRole("navigation", { name: "Back-office navigation", exact: true });
  const product = page.getByRole("combobox", { name: "Product", exact: true });
  await product.selectOption(productId);
  await page.getByRole("combobox", { name: "SKU", exact: true }).selectOption("a2250000-0000-4000-8000-000000000002");
  await nav.getByRole("link", { name: "Products", exact: true }).click();
  await page.getByRole("link", { name: "Studio Wireless Headphones", exact: true }).click();
  await page.getByRole("button", { name: "Delete product", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete", exact: true }).click();
  await expect(page).toHaveURL("/backoffice/products");
  await nav.getByRole("link", { name: "Auctions", exact: true }).click();
  await page.getByRole("link", { name: "Create Auction", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "No eligible products" })).toBeVisible();
  await expect(product.locator(`option[value="${productId}"]`)).toHaveCount(0);
});

test("sales combines status and full-day Vietnam date filters", async ({ page, request }) => {
  await signIn(page, request, "SELLER", "/backoffice/sales");
  await page.getByRole("button", { name: "All", exact: true }).click();
  const table = page.getByRole("table", { name: "Seller orders", exact: true });
  await expect(table).toContainText("NX-SELLER-1");
  await expect(table).toContainText("NX-SELLER-2");
  await page.getByLabel("From date", { exact: true }).fill("2026-11-14");
  await page.getByLabel("To date", { exact: true }).fill("2026-11-14");
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(table).toContainText("NX-SELLER-1");
  await expect(table).not.toContainText("NX-SELLER-2");
  const evidence = await (await request.get(`${api}/test/evidence`)).json();
  expect(evidence.requests.some((row: { path: string; query: Record<string, string> }) => row.path === "/api/v1/orders/sales" && row.query.from === "2026-11-14T00:00:00.000+07:00" && row.query.to === "2026-11-14T23:59:59.999+07:00")).toBe(true);
  await screenshot(page, "sales");
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await expect(page.getByText("No orders with this status.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear dates", exact: true }).click();
  await expect(table).toContainText("NX-SELLER-2");
});

test("accepted offer history survives payment timeout and the seller can offer to the next bidder", async ({ page, request }) => {
  const evidence = async () => (await (await request.get(`${api}/test/offers/evidence`)).json()).data;
  await signIn(page, request, "SELLER", "/backoffice/auctions");
  await page.getByRole("button", { name: "Payment timeout", exact: true }).click();
  await page.getByRole("button", { name: "Offer to next bidder", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Second-chance offer", exact: true });
  await expect(dialog).toContainText("B***B");
  expect((await evidence()).emails).toHaveLength(0);
  const send = dialog.getByRole("button", { name: "Confirm and send offer", exact: true });
  await expect(send).toBeDisabled();
  await dialog.getByRole("checkbox").check();
  await send.click();
  await expect(dialog.getByText("Awaiting response", { exact: true })).toBeVisible();
  expect((await evidence()).offers[0].status).toBe("OFFERED");
  await expect(send).toHaveCount(0);
  await request.post(`${api}/test/offer-response`, { data: { status: "ACCEPTED" } });
  await page.goto("/backoffice/auctions");
  await page.getByRole("button", { name: "Won", exact: true }).click();
  const acceptedRow = page.getByRole("row").filter({ hasText: "Studio auction — unpaid winner" });
  await acceptedRow.getByRole("button", { name: "Offer history", exact: true }).click();
  await expect(dialog.getByText("Accepted", { exact: true })).toBeVisible();
  await expect(send).toHaveCount(0);
  await request.post(`${api}/test/offer-response`, { data: { status: "PAYMENT_TIMEOUT" } });
  await page.goto("/backoffice/auctions");
  await page.getByRole("button", { name: "Payment timeout", exact: true }).click();
  await page.getByRole("button", { name: "Offer to next bidder", exact: true }).click();
  await expect(dialog).toContainText("C***C");
  await expect(dialog.getByText("Accepted", { exact: true })).toBeVisible();
  await dialog.getByRole("checkbox").check();
  await send.click();
  await expect(dialog.getByText("Awaiting response", { exact: true })).toBeVisible();
  let state = await evidence();
  expect(state.emails).toHaveLength(2);
  expect(state.offers[0].amount).toBe(4600000);
  expect(state.offers.map((offer: { status: string }) => offer.status)).toEqual(["OFFERED", "ACCEPTED"]);
  expect(state.offers.every((offer: { bidderId: string }) => offer.bidderId !== state.originalWinnerId)).toBe(true);
  await screenshot(page, "second-chance-after-timeout");
  await request.post(`${api}/test/offer-response`, { data: { status: "ACCEPTED" } });
  await request.post(`${api}/test/offer-response`, { data: { status: "PAID" } });
  await page.goto("/backoffice/auctions");
  await page.getByRole("button", { name: "Settled", exact: true }).click();
  await page.getByRole("row").filter({ hasText: "Studio auction — unpaid winner" }).getByRole("button", { name: "Offer history", exact: true }).click();
  await expect(dialog.getByText("Accepted", { exact: true })).toHaveCount(2);
  state = await evidence();
  expect(state.orders).toHaveLength(2);
  expect(state.orders[1].totalAmount).toBe(4600000);
  expect(state.auctionStatus).toBe("SETTLED");
});

test("seller has no offer button when the timed-out auction has no next bidder", async ({ page, request }) => {
  let previews = 0;
  await page.route("**/api/v1/auctions/*/second-chance-offers", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    previews++;
    await route.fulfill({ response, json: { ...body, data: { ...body.data, canOffer: false, eligibilityUnavailable: false, candidate: null, offers: [] } } });
  });
  await signIn(page, request, "SELLER", "/backoffice/auctions");
  await page.getByRole("button", { name: "Payment timeout", exact: true }).click();
  await expect.poll(() => previews).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "Offer to next bidder", exact: true })).toHaveCount(0);
  const state = await (await request.get(`${api}/test/offers/evidence`)).json();
  expect(state.data.emails).toHaveLength(0);
});

for (const withHistory of [false, true]) {
  test(`seller can retry eligibility outage ${withHistory ? "with preserved history" : "before any offer"}`, async ({ page, request }) => {
    await signIn(page, request, "SELLER", "/backoffice/auctions");
    await page.getByRole("button", { name: "Payment timeout", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Second-chance offer", exact: true });
    if (withHistory) {
      await page.getByRole("button", { name: "Offer to next bidder", exact: true }).click();
      await expect(dialog.getByRole("region", { name: "Next eligible bidder", exact: true })).toContainText("B***B");
      await dialog.getByRole("checkbox").check();
      await dialog.getByRole("button", { name: "Confirm and send offer", exact: true }).click();
      await expect(dialog.getByText("Awaiting response", { exact: true })).toBeVisible();
      await request.post(`${api}/test/offer-response`, { data: { status: "DECLINED" } });
      await dialog.getByRole("button", { name: "Close", exact: true }).click();
    }
    expect((await request.post(`${api}/test/offers/eligibility`, { data: { unavailable: true } })).ok()).toBe(true);
    await page.reload();
    await page.getByRole("button", { name: "Payment timeout", exact: true }).click();
    await page.getByRole("button", { name: "Check bidder availability", exact: true }).click();
    await expect(dialog.getByRole("status").filter({ hasText: "Bidder eligibility could not be checked. Please try again." })).toBeVisible();
    await expect(dialog.getByText(/No next bidder is currently eligible/)).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Confirm and send offer", exact: true })).toHaveCount(0);
    if (withHistory) await expect(dialog.getByText("Declined", { exact: true })).toBeVisible();
    else await expect(dialog.getByText("No offers have been sent.", { exact: true })).toBeVisible();
    let attempts = 0;
    await page.route("**/api/v1/auctions/*/second-chance-offers", async (route) => {
      if (route.request().method() === "GET") attempts++;
      await route.continue();
    });
    await dialog.getByRole("button", { name: "Retry eligibility check", exact: true }).click();
    await expect.poll(() => attempts).toBeGreaterThan(0);
    await expect(dialog.getByRole("button", { name: "Retry eligibility check", exact: true })).toBeEnabled();
    expect((await request.post(`${api}/test/offers/eligibility`, { data: { unavailable: false } })).ok()).toBe(true);
    await dialog.getByRole("button", { name: "Retry eligibility check", exact: true }).click();
    await expect(dialog.getByRole("region", { name: "Next eligible bidder", exact: true })).toContainText(withHistory ? "C***C" : "B***B");
    await expect(dialog.getByRole("button", { name: "Confirm and send offer", exact: true })).toBeDisabled();
    const state = await (await request.get(`${api}/test/offers/evidence`)).json();
    expect(state.data.offers).toHaveLength(withHistory ? 1 : 0);
    expect(state.data.emails).toHaveLength(withHistory ? 1 : 0);
    expect(state.data.orders).toHaveLength(0);
  });
}

test("shop profile and masked default bank release automatic payouts after verification", async ({ page, browser, request }) => {
  await signIn(page, request, "SELLER", "/backoffice/payouts");
  await page.getByLabel("Company name", { exact: true }).fill("Chung Audio Shop");
  await page.getByLabel("Contact phone", { exact: true }).fill("0909876543");
  await page.getByRole("button", { name: "Save shop profile", exact: true }).click();
  await expect(page.getByText("Shop profile saved.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add bank account", exact: true }).click();
  await page.getByLabel("Bank code (NAPAS BIN)", { exact: true }).fill("970436");
  await page.getByLabel("Account holder name", { exact: true }).fill("CHUNG AUDIO");
  await page.getByLabel("Account number", { exact: true }).fill("000012349012");
  await page.getByRole("button", { name: "Save bank account", exact: true }).click();
  await expect(page.getByText("Bank account saved. Verification is pending.", { exact: true })).toBeVisible();
  const account = page.locator("section").filter({ has: page.getByText("•••• 9012", { exact: true }) });
  await account.getByRole("button", { name: "Set as default", exact: true }).click();
  await expect(account.getByRole("button", { name: "Default account", exact: true })).toBeDisabled();
  expect(await page.locator("body").innerText()).not.toContain("000012349012");
  const completion = { orderId: "95000000-0000-4000-8000-000000000002", sellerId: ids.SELLER, status: "COMPLETED", funded: true, refund: false, orderAmount: "4800000.00", shippingFee: "30000.00", platformFeeRate: "0.0500" };
  const completed = (await (await request.post(`${api}/test/payouts/order-completed`, { data: completion })).json()).data;
  const payoutId = completed.payout.id;
  expect(completed.payout.status).toBe("ON_HOLD");
  await request.post(`${api}/test/payouts/order-completed`, { data: completion });
  await page.reload();
  await expect(page.getByLabel("Company name", { exact: true })).toHaveValue("Chung Audio Shop");
  await expect(page.getByRole("table", { name: "Your payout history", exact: true })).toContainText("On hold");
  await screenshot(page, "seller-automatic-payout-on-hold");
  const context = await browser.newContext();
  try {
    const admin = await context.newPage();
    await signIn(admin, request, "ADMIN", "/backoffice/payouts");
    await expect(admin.getByRole("button", { name: "Confirm payout", exact: true })).toHaveCount(0);
    const bankRow = admin.getByRole("row").filter({ hasText: "9012" });
    await bankRow.getByRole("button", { name: "Review bank account", exact: true }).click();
    await admin.getByRole("button", { name: "Confirm bank verification", exact: true }).click();
    await expect(admin.getByRole("status").filter({ hasText: "Bank account verified." })).toBeVisible();
    let state = (await (await request.get(`${api}/test/payouts/evidence`)).json()).data;
    expect(state.payouts).toHaveLength(1);
    expect(state.payouts[0].status).toBe("PENDING");
    await request.post(`${api}/test/payouts/provider`, { data: { payoutId, outcome: "PROCESSING" } });
    await page.reload();
    await page.getByRole("table", { name: "Your payout history", exact: true }).getByRole("button", { name: "View payout", exact: true }).click();
    await expect(page.getByText("The provider is processing the transfer.", { exact: false })).toBeVisible();
    await request.post(`${api}/test/payouts/provider`, { data: { payoutId, outcome: "SUCCEEDED" } });
    await page.getByRole("button", { name: "Refresh payout status", exact: true }).click();
    await expect(page.getByText("History · newest first", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Payout amount breakdown")).toContainText("4.531.500,00 ₫");
    await expect(page.getByText("Simulated", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry payout", exact: true })).toHaveCount(0);
    await screenshot(page, "seller-payout-detail-history");
    // Changing bank details resets verification but cannot change the sent payout snapshot.
    await page.getByRole("button", { name: "Edit bank account", exact: true }).last().click();
    await page.getByLabel("Account holder name", { exact: true }).fill("CHUNG AUDIO UPDATED");
    await page.getByLabel("Account number", { exact: true }).fill("000055558888");
    await page.getByRole("button", { name: "Save bank account", exact: true }).click();
    await expect(page.getByText("•••• 8888", { exact: true })).toBeVisible();
    state = (await (await request.get(`${api}/test/payouts/evidence`)).json()).data;
    expect(state.payouts[0].recipientAccountLast4).toBe("9012");
    const banks = (await (await request.get(`${api}/test/seller-accounts/evidence`)).json()).data;
    expect(banks.accounts.find((bank: { accountLast4: string }) => bank.accountLast4 === "8888").verificationStatus).toBe("UNVERIFIED");
    expect(JSON.stringify(banks)).not.toContain("000055558888");
    const calls = (await (await request.get(`${api}/test/evidence`)).json()).requests;
    expect(calls.some((row: { method: string; path: string }) => row.method === "POST" && ["/api/v1/payouts", "/api/v1/payments/payouts"].includes(row.path))).toBe(false);
  } finally { await context.close(); }
});

test("admin must review the changed bank again after a stale version conflict", async ({ page, request, browser }) => {
  await signIn(page, request, "ADMIN", "/backoffice/payouts");
  const sellerContext = await browser.newContext();
  try {
    const sellerPage = await sellerContext.newPage();
    await signIn(sellerPage, request, "SELLER", "/backoffice/bank-accounts");
    await expect(sellerPage.getByRole("button", { name: "Edit bank account", exact: true })).toBeVisible();
    await page.getByRole("row").filter({ hasText: "4321" })
      .getByRole("button", { name: "Review bank account", exact: true }).click();
    await expect(page.getByRole("button", { name: "Confirm bank verification", exact: true })).toBeVisible();
    await sellerPage.getByRole("button", { name: "Edit bank account", exact: true }).click();
    await sellerPage.getByLabel("Account holder name", { exact: true }).fill("CHANGED AFTER ADMIN REVIEW");
    await sellerPage.getByLabel("Account number", { exact: true }).fill("000000008888");
    await sellerPage.getByRole("button", { name: "Save bank account", exact: true }).click();
    await expect(sellerPage.getByText("•••• 8888", { exact: true })).toBeVisible();
    const stale = page.waitForResponse((response) => response.url().endsWith("/seller-bank-accounts/95000000-0000-4000-8000-000000000001/verify"));
    await page.getByRole("button", { name: "Confirm bank verification", exact: true }).click();
    const rejected = await stale;
    expect(rejected.status()).toBe(409);
    expect(rejected.request().postDataJSON().expectedVersion).toBe(0);
    await expect(page.getByRole("alert").filter({ hasText: "Bank details changed since you opened this review" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm bank verification", exact: true })).toHaveCount(0);
    await expect(page.getByRole("row").filter({ hasText: "8888" })).toContainText("UNVERIFIED");
    const state = (await (await request.get(`${api}/test/seller-accounts/evidence`)).json()).data;
    expect(state.accounts[0]).toMatchObject({ accountLast4: "8888", verificationStatus: "UNVERIFIED", version: 1 });
    await page.getByRole("row").filter({ hasText: "8888" })
      .getByRole("button", { name: "Review bank account", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Bank details changed since you opened this review" })).toHaveCount(0);
    await page.getByRole("button", { name: "Confirm bank verification", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Bank account verified." })).toBeVisible();
  } finally { await sellerContext.close(); }
});

test("admin needs-action filters and payout retries preserve one request key", async ({ page, request }) => {
  await signIn(page, request, "ADMIN", "/backoffice/payouts");
  const bankRow = page.getByRole("row").filter({ hasText: "4321" });
  await bankRow.getByRole("button", { name: "Review bank account", exact: true }).click();
  await page.getByRole("button", { name: "Confirm bank verification", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Bank account verified." })).toBeVisible();
  const create = async (number: number) => (await (await request.post(`${api}/test/payouts/order-completed`, { data: { orderId: `96000000-0000-4000-8000-${String(number).padStart(12, "0")}`, sellerId: ids.SELLER, status: "COMPLETED", funded: true, refund: false, orderAmount: "120000.00", shippingFee: "20000.00" } })).json()).data.payout;
  const failed = await create(1), unknown = await create(2), succeeded = await create(3);
  for (const [payout, outcome] of [[failed, "FAILED"], [unknown, "UNKNOWN"], [succeeded, "SUCCEEDED"]] as const)
    await request.post(`${api}/test/payouts/provider`, { data: { payoutId: payout.id, outcome } });
  await page.reload();
  const table = page.getByRole("table", { name: "Seller payouts", exact: true });
  await expect(table).toContainText("Failed"); await expect(table).toContainText("Unknown"); await expect(table).not.toContainText("Succeeded");
  const failedRow = table.getByRole("row").filter({ hasText: `Payout ${failed.id.slice(0, 8)}` });
  await failedRow.getByRole("button", { name: "View payout", exact: true }).click();
  let attempts = 0; const keys: string[] = [];
  await page.route(`**/v1/payments/payouts/${failed.id}/retry`, async (route) => {
    keys.push(route.request().headers()["idempotency-key"]); attempts++;
    if (attempts === 1) await route.fulfill({ status: 503, contentType: "application/problem+json", body: JSON.stringify({ status: 503, title: "Temporary outage", detail: "Retry this request" }) });
    else if (attempts === 3) {
      const response = await route.fetch(); expect(response.ok()).toBe(true);
      await route.fulfill({ status: 503, contentType: "application/problem+json", body: JSON.stringify({ status: 503, title: "Response interrupted", detail: "Check the retry outcome" }) });
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Retry payout", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Retry this request" })).toBeVisible();
  await page.getByRole("button", { name: "Retry same request", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "The payout retry was recorded." })).toBeVisible();
  expect(keys).toHaveLength(2); expect(keys[1]).toBe(keys[0]);
  // A later failed attempt is a new action. An interrupted response after commit
  // is reconciled as PENDING, and the following failure also needs a fresh key.
  await request.post(`${api}/test/payouts/provider`, { data: { payoutId: failed.id, outcome: "FAILED" } });
  await page.getByRole("button", { name: "Refresh payout status", exact: true }).click();
  await page.getByRole("button", { name: "Retry payout", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Check the retry outcome" })).toContainText("Check the updated status");
  await expect(page.getByRole("button", { name: "Retry same request", exact: true })).toHaveCount(0);
  await request.post(`${api}/test/payouts/provider`, { data: { payoutId: failed.id, outcome: "FAILED" } });
  await page.getByRole("button", { name: "Refresh payout status", exact: true }).click();
  await page.getByRole("button", { name: "Retry payout", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "The payout retry was recorded." })).toBeVisible();
  expect(keys).toHaveLength(4); expect(keys[2]).not.toBe(keys[1]); expect(keys[3]).not.toBe(keys[2]);
  await page.getByRole("button", { name: "Close detail", exact: true }).click();
  await table.getByRole("row").filter({ hasText: `Payout ${unknown.id.slice(0, 8)}` }).getByRole("button", { name: "View payout", exact: true }).click();
  await expect(page.getByText("The transfer outcome is unknown.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry payout", exact: true })).toHaveCount(0);
  await screenshot(page, "admin-payout-needs-action-unknown");
});
