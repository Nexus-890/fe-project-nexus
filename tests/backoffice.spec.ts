import { expect, test, type Page, type APIRequestContext } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

test.skip(!process.env.NEXUS_BACKOFFICE_TEST, "Run with playwright.backoffice.config.ts for the explicit back-office HTTP simulation.");
const api = "http://127.0.0.1:3920/api";
const provider = "http://127.0.0.1:3920/keycloak";
const identities: Record<string, string> = { BUYER: "68000000-0000-4000-8000-000000000003", SELLER: "68000000-0000-4000-8000-000000000002", ADMIN: "68000000-0000-4000-8000-000000000001", SUPPORT_STAFF: "68000000-0000-4000-8000-000000000004" };
const evidence = async (request: APIRequestContext) => (await request.get(`${api}/test/evidence`)).json();
async function signIn(page: Page, request: APIRequestContext, role: string, destination?: string) {
  const primary = role.split(",").includes("SELLER") ? "SELLER" : role.split(",")[0];
  expect((await request.get(`${provider}/test/control?roles=${encodeURIComponent(role)}&subject=${identities[primary]}`)).ok()).toBe(true);
  await page.goto(`/sign-in${destination ? `?returnTo=${encodeURIComponent(destination)}` : ""}`);
  await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/keycloak\/realms\/nexus\/protocol\/openid-connect\/auth\?/);
  await page.getByLabel("Email", { exact: true }).fill(`${primary.toLowerCase()}@nexus.local`);
  await page.getByLabel("Password", { exact: true }).fill("Fixture-pass-123!");
  await page.getByRole("button", { name: "Sign in at Keycloak", exact: true }).click();
}
const backofficeNav = (page: Page) => page.getByRole("navigation", { name: "Back-office navigation", exact: true });

test.beforeEach(async ({ request }) => {
  expect((await request.get(`${provider}/test/reset`)).ok()).toBe(true);
  expect((await request.post(`${api}/test/reset`)).ok()).toBe(true);
});

for (const role of ["SELLER", "ADMIN", "SUPPORT_STAFF", "BUYER", "BUYER,SELLER"]) {
  test(`${role} lands by flat JWT roles without a returnTo`, async ({ page, request }) => {
    await signIn(page, request, role);
    if (role === "BUYER") {
      await expect(page).toHaveURL("/");
      await expect(page.getByRole("link", { name: "Back office", exact: true })).toHaveCount(0);
      await page.goto("/backoffice");
      await expect(page.getByRole("heading", { name: "Access denied", exact: true })).toBeVisible();
      expect((await evidence(request)).requests.filter((row: { path: string }) => /products\/mine|inventory\/intake|orders\/sales/.test(row.path))).toEqual([]);
    } else {
      await expect(page).toHaveURL("/backoffice");
      await expect(backofficeNav(page)).toBeVisible();
      await expect(backofficeNav(page).getByRole("link", { name: "Products", exact: true })).toHaveCount(role.includes("SELLER") ? 1 : 0);
      await expect(backofficeNav(page).getByRole("link", { name: "Stock", exact: true })).toHaveCount(role === "ADMIN" ? 1 : 0);
      await expect(backofficeNav(page).getByRole("link", { name: "Users", exact: true })).toHaveCount(["ADMIN", "SUPPORT_STAFF"].includes(role) ? 1 : 0);
    }
  });
}

test("JWT roles override profile roles and privileges cannot grant a Buyer back-office access", async ({ page, request }) => {
  await request.post(`${api}/test/control`, { data: { profileRole: ["ADMIN"] } });
  await signIn(page, request, "BUYER");
  await expect(page).toHaveURL("/");
  await page.goto("/backoffice/stock");
  await expect(page.getByRole("heading", { name: "Access denied", exact: true })).toBeVisible();
  expect((await evidence(request)).requests.some((row: { path: string }) => row.path === "/api/v1/inventory/intake")).toBe(false);
});

