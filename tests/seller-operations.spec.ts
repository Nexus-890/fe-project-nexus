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

test("second-chance offer needs confirmation and advances at each bidder's own price", async ({ page, request }) => {
  const evidence = async () => (await (await request.get(`${api}/test/offers/evidence`)).json()).data;
  await signIn(page, request, "SELLER", "/backoffice/auctions");
  await page.getByRole("button", { name: "Payment timeout", exact: true }).click();
  await page.getByRole("button", { name: "Offer to next bidder", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Second-chance offer", exact: true });
  await expect(dialog).toContainText("Bidder B");
  expect((await evidence()).emails).toHaveLength(0);
  const send = dialog.getByRole("button", { name: "Confirm and send offer", exact: true });
  await expect(send).toBeDisabled();
  await dialog.getByRole("checkbox").check();
  await send.click();
  await expect(dialog.getByText("Awaiting response", { exact: true })).toBeVisible();
  let state = await evidence();
  expect(state.emails).toHaveLength(1);
  expect(state.offers[0].amount).toBe(4800000);
  expect(state.offers[0].bidderId).not.toBe(state.originalWinnerId);
  await expect(send).toBeDisabled();
  await screenshot(page, "second-chance");
  await request.post(`${api}/test/offer-response`, { data: { status: "DECLINED" } });
  await dialog.getByRole("button", { name: "Refresh offers", exact: true }).click();
  await expect(dialog).toContainText("Bidder C");
  await dialog.getByRole("checkbox").check();
  await send.click();
  await expect.poll(async () => (await evidence()).emails.length).toBe(2);
  state = await evidence();
  expect(state.emails).toHaveLength(2);
  expect(state.offers[0].amount).toBe(4600000);
  await request.post(`${api}/test/offer-response`, { data: { status: "ACCEPTED" } });
  await dialog.getByRole("button", { name: "Refresh offers", exact: true }).click();
  await expect(dialog.getByText("Accepted", { exact: true })).toBeVisible();
  state = await evidence();
  expect(state.orders).toHaveLength(1);
  expect(state.orders[0].totalAmount).toBe(4600000);
  expect(state.orders[0].userId).not.toBe(state.originalWinnerId);
  await request.post(`${api}/test/offer-response`, { data: { status: "PAID" } });
  expect((await evidence()).auctionStatus).toBe("SETTLED");
  await page.goto("/backoffice/auctions");
  await page.getByRole("button", { name: "Settled", exact: true }).click();
  const settled = page.getByRole("row").filter({ hasText: "Studio auction — unpaid winner" }).filter({ has: page.getByRole("button", { name: "Offer history", exact: true }) }).first();
  await settled.getByRole("button", { name: "Offer history", exact: true }).click();
  await expect(page.getByRole("dialog").getByText("Accepted", { exact: true })).toBeVisible();
});

test("seller banks remain masked and admin payout appears in own history", async ({ page, browser, request }) => {
  await signIn(page, request, "SELLER", "/backoffice/bank-accounts");
  await expect(page.getByRole("heading", { name: "Bank accounts", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add bank account", exact: true }).click();
  await page.getByLabel("Bank name", { exact: true }).fill("Vietcombank");
  await page.getByLabel("Bank code", { exact: true }).fill("VCB");
  await page.getByLabel("Account holder", { exact: true }).fill("Demo Seller");
  await page.getByLabel("Account number", { exact: true }).fill("123456789012");
  await page.getByRole("button", { name: "Save bank account", exact: true }).click();
  await expect(page.getByText("Bank account added. Verification is pending.", { exact: true })).toBeVisible();
  await expect(page.getByText("•••• 9012", { exact: true })).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain("123456789012");
  await screenshot(page, "bank-accounts");
  const context = await browser.newContext();
  try {
    const admin = await context.newPage();
    const adminRead = admin.waitForRequest((req) => new URL(req.url()).pathname.endsWith("/v1/payouts/payable-orders"));
    await signIn(admin, request, "ADMIN", "/backoffice/admin-payouts");
    const adminHeaders = await (await adminRead).allHeaders();
    await expect(admin.getByRole("button", { name: "Review payout", exact: true }).first()).toBeDisabled();
    expect((await request.post(`${api}/test/payouts-verify`, { headers: { Authorization: adminHeaders.authorization } })).ok()).toBe(true);
    await admin.reload();
    await admin.getByRole("button", { name: "Review payout", exact: true }).first().click();
    await admin.getByRole("button", { name: "Confirm payout", exact: true }).click();
    await expect(admin.getByRole("status").filter({ hasText: "Payout recorded" })).toBeVisible();
    await screenshot(admin, "admin-payouts");
    await page.goto("/backoffice/payouts");
    await expect(page.getByRole("table")).toContainText("Vietcombank");
    await screenshot(page, "payout-history");
    const state = (await (await request.get(`${api}/test/payouts/evidence`)).json()).data;
    expect(state.payouts).toHaveLength(1);
    expect(JSON.stringify(state)).not.toContain("123456789012");
  } finally { await context.close(); }
});
