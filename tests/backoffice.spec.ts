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
      if (!role.split(",").includes("BUYER")) expect((await evidence(request)).requests.some((row: { path: string }) => row.path.startsWith("/api/v1/carts"))).toBe(false);
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
  expect(await seller.getByLabel("Weight (g) new SKU", { exact: true }).evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
  expect((await evidence(request)).requests.filter((row: { method: string; path: string }) => row.method === "POST" && row.path === `/api/v1/products/${productId}/skus`)).toHaveLength(0);
  await seller.getByLabel("Weight (g) new SKU", { exact: true }).fill("1200");
  await seller.getByLabel("Length (cm) new SKU", { exact: true }).fill("30");
  await seller.getByLabel("Width (cm) new SKU", { exact: true }).fill("20");
  await seller.getByLabel("Height (cm) new SKU", { exact: true }).fill("15");
  const costPrice = seller.getByRole("textbox", { name: "cost price new SKU", exact: true });
  await costPrice.fill("-1");
  await seller.getByRole("button", { name: "Save SKU", exact: true }).click();
  await expect(seller.getByRole("main").getByRole("alert")).toContainText("Enter a cost price of zero or more");
  expect((await evidence(request)).requests.filter((row: { method: string; path: string }) => row.method === "POST" && row.path === `/api/v1/products/${productId}/skus`)).toHaveLength(0);
  await costPrice.fill("90000");
  await seller.getByRole("button", { name: "Save SKU", exact: true }).click();
  await expect.poll(async () => (await evidence(request)).products[0].skus.length).toBe(1);
  state = await evidence(request);
  const generatedCode = state.products[0].skus[0].skuCode;
  expect(generatedCode).toBe(`SKU-${productId.replaceAll("-", "")}-01`);
  const savedCode = seller.getByRole("textbox", { name: `SKU code ${generatedCode}`, exact: true });
  await expect(savedCode).toHaveValue(generatedCode);
  await expect(savedCode).not.toBeEditable();
  expect(state.requests.find((row: { method: string; path: string }) => row.method === "POST" && row.path === `/api/v1/products/${productId}/skus`).body).toEqual({ color: "Black", size: "Standard", price: 150000, costPrice: 90000, shippingParcel: { weightGrams: 1200, lengthCm: 30, widthCm: 20, heightCm: 15 } });
  await expect(seller.getByRole("button", { name: "Save SKU", exact: true })).toHaveCount(0);
  await expect(seller.getByTestId(`cost-price-${state.products[0].skus[0].id}`)).toHaveText("90.000,00 ₫");
  await expect(seller.getByTestId(`selling-price-${state.products[0].skus[0].id}`)).toHaveText("150.000,00 ₫");
  await expect(seller.getByText("Publish the product to add stock for this SKU.", { exact: true })).toBeVisible();
  await expect(publish).toBeDisabled();
  await seller.getByLabel("Product image file", { exact: true }).setInputFiles({ name: "sample.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") });
  await expect(publish).toBeEnabled();
  await request.post(`${api}/test/control`, { data: { rejectPublish: true } });
  await publish.click();
  await expect(seller.getByRole("main").getByRole("alert")).toContainText("Fixture: rejected status change");
  await request.post(`${api}/test/control`, { data: { rejectPublish: false } });
  await publish.click();
  await expect.poll(async () => (await evidence(request)).products[0].status).toBe("ACTIVE");
  const publicProduct = await (await request.get(`${api}/v1/products/${productId}`)).json();
  expect(publicProduct.data.minPrice).toBe(150000);
  expect(JSON.stringify(publicProduct)).not.toContain("costPrice");
  await seller.reload();
  await expect(seller.getByTestId(`cost-price-${state.products[0].skus[0].id}`)).toHaveText("90.000,00 ₫");
  await expect(seller.getByLabel("Product Name", { exact: true })).toHaveValue("Back-office end-to-end demo headphones");
  state = await evidence(request); const skuId = state.products[0].skus[0].id;
  await expect(seller.getByTestId(`stock-${skuId}`)).toHaveText("0");
  const quantityToAdd = seller.getByLabel(`Quantity to add ${generatedCode}`, { exact: true });
  await quantityToAdd.fill("0");
  await seller.getByRole("button", { name: "Add stock", exact: true }).click();
  expect((await evidence(request)).requests.some((row: { path: string }) => row.path === "/api/v1/inventory/intake")).toBe(false);
  await quantityToAdd.fill("6");
  await seller.getByRole("button", { name: "Add stock", exact: true }).click();
  await expect(seller.getByRole("status").filter({ hasText: "Added 6 units" })).toContainText("Available now: 6.");
  await expect(seller.getByTestId(`stock-${skuId}`)).toHaveText("6");
  await expect(quantityToAdd).toHaveValue("");
  state = await evidence(request);
  expect(state.requests.find((row: { method: string; path: string; role: string }) => row.method === "POST" && row.path === "/api/v1/inventory/intake" && row.role === "SELLER").body).toEqual({ skuId, quantity: 6 });

  const adminContext = await browser.newContext(), buyerContext = await browser.newContext();
  const adminPage = await adminContext.newPage(), buyerPage = await buyerContext.newPage();
  try {
    await signIn(adminPage, request, "ADMIN", "/backoffice/stock");
    await adminPage.getByLabel("Product", { exact: true }).selectOption(productId);
    await adminPage.getByLabel("SKU", { exact: true }).selectOption(skuId);
    await adminPage.getByLabel("Quantity", { exact: true }).fill("4");
    await adminPage.getByRole("button", { name: "Add stock", exact: true }).click();
    await expect.poll(async () => (await evidence(request)).balances[skuId]?.available).toBe(10);
    await expect(adminPage.getByRole("status")).toContainText(/10/);
    await signIn(buyerPage, request, "BUYER", `/products/${productId}`);
    await expect(buyerPage.getByTestId("product-stock")).toHaveText("In stock · 10 available");
    await buyerPage.getByRole("button", { name: /Add to cart/i }).click();
    await expect.poll(async () => (await evidence(request)).requests.some((row: { method: string; path: string }) => row.method === "POST" && row.path === "/api/v1/carts/me/items")).toBe(true);
    await buyerPage.goto("/checkout");
    await buyerPage.getByLabel("Province / City", { exact: true }).selectOption("202");
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
    const output = path.resolve("test-results/backoffice/evidence"); await mkdir(output, { recursive: true });
    await writeFile(path.join(output, "mock-demo-evidence.json"), JSON.stringify({ environment: "synthetic Postman HTTP simulation; real frontend; payment callback models missing #156", checkedAt: new Date().toISOString(), operations: state.requests, product: state.products[0], order: state.orders[0] }, null, 2));
    for (const [name, screen] of [["seller-paid-sales", seller], ["admin-stock", adminPage]] as const) {
      await screen.screenshot({ path: path.join(output, `mock-${name}-1440.png`), fullPage: true, caret: "initial", style: "nextjs-portal { visibility: hidden !important; }" });
      await screen.setViewportSize({ width: 375, height: 812 });
      expect(await screen.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await screen.screenshot({ path: path.join(output, `mock-${name}-375.png`), fullPage: true, caret: "initial", style: "nextjs-portal { visibility: hidden !important; }" });
    }
  } finally { await adminContext.close(); await buyerContext.close(); }
});

