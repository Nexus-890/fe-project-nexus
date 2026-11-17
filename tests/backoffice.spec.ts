import { expect, test, type Page, type APIRequestContext } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

test.skip(!process.env.NEXUS_BACKOFFICE_TEST, "Run with playwright.backoffice.config.ts for the explicit back-office HTTP simulation.");
const apiOrigin = `http://127.0.0.1:${process.env.NEXUS_BACKOFFICE_API_PORT || "3920"}`;
const api = `${apiOrigin}/api`;
const provider = `${apiOrigin}/keycloak`;
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
const category = "69000000-0000-4000-8000-000000000103";
const png = { name: "sample.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") };
const evidenceDir = path.resolve("test-results/backoffice/evidence");
async function checkLayouts(page: Page, name: string) {
  await mkdir(evidenceDir, { recursive: true });
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: path.join(evidenceDir, `mock-${name}-${width}.png`), fullPage: true, caret: "initial", style: "nextjs-portal { visibility: hidden !important; }" });
  }
}

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
  await seller.getByLabel("Category", { exact: true }).selectOption(category);
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
  await seller.getByLabel("Product image file", { exact: true }).setInputFiles(png);
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

const auctionPath = (n: number) => `/backoffice/auctions/92000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
type AuctionOperation = { method: string; path: string; role: string; query: Record<string, string>; body?: unknown };
const auctionRequests = async (request: APIRequestContext) => ((await evidence(request)).requests as AuctionOperation[]).filter((row) => row.path.startsWith("/api/v1/auctions"));
const auctionWrites = async (request: APIRequestContext) => (await auctionRequests(request)).filter((row) => row.method !== "GET");
async function auctionScreens(page: Page, name: string) {
  const output = path.resolve("test-results/backoffice/evidence");
  await mkdir(output, { recursive: true });
  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: path.join(output, `mock-${name}-${width}.png`), fullPage: true, caret: "initial", style: "nextjs-portal { visibility: hidden !important; }" });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}

test("Admin filters auctions by status tab and pages them with matching query params", async ({ page, request }) => {
  await signIn(page, request, "ADMIN", "/backoffice/auctions");
  await expect(page).toHaveURL("/backoffice/auctions");
  await expect(backofficeNav(page).getByRole("link", { name: "Auctions", exact: true })).toBeVisible();
  const table = page.getByRole("table", { name: "Auctions", exact: true });
  const rolex = table.getByRole("row").filter({ hasText: "Rolex Submariner Watch" });
  await expect(rolex).toContainText("6.300.000 ₫");
  await expect(rolex).toContainText("68000000");
  await expect(page.getByText("Page 1 · 12 auctions", { exact: true })).toBeVisible();
  const queries = async () => (await auctionRequests(request)).filter((row) => row.method === "GET" && row.path === "/api/v1/auctions/manage").map((row) => row.query);
  await page.getByRole("navigation", { name: "Auction pagination", exact: true }).getByRole("button", { name: "Next", exact: true }).click();
  await expect(table.getByRole("link", { name: "Demo auction 12", exact: true })).toBeVisible();
  await expect(table.getByRole("link", { name: "Rolex Submariner Watch", exact: true })).toHaveCount(0);
  await expect.poll(queries).toContainEqual({ status: "ACTIVE", page: "1", size: "10" });
  for (const [label, status, title] of [["Draft", "CREATED", "Demo auction 14"], ["Scheduled", "SCHEDULED", "Leica M6 film camera"], ["Ended", "ENDED", "Demo auction 15"], ["Settled", "SETTLED", "Demo auction 16"], ["Payment timeout", "PAYMENT_TIMEOUT", "Demo auction 17"], ["Cancelled", "CANCELLED", "Demo auction 18"]] as const) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(queries).toContainEqual({ status, page: "0", size: "10" });
    await expect(table.getByRole("row")).toHaveCount(2);
    await expect(table.getByRole("link", { name: title, exact: true })).toBeVisible();
    await expect(page.getByText("Page 1 · 1 auction", { exact: true })).toBeVisible();
    if (status === "CREATED" || status === "CANCELLED") await auctionScreens(page, `admin-auctions-${status.toLowerCase()}`);
  }
  expect((await auctionRequests(request)).filter((row) => row.path === "/api/v1/auctions")).toEqual([]);
  await page.getByRole("button", { name: "Active", exact: true }).click();
  await expect(table.getByRole("link", { name: "Rolex Submariner Watch", exact: true })).toBeVisible();
  await auctionScreens(page, "admin-auctions");
  expect(await auctionWrites(request)).toEqual([]);
});

test("Admin opens an active auction, reads masked bids newest first and force cancels it after confirming", async ({ page, request }) => {
  await signIn(page, request, "ADMIN", "/backoffice/auctions");
  await page.getByRole("link", { name: "Rolex Submariner Watch", exact: true }).click();
  await expect(page).toHaveURL(auctionPath(1));
  await expect(page.getByRole("heading", { name: "Rolex Submariner Watch", exact: true })).toBeVisible();
  const bids = page.getByRole("list", { name: "Bids, newest first", exact: true }).getByRole("listitem");
  await expect(bids).toHaveCount(3);
  for (const [index, name, amount] of [[0, "m***h", "6.300.000 ₫"], [1, "h***g", "6.200.000 ₫"], [2, "a***n", "6.100.000 ₫"]] as const) {
    await expect(bids.nth(index)).toContainText(name);
    await expect(bids.nth(index)).toContainText(amount);
  }
  await expect(page.getByRole("main").getByRole("link", { name: /event log/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save changes", exact: true })).toHaveCount(0);
  const reason = page.getByLabel("Cancellation reason", { exact: true });
  const cancel = page.getByRole("button", { name: "Cancel auction", exact: true });
  const dialog = page.getByRole("dialog", { name: "Cancel this auction?", exact: true });
  await cancel.click();
  await expect(dialog).toBeHidden();
  await reason.fill("   ");
  await cancel.click();
  await expect(page.getByRole("alert").filter({ hasText: "Enter a cancellation reason." })).toBeVisible();
  await expect(dialog).toBeHidden();
  expect(await auctionWrites(request)).toEqual([]);
  await reason.fill("  Counterfeit listing reported by support  ");
  await cancel.click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Every bidder will be told that it was cancelled (3 bids so far).");
  await expect(dialog).toContainText("Counterfeit listing reported by support");
  await auctionScreens(page, "admin-auction-cancel-dialog");
  await dialog.getByRole("button", { name: "Keep auction", exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(await auctionWrites(request)).toEqual([]);
  await cancel.click();
  await dialog.getByRole("button", { name: "Confirm cancellation", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: "Auction cancelled. Bidders will be told it was cancelled." })).toBeVisible();
  const details = page.locator("section", { has: page.getByRole("heading", { name: "Auction details", exact: true }) });
  await expect(details).toContainText("Cancelled");
  await expect(details).toContainText("Administrator");
  await expect(details).toContainText("Counterfeit listing reported by support");
  await expect(cancel).toHaveCount(0);
  expect(await auctionWrites(request)).toEqual([expect.objectContaining({ method: "POST", path: "/api/v1/auctions/92000000-0000-4000-8000-000000000001/admin-cancel", role: "ADMIN", body: { reason: "Counterfeit listing reported by support" } })]);
  expect((await evidence(request)).auctions[0]).toMatchObject({ status: "CANCELLED", cancelledBy: "ADMIN", cancelledReason: "Counterfeit listing reported by support" });
  const reads = (await auctionRequests(request)).filter((row) => row.method === "GET").map((row) => row.path);
  for (const suffix of ["", "/state", "/bids"]) expect(reads).toContain(`/api/v1/auctions/manage/92000000-0000-4000-8000-000000000001${suffix}`);
  expect(reads.filter((path) => path.startsWith("/api/v1/auctions/92000000"))).toEqual([]);
});

test("Admin edits a scheduled auction, then a 409 after it starts shows the backend detail and reloads it", async ({ page, request }) => {
  await signIn(page, request, "ADMIN", auctionPath(13));
  await expect(page.getByRole("heading", { name: "Leica M6 film camera", exact: true })).toBeVisible();
  await expect(page.getByText("No bids yet.", { exact: true })).toBeVisible();
  const startingPrice = page.getByLabel("Starting price", { exact: true });
  const save = page.getByRole("button", { name: "Save changes", exact: true });
  await startingPrice.fill("0");
  await save.click();
  await expect(page.getByText("The starting price must be greater than zero.", { exact: true })).toBeVisible();
  expect(await auctionWrites(request)).toEqual([]);
  await startingPrice.fill("7500000");
  await page.getByLabel("Bid increment", { exact: true }).fill("100000");
  const start = await page.getByLabel("Start (Vietnam time)", { exact: true }).inputValue();
  const end = await page.getByLabel("End (Vietnam time)", { exact: true }).inputValue();
  await save.click();
  await expect(page.getByRole("status").filter({ hasText: "Auction updated." })).toBeVisible();
  const details = page.locator("section", { has: page.getByRole("heading", { name: "Auction details", exact: true }) });
  await expect(details).toContainText("7.500.000 ₫");
  await expect(details).toContainText("100.000 ₫");
  await expect(page.locator("section", { has: page.getByRole("heading", { name: "Live state", exact: true }) })).toContainText("7.500.000 ₫");
  expect(await auctionWrites(request)).toEqual([expect.objectContaining({ method: "PUT", path: "/api/v1/auctions/92000000-0000-4000-8000-000000000013", role: "ADMIN",
    body: { startingPrice: 7500000, bidIncrement: 100000, startAt: new Date(`${start}:00+07:00`).toISOString(), endAt: new Date(`${end}:00+07:00`).toISOString() } })]);
  await auctionScreens(page, "admin-auction-edit");
  expect((await request.post(`${api}/test/auction`, { data: { id: "92000000-0000-4000-8000-000000000013", status: "ACTIVE", startAt: new Date(Date.now() - 60_000).toISOString() } })).ok()).toBe(true);
  await save.click();
  await expect(page.getByRole("alert").filter({ hasText: "Only an auction that has not started can be configured" })).toBeVisible();
  await expect(save).toHaveCount(0);
  await expect(details).toContainText("Active");
  await expect(page.getByRole("button", { name: "Cancel auction", exact: true })).toBeVisible();
  expect((await auctionWrites(request)).map((row) => row.method)).toEqual(["PUT", "PUT"]);
  expect((await evidence(request)).auctions[12]).toMatchObject({ sellerId: "68000000-0000-4000-8000-000000000002", startingPrice: 7500000 });
});

test("Support Staff reads auctions without edit or cancel controls and sends no auction writes", async ({ page, request }) => {
  await signIn(page, request, "SUPPORT_STAFF", "/backoffice/auctions");
  await expect(backofficeNav(page).getByRole("link", { name: "Auctions", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Draft", exact: true }).click();
  await page.getByRole("link", { name: "Demo auction 14", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Demo auction 14", exact: true })).toBeVisible();
  await expect(page.getByText("Read-only view. Only administrators can edit or cancel auctions.", { exact: true })).toBeVisible();
  for (const name of ["Save changes", "Cancel auction"]) await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
  await page.goto("/backoffice/auctions");
  await page.getByRole("link", { name: "Rolex Submariner Watch", exact: true }).click();
  await expect(page.getByText("Read-only view. Only administrators can edit or cancel auctions.", { exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Bids, newest first", exact: true }).getByRole("listitem")).toHaveCount(3);
  for (const name of ["Save changes", "Cancel auction", "Confirm cancellation"]) await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
  await page.goto(auctionPath(13));
  await expect(page.getByRole("heading", { name: "Leica M6 film camera", exact: true })).toBeVisible();
  for (const name of ["Save changes", "Cancel auction", "Confirm cancellation"]) await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Cancellation reason", { exact: true })).toHaveCount(0);
  await auctionScreens(page, "support-auction-detail");
  const cancelledId = "92000000-0000-4000-8000-000000000018";
  expect((await request.post(`${api}/test/auction`, { data: {
    id: cancelledId, cancelledBy: "SYSTEM", cancelledReason: "STOCK_UNAVAILABLE",
  } })).ok()).toBe(true);
  await page.goto(auctionPath(18));
  const cancellationActor = page.getByText("Cancelled by", { exact: true }).locator("..").locator("dd");
  await expect(cancellationActor).toHaveText("System");
  await expect(page.getByText("STOCK_UNAVAILABLE", { exact: true })).toBeVisible();
  expect((await request.post(`${api}/test/auction`, { data: {
    id: cancelledId, cancelledBy: "SELLER", cancelledReason: "Seller withdrew the listing",
  } })).ok()).toBe(true);
  await page.reload();
  await expect(cancellationActor).toHaveText("Seller");
  await expect(page.getByText("Seller withdrew the listing", { exact: true })).toBeVisible();
  expect(await auctionWrites(request)).toEqual([]);
});

test("Buyer cannot open the shared back-office auction pages or add access with a view parameter", async ({ page, request }) => {
  await signIn(page, request, "BUYER");
  await expect(page).toHaveURL("/");
  for (const destination of ["/backoffice/auctions", auctionPath(1), "/backoffice/auctions?view=seller", "/backoffice/auctions/new"]) {
    await page.goto(destination);
    await expect(page.getByRole("heading", { name: "Access denied", exact: true })).toBeVisible();
  }
  expect((await auctionRequests(request)).filter((row) => row.path !== "/api/v1/auctions" || row.query.size === "10")).toEqual([]);
});

test("Seller opens own auctions and details without mounting management requests", async ({ page, request }) => {
  expect((await request.post(`${api}/test/seller-seed`)).ok()).toBe(true);
  await signIn(page, request, "SELLER", "/backoffice/auctions");
  await expect(page).toHaveURL("/backoffice/auctions");
  await expect(backofficeNav(page).getByRole("link", { name: "Auctions", exact: true })).toHaveCount(1);
  await expect(page.getByRole("table", { name: "Your auctions", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create Auction", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Studio auction — active", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Auction Details", exact: true })).toBeVisible();
  expect((await auctionRequests(request)).some((row) => row.path === "/api/v1/auctions/mine")).toBe(true);
  expect((await auctionRequests(request)).filter((row) => row.path.startsWith("/api/v1/auctions/manage"))).toEqual([]);
  expect(await auctionWrites(request)).toEqual([]);
});

for (const role of ["ADMIN", "SUPPORT_STAFF"]) {
  test(`${role} cannot open seller auction creation through the shared route`, async ({ page, request }) => {
    await signIn(page, request, role, "/backoffice/auctions");
    await expect(page.getByRole("table", { name: "Auctions", exact: true })).toBeVisible();
    for (const destination of ["/backoffice/auctions/new", "/backoffice/auctions/new?view=seller"]) {
      await page.goto(destination);
      await expect(page.getByRole("heading", { name: "Access denied", exact: true })).toBeVisible();
    }
    expect((await auctionRequests(request)).filter((row) => row.path === "/api/v1/auctions/mine")).toEqual([]);
    expect((await evidence(request)).requests.some((row: { path: string }) => row.path === "/api/v1/products/mine")).toBe(false);
    expect(await auctionWrites(request)).toEqual([]);
  });
}

for (const role of ["ADMIN,SELLER", "SELLER,SUPPORT_STAFF"]) {
  test(`${role} defaults to managed auctions and retains its seller create edit schedule workflow`, async ({ page, request }) => {
    expect((await request.post(`${api}/test/seller-seed`)).ok()).toBe(true);
    await signIn(page, request, role, "/backoffice/auctions");
    await expect(page.getByRole("table", { name: "Auctions", exact: true })).toBeVisible();
    await expect(backofficeNav(page).getByRole("link", { name: "Auctions", exact: true })).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Create Auction", exact: true })).toHaveCount(0);
    await page.getByRole("link", { name: "Rolex Submariner Watch", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Rolex Submariner Watch", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel auction", exact: true })).toHaveCount(role.includes("ADMIN") ? 1 : 0);
    expect((await auctionRequests(request)).filter((row) => row.path === "/api/v1/auctions/mine")).toEqual([]);
    await page.getByRole("link", { name: "My auctions", exact: true }).click();
    await expect(page).toHaveURL("/backoffice/auctions?view=seller");
    await expect(page.getByRole("table", { name: "Your auctions", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Create Auction", exact: true }).click();
    await expect(page).toHaveURL("/backoffice/auctions/new?view=seller");
    await page.getByRole("combobox", { name: "Product", exact: true }).selectOption("a2250000-0000-4000-8000-000000000001");
    await page.getByRole("combobox", { name: "SKU", exact: true }).selectOption("a2250000-0000-4000-8000-000000000002");
    await page.getByRole("button", { name: "Use 3-minute demo", exact: true }).click();
    await page.getByRole("button", { name: "Save Draft", exact: true }).click();
    await expect(page).toHaveURL(/\/backoffice\/auctions\/[0-9a-f-]{36}\?view=seller$/);
    await expect(page.getByRole("heading", { name: "Edit Auction", exact: true })).toBeVisible();
    await page.getByLabel("Bid Increment (VND)", { exact: true }).fill("20000");
    const saved = page.waitForResponse((response) => response.request().method() === "PUT" && /\/v1\/auctions\/[0-9a-f-]{36}$/.test(new URL(response.url()).pathname));
    await page.getByRole("button", { name: "Save Changes", exact: true }).click();
    expect((await saved).ok()).toBe(true);
    await page.getByRole("button", { name: "Schedule Auction", exact: true }).click();
    await expect(page.getByText("SCHEDULED", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\?view=seller$/);
    await page.getByRole("link", { name: "Auctions / Auction details", exact: true }).click();
    await expect(page).toHaveURL("/backoffice/auctions?view=seller");
    await page.getByRole("link", { name: "Manage auctions", exact: true }).click();
    await expect(page).toHaveURL("/backoffice/auctions");
    await expect(page.getByRole("table", { name: "Auctions", exact: true })).toBeVisible();
  });
}

test("Seller edits a draft that survives reload and sees the backend's status 400 and delete 409", async ({ page, request }) => {
  await signIn(page, request, "SELLER", "/backoffice/products/new");
  const name = page.getByLabel("Product Name", { exact: true });
  const description = page.getByRole("textbox", { name: /^Description/ });
  const auction = page.getByLabel("Allow auction listings", { exact: true });
  await name.fill("Draft desk lamp");
  await page.getByLabel("Category", { exact: true }).selectOption(category);
  await description.fill("Warm light for a study desk.");
  await auction.check();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page).toHaveURL(/\/backoffice\/products\/[0-9a-f-]{36}$/);
  const productId = (await evidence(request)).products[0].id;
  const expectFields = async (title: string, text: string, auctionEnable: boolean) => {
    await expect(name).toHaveValue(title);
    await expect(page.getByLabel("Category", { exact: true })).toHaveValue(category);
    await expect(description).toHaveValue(text);
    await expect(auction).toBeChecked({ checked: auctionEnable });
    await expect(page.getByText("DRAFT", { exact: true })).toBeVisible();
  };
  await page.reload();
  await expectFields("Draft desk lamp", "Warm light for a study desk.", true);
  await name.fill("Edited desk lamp");
  await description.fill("Dimmable warm light.");
  await auction.uncheck();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Product saved." })).toBeVisible();
  expect((await evidence(request)).requests.filter((row: { method: string; path: string }) => row.method === "PUT" && row.path === `/api/v1/products/${productId}`).map((row: { body: unknown }) => row.body))
    .toEqual([{ name: "Edited desk lamp", description: "Dimmable warm light.", categoryId: category, auctionEnable: false }]);
  await page.reload();
  await expectFields("Edited desk lamp", "Dimmable warm light.", false);
  await checkLayouts(page, "seller-product-editor");

  let release = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route(`**/v1/products/${productId}`, async (route) => { if (route.request().method() === "PUT") await held; await route.continue(); });
  const saved = page.waitForResponse((response) => response.request().method() === "PUT" && response.url().endsWith(`/v1/products/${productId}`));
  await name.fill("Lamp A");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page.getByRole("button", { name: "Saving…", exact: true })).toBeVisible();
  await name.fill("Lamp B");
  release();
  await saved;
  await expect(page.getByRole("button", { name: "Save Changes", exact: true })).toBeEnabled();
  await expect(name).toHaveValue("Lamp B");
  await page.unroute(`**/v1/products/${productId}`);
  await page.reload();
  await expect(name).toHaveValue("Lamp A");

  await request.post(`${api}/test/control`, { data: { orderedProductId: productId } });
  await page.getByRole("button", { name: "Delete product", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Cannot delete a product that has orders");
  await expect(page).toHaveURL(`/backoffice/products/${productId}`);
  expect((await evidence(request)).products.map((product: { id: string }) => product.id)).toContain(productId);

  const { data: legacy } = await (await request.post(`${api}/test/legacy-product`)).json();
  await request.post(`${api}/test/control`, { data: { productStatus: { id: legacy.id, status: "ACTIVE" } } });
  await page.goto(`/backoffice/products/${legacy.id}`);
  await expect(page.getByText("ACTIVE", { exact: true })).toBeVisible();
  await request.post(`${api}/test/control`, { data: { productStatus: { id: legacy.id, status: "INACTIVE" } } });
  await page.getByRole("button", { name: "Unpublish", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Product status transition is not allowed");
  await page.getByRole("button", { name: "Delete product", exact: true }).click();
  await page.getByRole("button", { name: "Keep product", exact: true }).click();
  expect((await evidence(request)).requests.some((row: { method: string; path: string }) => row.method === "DELETE" && row.path === `/api/v1/products/${legacy.id}`)).toBe(false);
  await page.getByRole("button", { name: "Delete product", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete", exact: true }).click();
  await expect(page).toHaveURL("/backoffice/products");
  const table = page.getByRole("table", { name: "Seller products", exact: true });
  await expect(table).toContainText("Lamp A");
  await expect(table).not.toContainText("Legacy parcel product");
  expect((await evidence(request)).products.map((product: { id: string }) => product.id)).toEqual([productId]);

  const seeded: string[] = [];
  for (let index = 0; index < 10; index++) seeded.push((await (await request.post(`${api}/test/legacy-product`)).json()).data.id);
  await request.post(`${api}/test/control`, { data: { productStatus: { id: seeded[0], status: "ACTIVE" } } });
  await page.reload();
  const summary = page.getByText(/^Page \d+ · \d+ products$/);
  await expect(summary).toHaveText("Page 1 · 11 products");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(summary).toHaveText("Page 2 · 11 products");
  const filter = async (label: string, status: string) => {
    const listed = page.waitForRequest((sent) => {
      const url = new URL(sent.url());
      return url.pathname === "/api/v1/products/mine" && url.searchParams.get("status") === status;
    });
    await page.getByRole("button", { name: label, exact: true }).click();
    expect(new URL((await listed).url()).searchParams.get("page")).toBe("0");
    await expect(page.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", "true");
  };
  await filter("Active", "ACTIVE");
  await expect(summary).toHaveText("Page 1 · 1 products");
  await expect(table.getByRole("rowheader")).toHaveText(["Legacy parcel product"]);
  await expect(table).not.toContainText("DRAFT");
  await filter("Draft", "DRAFT");
  await expect(summary).toHaveText("Page 1 · 10 products");
  await expect(table.getByRole("rowheader")).toHaveCount(10);
  await expect(table).toContainText("Lamp A");
  await expect(table).not.toContainText("ACTIVE");
  await filter("Inactive", "INACTIVE");
  await expect(page.getByRole("main").getByRole("status").filter({ hasText: "No products with this status." })).toBeVisible();
  await checkLayouts(page, "seller-products-filtered");
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(summary).toHaveText("Page 1 · 11 products");
  await checkLayouts(page, "seller-products");
});

test("Seller adds and edits SKUs with the backend's duplicate 409 and reorders images that survive reload", async ({ page, request }) => {
  const { data: product } = await (await request.post(`${api}/test/legacy-product`)).json();
  await signIn(page, request, "SELLER", `/backoffice/products/${product.id}`);
  await expect(page.getByRole("heading", { name: "Edit Product", exact: true })).toBeVisible();
  const productState = async () => (await evidence(request)).products.find((row: { id: string }) => row.id === product.id);
  await page.getByRole("button", { name: "Add SKU", exact: true }).click();
  await page.getByRole("textbox", { name: "color new SKU", exact: true }).fill("Black");
  await page.getByRole("textbox", { name: "cost price new SKU", exact: true }).fill("80000");
  await page.getByRole("textbox", { name: "price new SKU", exact: true }).fill("120000");
  for (const [label, value] of [["Weight (g)", "900"], ["Length (cm)", "25"], ["Width (cm)", "15"], ["Height (cm)", "10"]])
    await page.getByLabel(`${label} new SKU`, { exact: true }).fill(value);
  await page.getByRole("button", { name: "Save SKU", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Duplicate SKU code or variant");
  expect((await productState()).skus).toHaveLength(1);
  await page.getByRole("textbox", { name: "size new SKU", exact: true }).fill("Large");
  await page.getByRole("button", { name: "Save SKU", exact: true }).click();
  await expect.poll(async () => (await productState()).skus.length).toBe(2);
  const created = (await productState()).skus[1];
  await expect(page.getByRole("textbox", { name: `SKU code ${created.skuCode}`, exact: true })).toHaveValue(created.skuCode);
  await page.getByRole("button", { name: `Edit SKU ${created.skuCode}`, exact: true }).click();
  const size = page.getByRole("textbox", { name: `size ${created.skuCode}`, exact: true });
  await size.fill("Standard");
  await page.getByRole("button", { name: "Save SKU", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Duplicate SKU code or variant");
  expect((await productState()).skus[1].size).toBe("Large");
  await size.fill("XL");
  await page.getByRole("button", { name: "Save SKU", exact: true }).click();
  await expect.poll(async () => (await productState()).skus[1].size).toBe("XL");
  await expect(page.getByRole("button", { name: "Save SKU", exact: true })).toHaveCount(0);
  await expect(page.getByText("XL", { exact: true })).toBeVisible();

  const first = product.images[0].id;
  await page.getByLabel("Product image file", { exact: true }).setInputFiles(png);
  await expect.poll(async () => (await productState()).images.length).toBe(2);
  const second = (await productState()).images[1].id;
  const media = page.locator("section", { has: page.getByRole("heading", { name: "Media", exact: true }) });
  const sources = () => media.locator("img").evaluateAll((images) => images.map((image) => (image as HTMLImageElement).src));
  await expect.poll(sources).toEqual([expect.not.stringContaining("image="), expect.stringContaining(`image=${second}`)]);
  await expect(page.getByRole("button", { name: "Move image 1 earlier", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Move image 2 later", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Move image 2 earlier", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Image order saved." })).toBeVisible();
  expect((await evidence(request)).requests.filter((row: { method: string; path: string }) => row.method === "PUT" && row.path === `/api/v1/products/${product.id}/images/order`).map((row: { body: unknown }) => row.body))
    .toEqual([{ imageIds: [second, first] }]);
  await expect.poll(sources).toEqual([expect.stringContaining(`image=${second}`), expect.not.stringContaining("image=")]);
  await page.reload();
  await expect.poll(sources).toEqual([expect.stringContaining(`image=${second}`), expect.not.stringContaining("image=")]);
  await checkLayouts(page, "seller-product-skus-images");
  await page.getByRole("button", { name: "Remove", exact: true }).first().click();
  await expect.poll(async () => (await productState()).images.map((image: { id: string }) => image.id)).toEqual([first]);
  await page.reload();
  await expect.poll(sources).toEqual([expect.not.stringContaining("image=")]);
});
