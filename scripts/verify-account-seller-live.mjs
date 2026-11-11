// Opt-in integration evidence against the actual local Keycloak/gateway/PostgreSQL.
// No fixture routes, credential provisioning, storage-state export, HAR or tracing.
import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = process.env.NEXUS_LIVE_APP_ORIGIN || "http://localhost:3000";
const envPath = process.env.NEXUS_LIVE_ENV_FILE || path.resolve(root, "../be-project-nexus/infra/local-dev/.env");
const localEnv = parseEnv(readFileSync(envPath, "utf8"));
const output = path.resolve(root, "../docs/account-seller-evidence");
mkdirSync(output, { recursive: true });
const selected = process.argv.includes("--buyer-only") ? ["buyer"] : process.argv.includes("--seller-only") ? ["seller"] : ["buyer", "seller"];
if (process.argv.includes("--upload") && process.argv.includes("--remove-seed-image")) throw new Error("Run upload and fixed seed image removal as separate checks.");
const report = { checkedAt: new Date().toISOString(), sourceBase: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(), environment: "live local Keycloak, gateway and PostgreSQL; no mocks", app, accounts: [] };
const browser = await chromium.launch({ channel: "chrome", headless: true });
const responseJson = async (response) => {
  let timer;
  try {
    return await Promise.race([
      response.json(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Response body was canceled or timed out")), 8000); }),
    ]);
  } finally { clearTimeout(timer); }
};
const requiredRead = (role) => role === "buyer" ? ["/api/v1/users/me", "/api/v1/carts/me", "/api/v1/orders", "/api/v1/notifications"] : ["/api/v1/users/me", "/api/v1/products/mine", "/api/v1/orders/sales"];
let failed = false;
try {
  for (const role of selected) {
    const password = localEnv[`DEMO_${role.toUpperCase()}_PASSWORD`];
    const account = { role, stage: "configuration", passed: false, operations: [], screenshots: [], checks: [] };
    report.accounts.push(account);
    if (!password) { account.error = "Demo password is missing from the ignored local environment file."; failed = true; continue; }
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    const pendingCaptures = new Set();
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (!url.pathname.startsWith("/api/v1/")) return;
      const request = response.request();
      if (["/api/v1/auth/session", "/api/v1/auth/refresh"].includes(url.pathname)) {
        // Only status is retained: these bodies and headers contain credentials.
        account.operations.push({ method: request.method(), path: url.pathname, status: response.status() });
        return;
      }
      const capture = (async () => {
        const operation = { method: request.method(), path: url.pathname, status: response.status() };
        // Restrict retained JSON to non-secret contract metadata and counts.
        if (request.method() === "GET" && response.headers()["content-type"]?.includes("application/json")) {
          try {
            const body = await responseJson(response);
            operation.applicationCode = body.code;
            if (Array.isArray(body.data)) operation.records = body.data.length;
            if (body.page) operation.page = body.page;
            if (url.pathname === "/api/v1/users/me") operation.roles = body.data?.roles;
            if (url.pathname === "/api/v1/carts/me") operation.items = body.data?.items?.length;
            if (url.pathname === "/api/v1/inventory" && Array.isArray(body.data)) operation.taskStock = body.data.filter((stock) => stock.skuId?.startsWith("93000000-")).map(({ skuId, available }) => ({ skuId, available }));
          } catch { operation.jsonReadable = false; }
        }
        account.operations.push(operation);
      })();
      pendingCaptures.add(capture);
      void capture.finally(() => pendingCaptures.delete(capture));
    });
    try {
      account.stage = "Keycloak sign-in";
      const destination = role === "buyer" ? "/orders" : "/seller/products";
      await page.goto(`${app}/sign-in?returnTo=${encodeURIComponent(destination)}`);
      await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
      await page.waitForURL((url) => url.pathname.includes("/realms/nexus/protocol/openid-connect/auth"));
      await page.locator("#username").fill(`${role}@nexus.local`);
      await page.locator("#password").fill(password);
      await page.locator("#kc-login").click();
      account.stage = "callback/session/profile";
      await page.waitForURL(`${app}${destination}`, { timeout: 60_000 });
      await page.waitForFunction(() => !document.querySelector('input[type="password"]'));
      const pages = role === "buyer" ? [
        ["orders", "/orders"], ["order-detail", "/orders/93000000-0000-4000-8000-000000000605"], ["notifications", "/notifications"], ["profile", "/profile"],
      ] : [["products", "/seller/products"], ["orders", "/seller/orders"], ["inventory", "/seller/inventory"], ["product-editor", "/seller/products/93000000-0000-4000-8000-000000000201"]];
      for (const [name, route] of pages) {
        account.stage = `${role} ${name}`;
        await page.goto(`${app}${route}`);
        await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
        await page.getByRole("heading", { level: 1 }).first().waitFor();
        const heading = await page.getByRole("heading", { level: 1 }).first().textContent();
        const expectedHeading = { orders: /^Orders$/, "order-detail": /^Order NX-ACCOUNT-0005$/, notifications: /^Notifications$/, profile: /^Profile$/, products: /^Products$/, inventory: /^Inventory$/, "product-editor": /^Edit Product$/ }[name];
        if (!expectedHeading?.test(heading?.trim() || "")) throw new Error("Expected live page content did not render");
        for (const [width, height] of [[1440, 1000], [375, 812]]) {
          await page.setViewportSize({ width, height });
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
          account.checks.push({ page: name, width, horizontalOverflow: overflow });
          if (overflow) failed = true;
          const filename = `live-${role}-${name}-${width}.png`;
          await page.screenshot({ path: path.join(output, filename), fullPage: true, style: "nextjs-portal { visibility: hidden !important; }" });
          account.screenshots.push(filename);
        }
      }
      if (role === "seller" && process.argv.includes("--upload")) {
        account.stage = "seller product edit";
        const productId = "93000000-0000-4000-8000-000000000201";
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto(`${app}/seller/products/${productId}`);
        const productName = page.getByLabel("Product Name", { exact: true });
        await productName.waitFor();
        const name = await productName.inputValue();
        await productName.fill(name.endsWith(" (local review)") ? name : `${name} (local review)`);
        const updated = page.waitForResponse((response) => new URL(response.url()).pathname === `/api/v1/products/${productId}` && response.request().method() === "PUT");
        await page.getByRole("button", { name: "Save Changes", exact: true }).click();
        const updateResponse = await updated;
        const updateBody = await updateResponse.json();
        if (updateResponse.status() !== 200 || updateBody.code !== 0) throw new Error("Product edit failed");
        account.checks.push({ operation: "browser product edit", status: updateResponse.status(), applicationCode: updateBody.code });
        account.stage = "seller browser image upload";
        const sourcePath = path.resolve(root, "../be-project-nexus/infra/local-dev/seed-images/shirt.jpg");
        const uploaded = page.waitForResponse((response) => new URL(response.url()).pathname === `/api/v1/products/${productId}/images` && response.request().method() === "POST", { timeout: 60_000 });
        await page.getByLabel("Product image file", { exact: true }).setInputFiles(sourcePath);
        const uploadResponse = await uploaded;
        const uploadBody = await uploadResponse.json();
        if (uploadResponse.status() !== 201 || uploadBody.code !== 0 || !uploadBody.data?.id || !uploadBody.data?.imageUrl) throw new Error("Image upload failed");
        const uploadedId = uploadBody.data.id;
        if (!/^[0-9a-f-]{36}$/i.test(uploadedId)) throw new Error("Invalid image UUID");
        account.stage = "uploaded image metadata and integrity";
        const metadata = JSON.parse(execFileSync("docker", ["exec", "nexus-postgres", "psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", localEnv.DB_USERNAME, "-d", "catalog_db", "-c", `SELECT row_to_json(x) FROM (SELECT id,product_id,image_url FROM product_images WHERE id='${uploadedId}' AND product_id='${productId}') x;`], { encoding: "utf8" }).trim());
        const image = await fetch(uploadBody.data.imageUrl);
        const downloaded = Buffer.from(await image.arrayBuffer());
        const originalSha256 = createHash("sha256").update(readFileSync(sourcePath)).digest("hex");
        const publicSha256 = createHash("sha256").update(downloaded).digest("hex");
        account.upload = { environment: "browser FE multipart field file → real gateway/catalog → configured Supabase bucket", status: uploadResponse.status(), applicationCode: uploadBody.code, productId, imageId: uploadedId, publicUrl: uploadBody.data.imageUrl, metadataMatches: metadata.image_url === uploadBody.data.imageUrl, publicStatus: image.status, originalSha256, publicSha256, hashesMatch: originalSha256 === publicSha256 };
        if (!image.ok || !account.upload.metadataMatches || !account.upload.hashesMatch) throw new Error("Public image verification failed");
        await page.getByText("Image uploaded through the backend.", { exact: true }).waitFor();
        const filename = "live-seller-product-upload-1440.png";
        await page.screenshot({ path: path.join(output, filename), fullPage: true, style: "nextjs-portal { visibility: hidden !important; }" });
        account.screenshots.push(filename);
      }
      if (role === "seller" && process.argv.includes("--remove-seed-image")) {
        account.stage = "fixed task image removal precondition";
        const productId = "93000000-0000-4000-8000-000000000201";
        const imageId = "93000000-0000-4000-8000-000000000401";
        const databaseJson = (sql) => JSON.parse(execFileSync("docker", ["exec", "nexus-postgres", "psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", localEnv.DB_USERNAME, "-d", "catalog_db", "-c", sql], { encoding: "utf8" }).trim());
        const readImages = () => databaseJson(`SELECT coalesce(json_agg(x ORDER BY id),'[]'::json) FROM (SELECT id,product_id,image_url FROM product_images WHERE product_id='${productId}') x;`);
        const before = readImages();
        const target = before.find((image) => image.id === imageId);
        const expectedUrl = `${localEnv.SUPABASE_URL.replace(/\/+$/, "")}/storage/v1/object/public/${localEnv.SUPABASE_BUCKET || "product-images"}/products/${productId}/${imageId}.jpg`;
        if (!target || target.image_url !== expectedUrl) throw new Error("Fixed task image does not have its own exclusively scoped object");
        const source = databaseJson("SELECT row_to_json(x) FROM (SELECT id,image_url FROM product_images WHERE id='69000000-0000-4000-8000-000000000304' AND product_id='69000000-0000-4000-8000-000000000204') x;");
        const sourceBefore = await fetch(source.image_url);
        if (!sourceBefore.ok) throw new Error("Original source image is unavailable");
        const sourceHashBefore = createHash("sha256").update(Buffer.from(await sourceBefore.arrayBuffer())).digest("hex");
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto(`${app}/seller/products/${productId}`);
        const media = page.locator("section").filter({ has: page.getByRole("heading", { name: "Media", level: 2, exact: true }) });
        const removeButton = media.locator(`img[src="${expectedUrl}"]`).locator("..").locator("..").getByRole("button", { name: "Remove", exact: true });
        await removeButton.waitFor();
        account.stage = "browser fixed task image removal";
        const removed = page.waitForResponse((response) => new URL(response.url()).pathname === `/api/v1/products/${productId}/images/${imageId}` && response.request().method() === "DELETE", { timeout: 60_000 });
        await removeButton.click();
        const removedResponse = await removed;
        if (removedResponse.status() !== 204) throw new Error("Image removal failed");
        await media.locator(`img[src="${expectedUrl}"]`).waitFor({ state: "detached" });
        const after = readImages();
        const remainingUnchanged = JSON.stringify(before.filter((image) => image.id !== imageId)) === JSON.stringify(after);
        const deletedPublic = await fetch(`${expectedUrl}?seed_verify=${Date.now()}`);
        let deletedProviderStatus;
        if (deletedPublic.status === 400) { try { deletedProviderStatus = String((await deletedPublic.json()).statusCode); } catch {} }
        const sourceAfter = await fetch(`${source.image_url}?seed_verify=${Date.now()}`);
        const sourceHashAfter = createHash("sha256").update(Buffer.from(await sourceAfter.arrayBuffer())).digest("hex");
        account.removal = { environment: "browser FE → real gateway/catalog → existing Supabase bucket", productId, imageId, publicUrl: expectedUrl, status: removedResponse.status(), metadataRemoved: !after.some((image) => image.id === imageId), otherProductImagesUnchanged: remainingUnchanged, publicStatusAfterRemoval: deletedPublic.status, deletedProviderStatus, originalSourceStillPublic: sourceAfter.status === 200, originalSourceBytesUnchanged: sourceHashBefore === sourceHashAfter, recovery: "Re-run task image provisioning before the database seed to restore this deterministic local review object/metadata." };
        if (!account.removal.metadataRemoved || !remainingUnchanged || !(deletedPublic.status === 404 || deletedProviderStatus === "404") || !account.removal.originalSourceStillPublic || !account.removal.originalSourceBytesUnchanged) throw new Error("Image removal preservation check failed");
        const filename = "live-seller-seed-image-removed-1440.png";
        await page.screenshot({ path: path.join(output, filename), fullPage: true, style: "nextjs-portal { visibility: hidden !important; }" });
        account.screenshots.push(filename);
      }
      account.stage = "API contract assertions";
      await Promise.allSettled([...pendingCaptures]);
      for (const endpoint of requiredRead(role)) {
        if (!account.operations.some((operation) => operation.method === "GET" && operation.path === endpoint && operation.status === 200 && operation.applicationCode === 0)) {
          throw new Error("Required live API read did not succeed");
        }
      }
      account.passed = true;
      account.stage = "complete";
    } catch {
      // Playwright errors may include input call details; never persist/print them.
      account.error = `Live verification stopped at ${account.stage}. Inspect the UI and sanitized operation statuses; no credentials were changed.`;
      failed = true;
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
const reportFile = path.join(output, `live-${selected.join("-")}${process.argv.includes("--upload") ? "-upload" : process.argv.includes("--remove-seed-image") ? "-remove" : ""}-results.json`);
writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ reportFile, accounts: report.accounts.map(({ role, passed, stage }) => ({ role, passed, stage })) }, null, 2));
if (failed) process.exitCode = 1;
