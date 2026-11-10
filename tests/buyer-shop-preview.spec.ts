import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("buyer sample screens support cart, address, delivery and payment choices without a purchase request", async ({ page }) => {
  const purchases: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && /\/api\/v1\/(orders|payments)$/.test(new URL(request.url()).pathname)) purchases.push(request.url());
  });
  await page.goto("/cart/preview");
  await expect(page.getByRole("heading", { name: "Cart", exact: true })).toBeVisible();
  await page.getByLabel("Discount Code", { exact: true }).fill("NEXUS10");
  await page.getByRole("button", { name: "Apply Code", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Sample voucher applied." })).toBeVisible();
  await page.getByRole("link", { name: "Proceed to Checkout", exact: true }).click();
  await page.getByRole("button", { name: "Add Address", exact: true }).click();
  await page.getByLabel("Sample address", { exact: true }).fill("123 Demo Street, Ho Chi Minh City");
  await page.getByRole("button", { name: "Save sample address", exact: true }).click();
  await expect(page.getByRole("radio", { name: /New sample address 123 Demo Street/ })).toBeChecked();
  await page.getByRole("radio", { name: /GHN Standard/ }).check();
  await page.getByRole("radio", { name: /Credit or debit card/ }).check();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("link", { name: "Preview payment result", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Order NX-260929-0042 isn’t paid yet", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Paid", exact: true }).click();
  await expect(page.getByText("Payment received", { exact: true })).toBeVisible();
  expect(purchases).toEqual([]);
});

test("buyer sample screens fit mobile and desktop and provide visual evidence", async ({ page }) => {
  const directory = "docs/features/buyer-shop-evidence";
  await mkdir(directory, { recursive: true });
  for (const viewport of [{ width: 375, height: 812 }, { width: 1440, height: 1000 }]) {
    await page.setViewportSize(viewport);
    for (const screen of [
      { name: "cart", path: "/cart/preview" },
      { name: "checkout", path: "/checkout/preview" },
      { name: "paid", path: "/checkout/result/preview?state=paid" },
      { name: "unpaid", path: "/checkout/result/preview?state=unpaid" },
    ]) {
      await page.goto(screen.path);
      await expect(page.getByText("Design preview", { exact: true })).toBeVisible();
      await expect(page.locator("header").getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `${directory}/${screen.name}-${viewport.width}.png`, fullPage: true, caret: "initial", style: "nextjs-portal { visibility: hidden !important; }" });
    }
  }
});
