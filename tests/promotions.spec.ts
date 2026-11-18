import { expect, test, type Page, type APIRequestContext } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const evidenceDir = path.join(tmpdir(), "nexus-promotions-269-evidence");

test.skip(!process.env.NEXUS_PROMOTIONS_TEST, "Use playwright.promotions.config.ts for explicit HTTP simulation.");
const api = `http://127.0.0.1:${process.env.NEXUS_BACKOFFICE_API_PORT || "3920"}`;
const identities: Record<string, string> = { BUYER: "68000000-0000-4000-8000-000000000003", SELLER: "68000000-0000-4000-8000-000000000002", ADMIN: "68000000-0000-4000-8000-000000000001" };
async function signIn(page: Page, request: APIRequestContext, role: string, returnTo: string) {
  const primary = role.split(",").includes("SELLER") ? "SELLER" : role;
  await request.get(`${api}/keycloak/test/control?roles=${encodeURIComponent(role)}&subject=${identities[primary]}`);
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(`${primary.toLowerCase()}@nexus.local`);
  await page.getByLabel("Password", { exact: true }).fill("Fixture-pass-123!");
  await page.getByRole("button", { name: "Sign in at Keycloak", exact: true }).click();
  await expect(page).toHaveURL(returnTo);
}
async function layouts(page: Page, name: string) {
  await mkdir(evidenceDir, { recursive: true });
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: path.join(evidenceDir, `${name}-${width}.png`), fullPage: true });
  }
}
async function createVoucher(page: Page, code: string, eventId?: string, shop = false) {
  await page.getByRole("button", { name: "Create voucher", exact: true }).click();
  const form = page.getByRole("region", { name: "New voucher", exact: true });
  await form.getByLabel("Voucher code", { exact: true }).fill(code);
  await form.getByLabel("Voucher name", { exact: true }).fill(`${code} savings`);
  if (eventId) { await form.getByRole("combobox", { name: "Source", exact: true }).selectOption("EVENT"); await form.getByLabel("Event ID", { exact: true }).fill(eventId); await form.getByRole("combobox", { name: "Funding", exact: true }).selectOption("CO_FUNDED"); await form.getByLabel("Seller funding (%)", { exact: true }).fill("25"); }
  await form.getByLabel("Discount (VND)", { exact: true }).fill("50000");
  await form.getByLabel("Minimum order (VND)", { exact: true }).fill(code === "TOOHIGH" ? "99999999" : "100000");
  await form.getByLabel("Claim limit (optional)", { exact: true }).fill("100");
  await form.getByLabel("Claims open", { exact: true }).fill("2026-11-01T00:00");
  await form.getByLabel("Claims close", { exact: true }).fill("2026-11-30T00:00");
  await form.getByLabel("Valid from", { exact: true }).fill(eventId ? "2026-11-21T00:00" : "2026-11-01T00:00");
  await form.getByLabel("Valid until", { exact: true }).fill("2026-11-30T23:00");
  await form.getByLabel("Terms", { exact: true }).fill("One use per buyer. Seller funding is accepted at joining.");
  if (shop) await form.getByRole("combobox", { name: "Product scope", exact: true }).selectOption("SELECTED");
  await form.getByRole("button", { name: "Save voucher", exact: true }).click();
  await expect(page.getByRole("region", { name: `Edit ${code}`, exact: true })).toBeVisible();
}
test.beforeEach(async ({ request }) => { await request.get(`${api}/keycloak/test/reset`); await request.post(`${api}/api/test/reset`); });

test("admin event review and seller voucher terms complete through the real UI", async ({ page, request, browser }) => {
  await signIn(page, request, "ADMIN", "/backoffice/promotions");
  await page.getByRole("button", { name: "Create event", exact: true }).click();
  const editor = page.getByRole("region", { name: "New event", exact: true });
  await editor.getByLabel("Event name", { exact: true }).fill("Nexus November");
  for (const [label, date] of [["Registration opens", "2026-11-01T00:00"], ["Registration closes", "2026-11-20T00:00"], ["Event starts", "2026-11-21T00:00"], ["Event ends", "2026-12-01T00:00"]]) await editor.getByLabel(label, { exact: true }).fill(date);
  await editor.getByRole("button", { name: "Save event", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: "Nexus November" });
  await row.getByRole("button", { name: "Open registration", exact: true }).click();
  await expect(row).toContainText("REGISTRATION_OPEN");
  await layouts(page, "admin-events");
  const sellerContext = await browser.newContext(); const seller = await sellerContext.newPage();
  await signIn(seller, request, "SELLER", "/backoffice/vouchers");
  await seller.getByRole("row").filter({ hasText: "Nexus November" }).getByRole("button", { name: "Register", exact: true }).click();
  await expect(seller.getByRole("status").filter({ hasText: "Registration pending." })).toBeVisible();
  await page.reload(); await page.getByRole("button", { name: "Registrations", exact: true }).click();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByRole("region", { name: "Seller registrations", exact: true })).toContainText("APPROVED");
  const eventRequest = (await (await request.get(`${api}/api/test/evidence`)).json()).requests.find((r: { method: string; path: string }) => r.method === "PATCH" && r.path.endsWith("/status"));
  const eventId = eventRequest.path.split("/").at(-2);
  await page.getByRole("button", { name: "Platform / event vouchers", exact: true }).click();
  await page.getByRole("combobox", { name: "Voucher source", exact: true }).selectOption("EVENT");
  await createVoucher(page, "EVENT50", eventId);
  await page.getByRole("button", { name: "Close editor", exact: true }).click();
  await page.getByRole("row").filter({ hasText: "EVENT50" }).getByRole("button", { name: "Activate", exact: true }).click();
  await seller.getByRole("combobox", { name: "Voucher source", exact: true }).selectOption("EVENT");
  await seller.getByRole("button", { name: "Review terms", exact: true }).click();
  await expect(seller.getByRole("button", { name: "Accept and join voucher", exact: true })).toBeDisabled();
  await seller.getByLabel("I accept these terms and the seller funding percentage.").check();
  await seller.getByRole("button", { name: "Accept and join voucher", exact: true }).click();
  await expect(seller.getByRole("status").filter({ hasText: "seller funding 25%" })).toBeVisible();
  const evidence = await (await request.get(`${api}/api/test/evidence`)).json();
  expect(evidence.requests.find((r: { method: string; path: string }) => r.method === "POST" && /vouchers\/.+\/sellers$/.test(r.path)).body).toEqual({ acceptedTermsVersion: 1 });
  await layouts(seller, "seller-terms"); await sellerContext.close();
});

