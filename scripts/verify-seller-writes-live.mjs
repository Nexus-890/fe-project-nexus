// Explicit local write smoke: real FE controls, Keycloak and backend only.
// Creates unique review products; soft-deletes the disposable one via FE.
// --auction also leaves a clearly named future scheduled auction/product for review.
import { chromium, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = process.env.NEXUS_LIVE_APP_ORIGIN || "http://localhost:3000";
const envFile = process.env.NEXUS_LIVE_ENV_FILE || path.resolve(root, "../be-project-nexus/infra/local-dev/.env");
const local = parseEnv(readFileSync(envFile, "utf8"));
const stamp = `${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}-${randomUUID().slice(0, 6)}`;
const resumeAuctionId = process.argv.includes("--resume-auction-product") ? process.argv[process.argv.indexOf("--resume-auction-product") + 1] : null;
if (resumeAuctionId && !process.argv.includes("--auction")) throw new Error("--resume-auction-product requires --auction.");
const output = path.resolve(root, "../docs/account-seller-evidence");
mkdirSync(output, { recursive: true });
const report = { checkedAt: new Date().toISOString(), sourceBase: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(), environment: "real browser FE controls → local Keycloak/gateway/BE/PostgreSQL; no mocks", stage: "configuration", passed: false, operations: [], products: [], screenshots: [], limits: ["No order cancellation, notification mutation, credentials, stock intake, bids or payments are performed.", "Auction create/schedule does not establish backend stock reservation, seller eligibility or product/SKU cross-service validation."] };
const uuid = (value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const db = (database, sql) => JSON.parse(execFileSync("docker", ["exec", "nexus-postgres", "psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", local.DB_USERNAME, "-d", database, "-c", sql], { encoding: "utf8" }).trim());
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: "Asia/Ho_Chi_Minh" });
const page = await context.newPage();
page.setDefaultTimeout(30_000);
page.on("response", async (response) => {
  if (new URL(response.url()).pathname !== "/api/v1/categories/tree") return;
  const operation = { method: "GET", path: "/api/v1/categories/tree", status: response.status() };
  try { const body = await response.json(); operation.applicationCode = body.code; operation.records = body.data?.length; } catch { operation.jsonReadable = false; }
  report.operations.push(operation);
});
const screenshot = async (name, target = page) => {
  await target.screenshot({ path: path.join(output, name), fullPage: true, style: "nextjs-portal { visibility: hidden !important; }" });
  report.screenshots.push(name);
};
async function login(target, role, destination) {
  const password = local[`DEMO_${role.toUpperCase()}_PASSWORD`];
  if (!password) throw new Error("Missing demo credential in ignored local env");
  await target.goto(`${app}/sign-in?returnTo=${encodeURIComponent(destination)}`);
  await target.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await target.waitForURL((url) => url.pathname.includes("/realms/nexus/protocol/openid-connect/auth"));
  await target.locator("#username").fill(`${role}@nexus.local`);
  await target.locator("#password").fill(password);
  await target.locator("#kc-login").click();
  await target.waitForURL(`${app}${destination}`, { timeout: 60_000 });
}
async function writeThroughUi(method, endpoint, action, expectedStatus) {
  const pending = page.waitForResponse((response) => new URL(response.url()).pathname === endpoint && response.request().method() === method, { timeout: 45_000 });
  await action();
  const response = await pending;
  const request = response.request();
  const operation = { method, path: endpoint, status: response.status() };
  if (request.headers()["content-type"]?.includes("application/json")) {
    try { operation.bodyFieldNames = Object.keys(JSON.parse(request.postData() || "{}")); } catch { operation.bodyFieldNames = []; }
    if (/\/skus(?:\/[^/]+)?$/.test(endpoint) && operation.bodyFieldNames.includes("skuCode")) throw new Error("SKU writes must omit the server-generated code");
  }
  let body;
  if (response.status() !== 204) {
    body = await response.json();
    operation.applicationCode = body.code;
    if (typeof body.code === "string") operation.errorCode = body.code;
  }
  report.operations.push(operation);
  if (response.status() !== expectedStatus || expectedStatus !== 204 && body?.code !== 0) throw new Error("Unexpected live write response");
  return body?.data;
}
async function createProduct(purpose, auctionEnable = false) {
  report.stage = `create ${purpose} product`;
  await page.goto(`${app}/seller/products/new`);
  await expect(page.getByRole("heading", { name: "New Product", exact: true })).toBeVisible();
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  const name = `LOCAL REVIEW ${purpose.toUpperCase()} ${stamp}`;
  await page.getByLabel("Product Name", { exact: true }).fill(name);
  const categorySelect = page.getByLabel("Category", { exact: true });
  await expect.poll(async () => categorySelect.locator("option").count(), { timeout: 30_000 }).toBeGreaterThan(1);
  await categorySelect.selectOption({ index: 1 });
  await page.getByLabel("Description", { exact: true }).fill("Local FE write verification only. No stock, order, bidder, shipment or payment activity.");
  if (auctionEnable) await page.getByLabel("Allow auction listings", { exact: true }).check();
  const product = await writeThroughUi("POST", "/api/v1/products", () => page.getByRole("button", { name: "Save Changes", exact: true }).click(), 201);
  if (!uuid(product?.id) || product.name !== name || product.status !== "DRAFT") throw new Error("Created product mismatch");
  const item = { purpose, productId: product.id, name, states: ["DRAFT"], auctionEnable, cleanup: "pending" };
  report.products.push(item);
  await expect(page).toHaveURL(`${app}/seller/products/${product.id}`);
  await expect(page.getByRole("heading", { name: "Edit Product", exact: true })).toBeVisible();
  return item;
}
async function addSku(item, editAgain = false) {
  report.stage = `create ${item.purpose} SKU`;
  await page.getByRole("button", { name: "Add SKU", exact: true }).click();
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Save SKU", exact: true }) }).last();
  await expect(form.getByLabel("SKU code new SKU", { exact: true })).toHaveValue("Generated when saved");
  await expect(form.getByLabel("SKU code new SKU", { exact: true })).not.toBeEditable();
  await form.getByLabel("color new SKU", { exact: true }).fill("Black");
  await form.getByLabel("size new SKU", { exact: true }).fill("Standard");
  await form.getByLabel("price new SKU", { exact: true }).fill("123456.78");
  const sku = await writeThroughUi("POST", `/api/v1/products/${item.productId}/skus`, () => form.getByRole("button", { name: "Save SKU", exact: true }).click(), 201);
  if (!uuid(sku?.id) || sku.productId !== item.productId || typeof sku.skuCode !== "string" || !new RegExp(`^SKU-${item.productId.replaceAll("-", "")}-\\d{2,}$`).test(sku.skuCode)) throw new Error("Created SKU or generated code mismatch");
  const skuCode = sku.skuCode;
  item.skuId = sku.id;
  item.skuCode = skuCode;
  await expect(page.getByLabel(`SKU code ${skuCode}`, { exact: true })).toHaveValue(skuCode);
  await expect(page.getByLabel(`SKU code ${skuCode}`, { exact: true })).not.toBeEditable();
  await expect(page.getByLabel(`price ${skuCode}`, { exact: true })).toBeVisible();
  if (editAgain) {
    report.stage = "edit same persisted SKU again";
    const persistedForm = page.locator("form").filter({ has: page.getByLabel(`price ${skuCode}`, { exact: true }) });
    await persistedForm.getByLabel(`price ${skuCode}`, { exact: true }).fill("134567.89");
    const updated = await writeThroughUi("PUT", `/api/v1/skus/${item.skuId}`, () => persistedForm.getByRole("button", { name: "Save SKU", exact: true }).click(), 200);
    if (updated.id !== item.skuId || updated.skuCode !== skuCode || Number(updated.price) !== 134567.89) throw new Error("SKU update did not retain its persisted ID and server-generated code");
    const persisted = db("catalog_db", `SELECT row_to_json(x) FROM (SELECT id,product_id,sku_code,price FROM skus WHERE id='${item.skuId}' AND product_id='${item.productId}') x;`);
    if (!persisted || Number(persisted.price) !== 134567.89 || persisted.sku_code !== skuCode) throw new Error("SKU update missing from PostgreSQL");
    item.sameSkuUpdatedThroughPut = true;
    item.persistedSku = persisted;
  }
}
async function addOwnImage(item) {
  report.stage = `upload ${item.purpose} publication image`;
  const image = await writeThroughUi("POST", `/api/v1/products/${item.productId}/images`,
    () => page.getByLabel("Product image file", { exact: true }).setInputFiles(path.resolve(root, "../be-project-nexus/infra/local-dev/seed-images/shirt.jpg")), 201);
  if (!uuid(image?.id) || typeof image.imageUrl !== "string") throw new Error("Publication image response mismatch");
  item.imageId = image.id;
  item.publicImageUrl = image.imageUrl;
}
async function status(item, next) {
  report.stage = `${item.purpose} status ${next}`;
  await page.getByRole("radio", { name: next === "ACTIVE" ? "Active" : "Inactive", exact: true }).check();
  const changed = await writeThroughUi("PATCH", `/api/v1/products/${item.productId}/status`, () => page.getByRole("button", { name: "Apply status", exact: true }).click(), 200);
  if (changed.status !== next) throw new Error("Status response mismatch");
  await expect(page.getByRole("button", { name: "Apply status", exact: true })).toBeDisabled();
  item.states.push(next);
}
try {
  report.stage = "seller Keycloak sign-in";
  await login(page, "seller", "/seller/products");
  if (!resumeAuctionId) {
  const disposable = await createProduct("disposable");
  await addSku(disposable, true);
  await addOwnImage(disposable);
  await status(disposable, "ACTIVE");
  await status(disposable, "INACTIVE");
  await status(disposable, "ACTIVE");
  report.stage = "save existing product changes";
  const updatedName = `${disposable.name} UPDATED`;
  await page.getByLabel("Product Name", { exact: true }).fill(updatedName);
  const updatedProduct = await writeThroughUi("PUT", `/api/v1/products/${disposable.productId}`, () => page.getByRole("button", { name: "Save Changes", exact: true }).click(), 200);
  if (updatedProduct.name !== updatedName) throw new Error("Product update mismatch");
  disposable.name = updatedName;
  const persistedProduct = db("catalog_db", `SELECT row_to_json(x) FROM (SELECT id,name,status,auction_enable FROM products WHERE id='${disposable.productId}' AND seller_id='68000000-0000-4000-8000-000000000002' AND deleted_at IS NULL) x;`);
  if (persistedProduct.name !== updatedName || persistedProduct.status !== "ACTIVE") throw new Error("Product update missing from PostgreSQL");
  disposable.persistedProduct = persistedProduct;
  await screenshot("live-seller-new-product-updated-1440.png");
  report.stage = "delete only disposable product through FE";
  const orderReferences = db("commerce_db", `SELECT json_build_object('count',count(*)) FROM order_items WHERE product_id='${disposable.productId}';`).count;
  const auctionReferences = db("auction_db", `SELECT json_build_object('count',count(*)) FROM auctions WHERE product_id='${disposable.productId}';`).count;
  if (orderReferences !== 0 || auctionReferences !== 0) throw new Error("Disposable product unexpectedly has references; retained");
  const ownImageIds = db("catalog_db", `SELECT json_build_object('ids',json_agg(id)) FROM product_images WHERE product_id='${disposable.productId}';`).ids;
  if (ownImageIds?.length !== 1 || ownImageIds[0] !== disposable.imageId) throw new Error("Disposable product media changed; retain the product for inspection");
  await writeThroughUi("DELETE", `/api/v1/products/${disposable.productId}/images/${disposable.imageId}`,
    () => page.getByRole("button", { name: "Remove", exact: true }).click(), 204);
  disposable.imageRemovedThroughFe = true;
  await page.getByRole("button", { name: "Delete Product", exact: true }).click();
  await writeThroughUi("DELETE", `/api/v1/products/${disposable.productId}`, () => page.getByRole("button", { name: "Confirm delete", exact: true }).click(), 204);
  await expect(page.getByText("Product deleted. Return to Products.", { exact: true })).toBeVisible();
  disposable.cleanup = db("catalog_db", `SELECT json_build_object('deleted',deleted_at IS NOT NULL) FROM products WHERE id='${disposable.productId}';`).deleted ? "soft-deleted through FE; SKU retained by backend history" : "not deleted";
  if (!disposable.cleanup.startsWith("soft-deleted")) throw new Error("Disposable product deletion missing from PostgreSQL");
  await screenshot("live-seller-disposable-product-deleted-1440.png");
  }
  if (process.argv.includes("--auction")) {
    let auctionProduct;
    if (resumeAuctionId) {
      if (!uuid(resumeAuctionId)) throw new Error("Resume product ID must be a UUID");
      const ownProduct = db("catalog_db", `SELECT row_to_json(x) FROM (SELECT p.id,p.name,(SELECT s.id FROM skus s WHERE s.product_id=p.id ORDER BY s.id LIMIT 1) sku_id FROM products p WHERE p.id='${resumeAuctionId}' AND p.seller_id='68000000-0000-4000-8000-000000000002' AND p.name LIKE 'LOCAL REVIEW AUCTION %' AND p.status='ACTIVE' AND p.auction_enable AND p.deleted_at IS NULL) x;`);
      if (!ownProduct || !uuid(ownProduct.sku_id)) throw new Error("Resume product must be own active auction-enabled local review product");
      auctionProduct = { purpose: "auction", productId: ownProduct.id, name: ownProduct.name, skuId: ownProduct.sku_id, cleanup: "pending", resumed: true };
      report.products.push(auctionProduct);
    } else {
      auctionProduct = await createProduct("auction", true);
      await addSku(auctionProduct);
      await addOwnImage(auctionProduct);
      await status(auctionProduct, "ACTIVE");
    }
    const existingAuctions = db("auction_db", `SELECT json_build_object('count',count(*)) FROM auctions WHERE product_id='${auctionProduct.productId}' AND deleted_at IS NULL;`).count;
    if (existingAuctions !== 0) throw new Error("Review auction product already has an auction; retained without creating another");
    report.stage = "auction product choice";
    const firstProducts = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/v1/products/mine" && response.request().method() === "GET");
    await page.goto(`${app}/seller/auctions/new`);
    await firstProducts;
    await expect(page.getByRole("heading", { name: "Create Auction", exact: true })).toBeVisible();
    for (let index = 0; index < 30; index++) {
      await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
      if (await page.getByLabel("Product", { exact: true }).locator(`option[value="${auctionProduct.productId}"]`).count()) break;
      const next = page.getByRole("button", { name: "Next products", exact: true });
      if (await next.isDisabled()) throw new Error("New active auction product not found in FE product pages");
      const nextProducts = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/v1/products/mine" && response.request().method() === "GET");
      await next.click();
      await nextProducts;
    }
    await page.getByLabel("Product", { exact: true }).selectOption(auctionProduct.productId);
    await page.getByLabel("SKU", { exact: true }).selectOption(auctionProduct.skuId);
    report.stage = "auction timing inputs";
    const future = new Date(Date.now() + 30 * 86400000);
    const localStart = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(future).replace(" ", "T");
    await page.getByLabel("Start (device local time)", { exact: true }).fill(localStart);
    await page.getByRole("combobox", { name: /^Duration/ }).selectOption("24");
    await page.getByLabel("Starting Price (VND)", { exact: true }).fill("123456");
    await page.getByLabel("Bid Increment (VND)", { exact: true }).fill("10000");
    report.stage = "create future auction draft";
    const draft = await writeThroughUi("POST", "/api/v1/auctions", () => page.getByRole("button", { name: "Save Draft", exact: true }).click(), 201);
    if (!uuid(draft?.id) || draft.productId !== auctionProduct.productId || draft.skuId !== auctionProduct.skuId || draft.status !== "CREATED") throw new Error("Auction draft mismatch");
    report.auction = { id: draft.id, productId: draft.productId, skuId: draft.skuId, title: draft.title, startAt: draft.startAt, endAt: draft.endAt, states: [draft.status] };
    await expect(page.getByRole("button", { name: "Save Draft", exact: true })).toBeDisabled();
    report.stage = "schedule saved future auction";
    const scheduled = await writeThroughUi("POST", `/api/v1/auctions/${draft.id}/schedule`, () => page.getByRole("button", { name: "Schedule Saved Auction", exact: true }).click(), 200);
    if (scheduled.id !== draft.id || scheduled.status !== "SCHEDULED") throw new Error("Auction schedule mismatch");
    report.auction.states.push(scheduled.status);
    report.auction.persisted = db("auction_db", `SELECT row_to_json(x) FROM (SELECT id,product_id,sku_id,title,status,start_at,end_at,bid_count FROM auctions WHERE id='${draft.id}') x;`);
    if (report.auction.persisted.status !== "SCHEDULED" || report.auction.persisted.bid_count !== 0) throw new Error("Scheduled auction persistence mismatch");
    auctionProduct.cleanup = "retained with own future scheduled review auction; no cancel API delivered";
    await expect(page.getByText("Auction scheduled by the backend. Stock reservation and eligibility integrations remain backend dependencies.", { exact: true })).toBeVisible();
    await screenshot("live-seller-future-auction-scheduled-1440.png");
  }
  if (process.argv.includes("--buyer-denial")) {
    report.stage = "buyer seller-portal denial";
    const buyer = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const buyerPage = await buyer.newPage();
    const sellerRequests = [];
    buyerPage.on("request", (request) => { if (["/api/v1/products/mine", "/api/v1/orders/sales"].includes(new URL(request.url()).pathname)) sellerRequests.push(new URL(request.url()).pathname); });
    await login(buyerPage, "buyer", "/seller/products");
    await expect(buyerPage.getByRole("heading", { name: "A seller account is required", exact: true })).toBeVisible();
    report.buyerDenial = { frontendGateVisible: true, protectedSellerRequests: sellerRequests.length };
    if (sellerRequests.length) throw new Error("Buyer seller portal unexpectedly loaded seller requests");
    await screenshot("live-buyer-seller-portal-denied-375.png", buyerPage);
    await buyer.close();
  }
  report.stage = "complete";
  report.passed = true;
} catch (error) {
  // Never log Playwright error messages: fill-call logs could contain credentials.
  report.error = `Live write smoke stopped at ${report.stage}; inspect sanitized operation statuses and recorded own IDs. No existing task product, account or credential was changed.`;
  if (new URL(page.url()).origin === app && !await page.locator('input[type="password"]').count()) {
    report.failurePage = new URL(page.url()).pathname;
    report.failureHeadings = await page.getByRole("heading").allTextContents();
    report.failureCategoryOptions = await page.locator("#seller-product-form select option").allTextContents().catch(() => []);
    report.failureAlerts = await page.getByRole("alert").allTextContents();
    let summary = String(error?.message || error?.name).split("\n")[0];
    for (const key of ["DEMO_BUYER_PASSWORD", "DEMO_SELLER_PASSWORD", "SUPABASE_SERVICE_KEY"]) if (local[key]) summary = summary.replaceAll(local[key], "[redacted]");
    report.failureSummary = summary.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted]");
    await screenshot("live-seller-write-failure-1440.png");
  }
} finally {
  await context.close();
  await browser.close();
}
const filename = path.join(output, process.argv.includes("--auction") ? "live-seller-auction-write-results.json" : "live-seller-product-write-results.json");
writeFileSync(filename, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ filename, passed: report.passed, stage: report.stage, products: report.products.map(({ purpose, productId, cleanup }) => ({ purpose, productId, cleanup })), auctionId: report.auction?.id }, null, 2));
if (!report.passed) process.exitCode = 1;