test("anonymous returnTo is restored and a Seller cannot restore an Admin-only destination", async ({ page, request }) => {
  await page.goto("/backoffice/products");
  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Fbackoffice%2Fproducts$/);
  await signIn(page, request, "SELLER", "/backoffice/products");
  await expect(page).toHaveURL("/backoffice/products");
  await expect(page.getByRole("heading", { name: "Products", exact: true })).toBeVisible();
  const other = await page.context().browser()!.newContext();
  const second = await other.newPage();
  try {
    await signIn(second, request, "SELLER", "/backoffice/stock");
    await expect(second).toHaveURL("/backoffice");
    await second.goto("/backoffice/stock");
    await expect(second.getByRole("heading", { name: "Access denied", exact: true })).toBeVisible();
    expect((await evidence(request)).requests.some((row: { path: string }) => row.path === "/api/v1/inventory/intake")).toBe(false);
  } finally { await other.close(); }
});

test("Seller lists a product, Admin stocks it, Buyer checks out, simulated callback produces paid Seller sales", async ({ page: seller, browser, request }) => {
  test.setTimeout(150_000);
  await signIn(seller, request, "SELLER", "/backoffice/products/new");
  await expect(seller.getByRole("heading", { name: "New Product", exact: true })).toBeVisible();
  await seller.getByLabel("Product Name", { exact: true }).fill("Back-office end-to-end demo headphones");
  await seller.getByLabel("Category", { exact: true }).selectOption("69000000-0000-4000-8000-000000000103");
  await seller.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(seller).toHaveURL(/\/backoffice\/products\/[0-9a-f-]{36}$/);
  let state = await evidence(request);
  const productId = state.products[0].id;
  await expect(seller.getByRole("heading", { name: "Edit Product", exact: true })).toBeVisible();
  const activeRadio = seller.getByRole("radio", { name: "Active", exact: true });
  if (await activeRadio.count()) await activeRadio.check();
  const publish = seller.getByRole("button", { name: /^(?:Publish|Apply status)$/ });
  await expect(publish).toBeDisabled();
  await seller.getByRole("button", { name: "Add SKU", exact: true }).click();
  const pendingCode = seller.getByRole("textbox", { name: "SKU code new SKU", exact: true });
  await expect(pendingCode).toHaveValue("Generated when saved");
  await expect(pendingCode).not.toBeEditable();
  await seller.getByRole("textbox", { name: /^color / }).fill("Black");
  await seller.getByRole("textbox", { name: /^size / }).fill("Standard");
  await seller.getByRole("textbox", { name: /^price / }).fill("150000");
  await seller.getByRole("button", { name: "Save SKU", exact: true }).click();
  await expect.poll(async () => (await evidence(request)).products[0].skus.length).toBe(1);
  state = await evidence(request);
  const generatedCode = state.products[0].skus[0].skuCode;
  expect(generatedCode).toBe(`SKU-${productId.replaceAll("-", "")}-01`);
  const savedCode = seller.getByRole("textbox", { name: `SKU code ${generatedCode}`, exact: true });
  await expect(savedCode).toHaveValue(generatedCode);
  await expect(savedCode).not.toBeEditable();
  expect(state.requests.find((row: { method: string; path: string }) => row.method === "POST" && row.path === `/api/v1/products/${productId}/skus`).body).toEqual({ color: "Black", size: "Standard", price: 150000 });
  const persistedSkuId = state.products[0].skus[0].id;
  await seller.getByRole("button", { name: "Save SKU", exact: true }).click();
  await expect.poll(async () => (await evidence(request)).requests.some((row: { method: string; path: string }) => row.method === "PUT" && row.path === `/api/v1/skus/${persistedSkuId}`)).toBe(true);
  state = await evidence(request);
  expect(state.products[0].skus).toHaveLength(1);
  expect(state.products[0].skus[0].skuCode).toBe(generatedCode);
  expect(state.requests.find((row: { method: string; path: string }) => row.method === "PUT" && row.path === `/api/v1/skus/${persistedSkuId}`).body).toEqual({ color: "Black", size: "Standard", price: 150000 });
  await expect(savedCode).toHaveValue(generatedCode);
  await expect(publish).toBeDisabled();
  await seller.getByLabel("Product image file", { exact: true }).setInputFiles({ name: "sample.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") });
  await expect(publish).toBeEnabled();
  await request.post(`${api}/test/control`, { data: { rejectPublish: true } });
  await publish.click();
  await expect(seller.getByRole("main").getByRole("alert")).toContainText("Fixture: rejected status change");
  await request.post(`${api}/test/control`, { data: { rejectPublish: false } });
  await publish.click();
  await expect.poll(async () => (await evidence(request)).products[0].status).toBe("ACTIVE");
  await seller.reload();
  await expect(seller.getByLabel("Product Name", { exact: true })).toHaveValue("Back-office end-to-end demo headphones");
  state = await evidence(request); const skuId = state.products[0].skus[0].id;

  const adminContext = await browser.newContext(), buyerContext = await browser.newContext();
  const adminPage = await adminContext.newPage(), buyerPage = await buyerContext.newPage();
  try {
    await signIn(adminPage, request, "ADMIN", "/backoffice/stock");
    await adminPage.getByLabel("Product", { exact: true }).selectOption(productId);
    await adminPage.getByLabel("SKU", { exact: true }).selectOption(skuId);
    await adminPage.getByLabel("Quantity", { exact: true }).fill("10");
    await adminPage.getByRole("button", { name: "Add stock", exact: true }).click();
    await expect.poll(async () => (await evidence(request)).balances[skuId]?.available).toBe(10);
    await expect(adminPage.getByRole("status")).toContainText(/10/);
    await signIn(buyerPage, request, "BUYER", `/products/${productId}`);
    await expect(buyerPage.getByTestId("product-stock")).toHaveText("In stock · 10 available");
    await buyerPage.getByRole("button", { name: /Add to cart/i }).click();
    await expect.poll(async () => (await evidence(request)).requests.some((row: { method: string; path: string }) => row.method === "POST" && row.path === "/api/v1/carts/me/items")).toBe(true);
    await buyerPage.goto("/checkout");
    await buyerPage.getByLabel("Province / City", { exact: true }).selectOption("202");
    await buyerPage.getByLabel("District", { exact: true }).selectOption("1442");
    await buyerPage.getByLabel("Ward", { exact: true }).selectOption("20308");
    await buyerPage.getByRole("button", { name: "Review address", exact: true }).click();
    await buyerPage.getByRole("button", { name: "Place order", exact: true }).click();
    await expect(buyerPage).toHaveURL(/\/checkout\/payment\/[0-9a-f-]{36}$/);
    await expect(buyerPage.getByRole("heading", { name: "Scan to pay", exact: true })).toBeVisible();
    state = await evidence(request); const groupId = Object.keys(state.groups)[0];
    expect(state.orders[0].status).toBe("PENDING");
    // This test-only callback explicitly models #156. It is no evidence that live settlement exists.
    expect((await request.post(`${api}/test/payment-confirmed`, { data: { groupId } })).ok()).toBe(true);
    await seller.goto("/backoffice/sales");
    const table = seller.getByRole("table", { name: "Seller orders", exact: true });
    await expect(table).toContainText("NX-BACKOFFICE-DEMO");
    await expect(table).toContainText("Demo Buyer");
    await expect(table).toContainText(generatedCode);
    await expect(table).toContainText("Paid");
    state = await evidence(request);
    expect(state.requests.some((row: { method: string; path: string; role: string }) => row.method === "POST" && row.path === "/api/v1/inventory/intake" && row.role === "ADMIN")).toBe(true);
    expect(state.requests.some((row: { method: string; path: string; role: string }) => row.method === "POST" && row.path === "/api/v1/orders" && row.role === "BUYER")).toBe(true);
    const output = path.resolve("../docs/backoffice-evidence"); await mkdir(output, { recursive: true });
    await writeFile(path.join(output, "mock-demo-evidence.json"), JSON.stringify({ environment: "synthetic Postman HTTP simulation; real frontend; payment callback models missing #156", checkedAt: new Date().toISOString(), operations: state.requests, product: state.products[0], order: state.orders[0] }, null, 2));
    for (const [name, screen] of [["seller-paid-sales", seller], ["admin-stock", adminPage]] as const) {
      await screen.screenshot({ path: path.join(output, `mock-${name}-1440.png`), fullPage: true, caret: "initial", style: "nextjs-portal { visibility: hidden !important; }" });
      await screen.setViewportSize({ width: 375, height: 812 });
      expect(await screen.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await screen.screenshot({ path: path.join(output, `mock-${name}-375.png`), fullPage: true, caret: "initial", style: "nextjs-portal { visibility: hidden !important; }" });
    }
  } finally { await adminContext.close(); await buyerContext.close(); }
});