test("an ADMIN and SELLER account keeps the seller voucher and event workflow", async ({ page, request }) => {
  await request.post(`${api}/api/test/seller-seed`, { data: { withoutOrders: true } });
  await signIn(page, request, "ADMIN,SELLER", "/backoffice/promotions");
  await page.getByRole("button", { name: "Create event", exact: true }).click();
  const editor = page.getByRole("region", { name: "New event", exact: true });
  await editor.getByLabel("Event name", { exact: true }).fill("Mixed November");
  for (const [label, date] of [["Registration opens", "2026-11-01T00:00"], ["Registration closes", "2026-11-20T00:00"], ["Event starts", "2026-11-21T00:00"], ["Event ends", "2026-12-01T00:00"]]) await editor.getByLabel(label, { exact: true }).fill(date);
  await editor.getByRole("button", { name: "Save event", exact: true }).click();
  await page.getByRole("row").filter({ hasText: "Mixed November" }).getByRole("button", { name: "Open registration", exact: true }).click();
  await page.goto("/backoffice/vouchers");
  const workspace = page.getByRole("navigation", { name: "Voucher workspace", exact: true });
  await expect(workspace.getByRole("link", { name: "Manage vouchers", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("combobox", { name: "Voucher source", exact: true }).locator("option")).toHaveText(["PLATFORM", "EVENT"]);
  await expect(page.getByRole("button", { name: "Register", exact: true })).toHaveCount(0);
  await workspace.getByRole("link", { name: "My shop vouchers", exact: true }).click();
  await expect(page).toHaveURL("/backoffice/vouchers?view=seller");
  await expect(workspace.getByRole("link", { name: "My shop vouchers", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("combobox", { name: "Voucher source", exact: true }).locator("option")).toHaveText(["SHOP", "EVENT"]);
  await page.getByRole("row").filter({ hasText: "Mixed November" }).getByRole("button", { name: "Register", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Registration pending." })).toBeVisible();
  await createVoucher(page, "MIXED50", undefined, true);
  await page.getByRole("button", { name: "Close editor", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: "MIXED50" })).toBeVisible();
  const requests = (await (await request.get(`${api}/api/test/evidence`)).json()).requests as { method: string; path: string; body?: { sourceType?: string } }[];
  expect(requests.filter((r) => r.method === "POST" && /\/registrations$/.test(r.path))).toHaveLength(1);
  expect(requests.find((r) => r.method === "POST" && /\/vouchers$/.test(r.path))?.body?.sourceType).toBe("SHOP");
  await layouts(page, "mixed-seller-vouchers");
  await workspace.getByRole("link", { name: "Manage vouchers", exact: true }).click();
  await expect(page).toHaveURL("/backoffice/vouchers");
  await expect(page.getByRole("combobox", { name: "Voucher source", exact: true }).locator("option")).toHaveText(["PLATFORM", "EVENT"]);
});

test("admin activates, buyer claims and checks out; cart, preview, order and seller funding agree", async ({ page, request, browser }) => {
  const seeded = await (await request.post(`${api}/api/test/seller-seed`, { data: { withoutOrders: true } })).json();
  await signIn(page, request, "ADMIN", "/backoffice/vouchers");
  for (const code of ["NEXUS50", "TOOHIGH", "SECOND50"]) {
    await createVoucher(page, code); await page.getByRole("button", { name: "Close editor", exact: true }).click();
    await page.getByRole("row").filter({ hasText: code }).getByRole("button", { name: "Activate", exact: true }).click();
    await expect(page.getByRole("row").filter({ hasText: code })).toContainText("ACTIVE");
  }
  await layouts(page, "admin-vouchers");
  const sellerContext = await browser.newContext(); const seller = await sellerContext.newPage();
  await signIn(seller, request, "SELLER", "/backoffice/vouchers");
  await createVoucher(seller, "SHOP50", undefined, true);
  await seller.getByRole("checkbox", { name: "Studio Wireless Headphones", exact: true }).check();
  await seller.getByRole("button", { name: "Save products", exact: true }).click();
  await expect(seller.getByRole("checkbox", { name: "Studio Wireless Headphones", exact: true })).toBeChecked();
  await seller.getByRole("button", { name: "Close editor", exact: true }).click();
  await seller.getByRole("row").filter({ hasText: "SHOP50" }).getByRole("button", { name: "Activate", exact: true }).click();
  await expect(seller.getByRole("row").filter({ hasText: "SHOP50" })).toContainText("ACTIVE");
  await layouts(seller, "seller-shop-vouchers");
  const buyerContext = await browser.newContext(); const buyer = await buyerContext.newPage();
  await signIn(buyer, request, "BUYER", `/products/demo-${seeded.data.productId}`);
  const vouchers = buyer.getByRole("region", { name: "Available vouchers", exact: true });
  await expect(vouchers.getByRole("button", { name: "Claim", exact: true })).toHaveCount(4);
  while (await vouchers.getByRole("button", { name: "Claim", exact: true }).count()) { await vouchers.getByRole("button", { name: "Claim", exact: true }).first().click(); await expect(vouchers.getByRole("button", { name: "Claimed", exact: true }).last()).toBeVisible(); }
  await buyer.reload(); await vouchers.getByRole("button", { name: "Claim", exact: true }).first().click();
  await expect(vouchers.getByRole("alert")).toContainText("Voucher already claimed");
  await buyer.getByRole("button", { name: "Add to Cart", exact: true }).click();
  await buyer.goto("/vouchers"); await expect(buyer.getByRole("heading", { name: "NEXUS50 savings", exact: true })).toBeVisible(); await layouts(buyer, "wallet");
  await buyer.goto("/backoffice/promotions"); await expect(buyer.getByRole("heading", { name: "Access denied", exact: true })).toBeVisible();
  await buyer.goto("/cart"); const picker = buyer.getByRole("region", { name: "Voucher picker", exact: true });
  await picker.getByRole("checkbox", { name: /NEXUS50/ }).check();
  await expect(buyer.getByRole("complementary", { name: "Order summary" }).getByText("− 50.000 ₫", { exact: true })).toBeVisible();
  await picker.getByRole("checkbox", { name: /TOOHIGH/ }).check();
  await expect(picker.locator("label").filter({ hasText: "TOOHIGH" })).toContainText("Add 95.199.999 ₫ more");
  await picker.getByRole("checkbox", { name: /TOOHIGH/ }).uncheck();
  await picker.getByRole("checkbox", { name: /SECOND50/ }).check();
  await expect(picker.locator("label").filter({ hasText: "SECOND50" })).toContainText("Only one platform/event voucher");
  await picker.getByRole("checkbox", { name: /SECOND50/ }).uncheck();
  await picker.getByRole("checkbox", { name: /SHOP50/ }).check();
  await layouts(buyer, "cart-picker");
  await buyer.getByRole("link", { name: "Proceed to Checkout", exact: true }).click();
  await buyer.getByLabel("Province / City", { exact: true }).selectOption("202"); await buyer.getByLabel("Ward", { exact: true }).selectOption("20308");
  await expect(buyer.getByTestId("checkout-total")).toHaveText("4.710.000,00 ₫");
  await layouts(buyer, "checkout-voucher");
  await test.step("Place discounted order", async () => { await buyer.getByRole("button", { name: "Place order", exact: true }).click(); });
  await test.step("Reach group payment", async () => { await expect(buyer).toHaveURL(/\/checkout\/payment\//); });
  const state = await (await request.get(`${api}/api/test/evidence`)).json();
  expect(state.orders[0].discountAmount).toBe(100000); expect(state.orders[0].totalAmount).toBe(4710000); expect(state.orders[0].vouchers[0].code).toBe("NEXUS50");
  await test.step("Open My orders", async () => { await buyer.goto("/orders"); }); await buyer.locator("details summary").filter({ hasText: "Show price breakdown" }).click(); await expect(buyer.getByText("NEXUS50", { exact: true })).toBeVisible();
  await buyer.getByRole("link", { name: "NX-BACKOFFICE-DEMO", exact: true }).click(); await expect(buyer.getByRole("complementary", { name: "Order receipt" })).toContainText("NEXUS50");
  await layouts(buyer, "order-discount");
  await seller.reload(); await seller.getByRole("button", { name: "Usages", exact: true }).click();
  await expect(seller.getByRole("region", { name: "Voucher usages", exact: true })).toContainText("50.000 ₫");
  await seller.goto("/backoffice/sales"); await seller.getByRole("button", { name: "Awaiting Payment", exact: true }).click();
  await expect(seller.getByText("SHOP50 · Seller funded 50.000 ₫", { exact: true })).toBeVisible();
  await buyerContext.close(); await sellerContext.close();
});
