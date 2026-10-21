import { readFileSync } from "node:fs";
import path from "node:path";
import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

const sampleEnv = readFileSync(path.resolve(__dirname, "../../../be-project-nexus/infra/staging/.env.example"), "utf8");
function credential(key: string) {
  return process.env[key] || sampleEnv.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1].trim() || "";
}

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(credential("DEMO_BUYER_EMAIL"));
  await page.getByLabel("Password", { exact: true }).fill(credential("DEMO_BUYER_PASSWORD"));
  const login = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/v1/auth/login");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  const response = await login;
  expect(response.status()).toBe(200);
  const { accessToken } = await response.json();
  expect(typeof accessToken).toBe("string");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("header a[href='/profile']").first()).toBeVisible();
  return accessToken as string;
}

async function readCart(request: APIRequestContext, accessToken: string) {
  const response = await request.get("/api/v1/carts/me", { headers: { Authorization: `Bearer ${accessToken}` } });
  expect(response.status()).toBe(200);
  return response.json() as Promise<{ items: Array<{ skuId: string; quantity: number }> }>;
}

test("real app redirects anonymous profile access to sign in", async ({ page }) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/sign-in(?:\?|$)/);
});

test("real backend login and profile GET/PUT persist changes", async ({ page, request }) => {
  const accessToken = await signIn(page);
  const headers = { Authorization: `Bearer ${accessToken}` };
  const before = await request.get("/api/v1/users/me", { headers });
  expect(before.status()).toBe(200);
  const original = await before.json();
  const changedName = `${original.fullName} API test`;
  let restored = false;
  try {
    await page.locator("header a[href='/profile']").first().click();
    await expect(page.getByLabel("Full Name", { exact: true })).toHaveValue(original.fullName);
    await expect(page.getByLabel("Phone Number", { exact: true })).toHaveAttribute("readonly", "");
    await page.getByLabel("Full Name", { exact: true }).fill(changedName);
    const saved = page.waitForResponse(response => response.request().method() === "PUT" && new URL(response.url()).pathname === "/api/v1/users/me");
    await page.getByRole("button", { name: "Save Changes", exact: true }).click();
    expect((await saved).status()).toBe(200);
    const persisted = await request.get("/api/v1/users/me", { headers });
    expect((await persisted.json()).fullName).toBe(changedName);
    await page.getByLabel("Full Name", { exact: true }).fill(original.fullName);
    const restore = page.waitForResponse(response => response.request().method() === "PUT" && new URL(response.url()).pathname === "/api/v1/users/me");
    await page.getByRole("button", { name: "Save Changes", exact: true }).click();
    expect((await restore).status()).toBe(200);
    await expect(page.getByLabel("Full Name", { exact: true })).toHaveValue(original.fullName);
    restored = true;
  } finally {
    if (!restored) {
      const restore = await request.put("/api/v1/users/me", { headers, data: { fullName: original.fullName } });
      expect(restore.status()).toBe(200);
    }
  }
});

test("real catalog detail and add-to-cart use persisted PostgreSQL data", async ({ page, request }) => {
  const accessToken = await signIn(page);
  const productId = "6d260021-0000-4000-8000-000000000201";
  const skuId = "6d260021-0000-4000-8000-000000000301";
  const before = await readCart(request, accessToken);
  const quantity = before.items.find(item => item.skuId === skuId)?.quantity || 0;
  await page.locator("a[href='/categories/phones']").first().click();
  await expect(page).toHaveURL(/\/categories\/phones/);
  const detail = page.waitForResponse(response => response.request().method() === "GET" && new URL(response.url()).pathname === `/api/v1/products/${productId}`);
  await page.locator(`a[href*='id=${productId}']`).first().click();
  expect((await detail).status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("iPhone");
  await page.getByRole("button", { name: "Black / 128GB", exact: true }).click();
  const added = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/v1/carts/me/items");
  await page.getByRole("button", { name: "Add to Cart", exact: true }).click();
  expect((await added).status()).toBe(201);
  await expect(page.getByText("Added to cart.", { exact: true })).toBeVisible();
  const after = await readCart(request, accessToken);
  expect(after.items.find(item => item.skuId === skuId)?.quantity).toBe(quantity + 1);
});

test("localStorage restores a real login after reload and sign out removes it", async ({ page }) => {
  await signIn(page);
  await expect.poll(() => page.evaluate(() => Boolean(localStorage.getItem("nexus.accessToken")))).toBe(true);
  const restored = page.waitForResponse(response => response.request().method() === "GET" && new URL(response.url()).pathname === "/api/v1/users/me");
  await page.reload();
  expect((await restored).status()).toBe(200);
  await expect(page.locator("header a[href='/profile']").first()).toBeVisible();
  await page.locator("header a[href='/profile']").first().click();
  await expect(page).toHaveURL(/\/profile$/);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("nexus.accessToken") === null)).toBe(true);
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/sign-in(?:\?|$)/);
});

test("a stored invalid token gets a real 401 and is removed", async ({ page }) => {
  await page.goto("/sign-in");
  await page.evaluate(() => localStorage.setItem("nexus.accessToken", "invalid-session-test"));
  const rejected = page.waitForResponse(response => response.request().method() === "GET" && new URL(response.url()).pathname === "/api/v1/users/me");
  await page.goto("/profile");
  expect((await rejected).status()).toBe(401);
  await expect(page).toHaveURL(/\/sign-in(?:\?|$)/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("nexus.accessToken") === null)).toBe(true);
});
