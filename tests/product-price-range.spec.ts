import { expect, test } from "@playwright/test";

test("large decimal price ranges remain visible and selected SKU cents stay exact", async ({ page }) => {
  const minimum = "99999999999999999.98";
  const maximum = "99999999999999999.99";
  await page.route("**/api/v1/products/precision", (route) => route.fulfill({ json: {
    code: 0, message: "response success", data: {
      id: "precision", name: "Precision product", slug: "precision-product",
      categoryId: "electronics", sellerId: "seller-1", status: "ACTIVE",
      minPrice: minimum, maxPrice: maximum, description: null, auctionEnable: false, images: [],
      skus: [minimum, maximum].map((price, index) => ({
        id: `precision-${index}`, productId: "precision", skuCode: `PRECISION-${index}`,
        color: index ? "Blue" : "Red", size: "M", price, status: "ACTIVE",
      })),
    },
  } }));
  await page.goto("/products/precision-product?id=precision");
  await expect(page.getByRole("heading", { name: "Precision product", exact: true })).toBeVisible();
  const range = page.getByTestId("product-price-range");
  await expect(range).toHaveText("99.999.999.999.999.999,98 ₫ – 99.999.999.999.999.999,99 ₫");
  const selectedPrice = page.locator('[aria-label="Product details"] p[aria-live="polite"]');
  await expect(selectedPrice).toHaveText("99.999.999.999.999.999,98 ₫");
  await page.getByRole("button", { name: "Blue / M", exact: true }).click();
  await expect(selectedPrice).toHaveText("99.999.999.999.999.999,99 ₫");
  await expect(range).toHaveText("99.999.999.999.999.999,98 ₫ – 99.999.999.999.999.999,99 ₫");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
