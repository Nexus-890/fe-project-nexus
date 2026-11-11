// Read-only follow-up: real Seller UI and the task-owned PostgreSQL product state.
// Existing PAID seed orders are snapshots, never evidence of payment settlement.
import { chromium, expect } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { execFileSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = process.env.NEXUS_LIVE_APP_ORIGIN || "http://localhost:3000";
const env = parseEnv(readFileSync(process.env.NEXUS_LIVE_ENV_FILE || path.resolve(root, "../be-project-nexus/infra/local-dev/.env"), "utf8"));
const output = path.resolve(root, "../docs/backoffice-evidence"); mkdirSync(output, { recursive: true });
const sourceBase = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const productId = "fc1f91fb-e04a-46c4-af07-54874aecf3ae", skuId = "635eaba6-9833-44da-ac90-fca0dbb7ebb0", imageId = "b23fa843-af78-42f6-a532-a1ed8665c5fb";
const query = `SELECT row_to_json(x) FROM (SELECT p.id,p.seller_id,p.name,p.description,p.status,p.auction_enable,
 (SELECT row_to_json(s) FROM (SELECT id,product_id,sku_code,color,size,price,currency,status FROM skus WHERE id='${skuId}' AND product_id=p.id) s) sku,
 (SELECT row_to_json(i) FROM (SELECT id,product_id,image_url,sort_order FROM product_images WHERE id='${imageId}' AND product_id=p.id) i) image
 FROM products p WHERE p.id='${productId}') x;`;
const state = JSON.parse(execFileSync("docker", ["exec", "nexus-postgres", "psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", env.DB_USERNAME, "-d", "catalog_db", "-c", query], { encoding: "utf8" }).trim());
const ownPath = state.image?.image_url?.includes(`/products/${productId}/`);
const productPassed = state.id === productId && state.status === "ACTIVE" && state.sku?.id === skuId && state.image?.id === imageId && ownPath;
writeFileSync(path.join(output, "live-product-state.json"), `${JSON.stringify({ checkedAt: new Date().toISOString(), sourceBase, environment: "read-only local PostgreSQL catalog_db; exact task-owned product/SKU/image only", passed: productPassed, product: state, imageHasOwnProductPath: ownPath, statement: "SELECT only; no data mutation and no payment status inference" }, null, 2)}\n`);
if (!productPassed) throw Error("Task product-state integrity check failed");

const report = { checkedAt: new Date().toISOString(), sourceBase, environment: "real Chrome Seller UI → local Keycloak/gateway/commerce; existing PAID seed snapshots", passed: false, stage: "sign-in", operations: [], screenshots: [], limitations: ["PAID rows below were seeded previously. This check does not create, pay, settle or update an order.", "No notification, product, stock, order or payment business write was sent."] };
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage(); page.setDefaultTimeout(30_000);
try {
  await page.goto(`${app}/sign-in?returnTo=%2Fbackoffice%2Fsales`);
  await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await page.waitForURL((url) => url.pathname.includes("/realms/nexus/protocol/openid-connect/auth"));
  await page.locator("#username").fill("seller@nexus.local");
  await page.locator("#password").fill(env.DEMO_SELLER_PASSWORD);
  const pending = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/v1/orders/sales" && response.request().method() === "GET");
  await page.locator("#kc-login").click();
  await page.waitForURL(`${app}/backoffice/sales`, { timeout: 60_000 });
  const response = await pending; const body = await response.json();
  report.operations.push({ method: "GET", path: "/api/v1/orders/sales", status: response.status(), applicationCode: body.code, page: body.page });
  if (response.status() !== 200 || body.code !== 0 || !Array.isArray(body.data)) throw Error("Own sales read failed");
  const seeded = body.data.filter((order) => /^NX-(ACCOUNT|DEMO)/.test(order.orderNumber) && order.status === "PAID");
  if (!seeded.length) throw Error("No previously seeded PAID review row was returned");
  report.seededPaidOrders = seeded.map((order) => ({ orderId: order.orderId, orderNumber: order.orderNumber, createdAt: order.createdAt, recipientName: order.recipientName, phoneNumberPresent: typeof order.phoneNumber === "string" && !!order.phoneNumber, status: order.status, totalAmount: order.totalAmount, items: order.items.map((item) => ({ productName: item.productName, skuCode: item.skuCode, quantity: item.quantity })) }));
  const table = page.getByRole("table", { name: "Seller orders", exact: true });
  await expect(table).toBeVisible();
  const observed = seeded.find((order) => order.recipientName && order.items?.[0]?.skuCode);
  if (!observed) throw Error("Seeded sales did not expose snapshot name and item SKU");
  const row = table.getByRole("row").filter({ hasText: observed.orderNumber });
  await expect(row).toContainText(observed.recipientName);
  await expect(row).toContainText(observed.items[0].skuCode);
  await expect(row).toContainText(String(observed.items[0].quantity));
  await expect(row).toContainText("Paid");
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error("Sales document overflow");
    const filename = `live-seeded-paid-sales-${width}.png`;
    await page.screenshot({ path: path.join(output, filename), fullPage: true, caret: "initial", style: "nextjs-portal { visibility: hidden !important; }" });
    report.screenshots.push(filename);
  }
  report.stage = "complete"; report.passed = true;
} catch {
  report.error = `Read-only check stopped at ${report.stage}; no business data was changed.`;
} finally { await context.close(); await browser.close(); }
const result = path.join(output, "live-seeded-sales-results.json"); writeFileSync(result, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ productStatePassed: productPassed, salesPassed: report.passed, result }, null, 2));
if (!report.passed) process.exitCode = 1;
