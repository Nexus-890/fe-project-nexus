import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

for (const width of [1440, 375]) {
  test(`seller preview retains edits and shipment choices at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/seller/preview");
    await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
    await expect(page.getByLabel("Sample preview")).toContainText("No server writes");
    await page.getByRole("navigation", { name: "Seller navigation" }).getByRole("link", { name: "Products", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Products", exact: true })).toBeVisible();
    await page.getByRole("table", { name: "Seller products" }).getByRole("link", { name: "Apple AirPods Max Silver", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Edit Product", exact: true })).toBeVisible();
    await page.getByLabel("Product Name", { exact: true }).fill("A very long sample product name retained across preview screens");
    await page.getByRole("button", { name: "Save Preview", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("No server data changed");
    await page.getByRole("navigation", { name: "Seller navigation" }).getByRole("link", { name: "Products", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Products", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "A very long sample product name retained across preview screens", exact: true })).toBeVisible();
    await page.getByRole("navigation", { name: "Seller navigation" }).getByRole("link", { name: "Orders", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Orders", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(page.getByRole("table", { name: "Seller orders" }).locator("tbody tr")).toHaveCount(7);
    await page.getByRole("button", { name: "To Ship", exact: true }).click();
    await page.getByRole("button", { name: "Create Shipment Preview", exact: true }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel(/GHTK Standard/).check();
    await page.getByRole("button", { name: "Review Shipment Locally", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("No carrier booking");
    await page.getByRole("button", { name: "Create Shipment Preview", exact: true }).first().click();
    await expect(page.getByLabel(/GHTK Standard/)).toBeChecked();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test(`seller design screens have responsive evidence at ${width}px`, async ({ page }) => {
    test.setTimeout(90_000);
    const output = path.resolve("docs/features/seller-portal-evidence");
    await mkdir(output, { recursive: true });
    await page.setViewportSize({ width, height: 1000 });
    for (const [name, route, heading] of [
      ["overview", "", "Overview"],
      ["products", "/products", "Products"],
      ["product-editor", "/products/sample-product-1", "Edit Product"],
      ["inventory", "/inventory", "Inventory"],
      ["auctions", "/auctions", "Auctions"],
      ["create-auction", "/auctions/new", "Create Auction"],
      ["orders", "/orders", "Orders"],
    ]) {
      await page.goto(`/seller/preview${route}`);
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      if (name === "create-auction") {
        await page.getByLabel("Product", { exact: true }).selectOption("sample-product-1");
        await page.getByLabel("SKU", { exact: true }).selectOption("sample-sku-1");
        await page.getByLabel("Start (device local time)", { exact: true }).fill("2026-12-01T20:00");
      }
      if (name === "product-editor") {
        const primary = page.getByRole("button", { name: "Save Preview", exact: true });
        await primary.hover();
        const color = await primary.evaluate((element) => getComputedStyle(element).backgroundColor);
        expect(color).not.toBe("rgb(255, 255, 255)");
        expect(color).not.toBe("rgba(0, 0, 0, 0)");
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: path.join(output, `${name}-${width}.png`), fullPage: true, caret: "initial", style: "nextjs-portal { visibility: hidden !important; }" });
    }
    await page.getByRole("button", { name: "Create Shipment Preview", exact: true }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: path.join(output, `shipment-dialog-${width}.png`), fullPage: true, caret: "initial", style: "nextjs-portal { visibility: hidden !important; }" });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
}