test("Seller completes a legacy SKU parcel with browser bounds before publishing", async ({ page, request }) => {
  const seeded = await request.post(`${api}/test/legacy-product`);
  expect(seeded.status()).toBe(201);
  const { data: product } = await seeded.json();
  const sku = product.skus[0];
  await signIn(page, request, "SELLER", `/backoffice/products/${product.id}`);
  await expect(page.getByRole("heading", { name: "Edit Product", exact: true })).toBeVisible();
  const publish = page.getByRole("button", { name: "Publish", exact: true });
  await expect(page.getByRole("button", { name: "Remove", exact: true })).toBeVisible();
  await expect(publish).toBeDisabled();
  await page.getByRole("button", { name: `Edit SKU ${sku.skuCode}`, exact: true }).click();
  const weight = page.getByLabel(`Weight (g) ${sku.skuCode}`, { exact: true });
  const length = page.getByLabel(`Length (cm) ${sku.skuCode}`, { exact: true });
  const width = page.getByLabel(`Width (cm) ${sku.skuCode}`, { exact: true });
  const height = page.getByLabel(`Height (cm) ${sku.skuCode}`, { exact: true });
  const save = page.getByRole("button", { name: "Save SKU", exact: true });
  const putRequests = async () => (await evidence(request)).requests.filter((row: { method: string; path: string }) => row.method === "PUT" && row.path === `/api/v1/skus/${sku.id}`);
  await expect(weight).toBeEmpty();
  await expect(page.getByRole("textbox", { name: `cost price ${sku.skuCode}`, exact: true })).toBeEmpty();
  await page.getByRole("textbox", { name: `cost price ${sku.skuCode}`, exact: true }).fill("90000");
  await save.click();
  await expect.poll(async () => (await putRequests()).length).toBe(1);
  expect((await putRequests())[0].body).toEqual({ color: "Black", size: "Standard", price: 150000, costPrice: 90000 });
  expect((await evidence(request)).products[0].skus[0].shippingParcel).toBeNull();
  await expect(publish).toBeDisabled();
  await page.getByRole("button", { name: `Edit SKU ${sku.skuCode}`, exact: true }).click();
  // Once one measurement is entered, the remaining values must form one complete parcel.
  await weight.fill("1");
  await save.click();
  expect((await putRequests()).length).toBe(1);
  for (const field of [weight, length, width, height]) await field.fill("1");
  for (const [field, upper] of [[weight, 50000], [length, 200], [width, 200], [height, 200]] as const) {
    await expect(field).toHaveAttribute("min", "1");
    await expect(field).toHaveAttribute("max", String(upper));
    await field.fill("0");
    await save.click();
    expect(await field.evaluate((input: HTMLInputElement) => input.validity.rangeUnderflow)).toBe(true);
    expect(await putRequests()).toHaveLength(1);
    await field.fill(String(upper + 1));
    await save.click();
    expect(await field.evaluate((input: HTMLInputElement) => input.validity.rangeOverflow)).toBe(true);
    expect(await putRequests()).toHaveLength(1);
    await field.fill("1.5");
    await save.click();
    expect(await field.evaluate((input: HTMLInputElement) => input.validity.stepMismatch)).toBe(true);
    expect(await putRequests()).toHaveLength(1);
    await field.fill("1");
  }
  // Both inclusive lower and upper bounds are exercised on the persisted update.
  await weight.fill("50000");
  await length.fill("200");
  await save.click();
  await expect.poll(async () => (await putRequests()).length).toBe(2);
  expect((await putRequests())[1].body).toEqual({
    color: "Black", size: "Standard", price: 150000, costPrice: 90000,
    shippingParcel: { weightGrams: 50000, lengthCm: 200, widthCm: 1, heightCm: 1 },
  });
  await expect(publish).toBeEnabled();
  await page.reload();
  await expect(publish).toBeEnabled();
  expect((await evidence(request)).products[0].skus[0].shippingParcel).toEqual({ weightGrams: 50000, lengthCm: 200, widthCm: 1, heightCm: 1 });
  await page.getByRole("button", { name: `Edit SKU ${sku.skuCode}`, exact: true }).click();
  await expect(weight).toHaveValue("50000");
  await expect(length).toHaveValue("200");
  await expect(width).toHaveValue("1");
  await expect(height).toHaveValue("1");
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const output = path.resolve("test-results/backoffice/evidence");
  await mkdir(output, { recursive: true });
  await page.screenshot({ path: path.join(output, "mock-sku-parcel-375.png"), fullPage: true, caret: "initial", style: "nextjs-portal { visibility: hidden !important; }" });
  await page.getByRole("button", { name: "Cancel SKU", exact: true }).click();
  await publish.click();
  await expect.poll(async () => (await evidence(request)).products[0].status).toBe("ACTIVE");
});
