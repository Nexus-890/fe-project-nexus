import { expect, test } from "@playwright/test";

test("sample voucher, address, delivery and payment persist through result and guest order detail", async ({ page }) => {
  const purchases: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && /\/api\/v1\/(orders|payments)$/.test(new URL(request.url()).pathname)) purchases.push(request.url());
  });
  await page.goto("/cart/preview");
  await expect(page.getByRole("heading", { name: "Cart", exact: true })).toBeVisible();
  await page.getByLabel("Discount Code", { exact: true }).fill("NEXUS10");
  await page.getByRole("button", { name: "Apply Code", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Sample voucher applied." })).toBeVisible();
  await expect(page.getByTestId("preview-discount")).toHaveText("−68.000,00 ₫");
  await expect(page.getByTestId("preview-total")).toHaveText("27.169.000,00 ₫");
  await page.getByRole("link", { name: "Proceed to Checkout", exact: true }).click();
  await expect(page.getByTestId("preview-discount")).toHaveText("−68.000,00 ₫");
  await expect(page.getByTestId("preview-total")).toHaveText("27.169.000,00 ₫");
  await expect(page.getByLabel("Discount Code", { exact: true })).toHaveValue("NEXUS10");
  await page.getByRole("button", { name: "Add Address", exact: true }).click();
  await page.getByLabel("Sample address", { exact: true }).fill("123 Demo Street, Ho Chi Minh City");
  await page.getByRole("button", { name: "Save sample address", exact: true }).click();
  await expect(page.getByRole("radio", { name: /New sample address 123 Demo Street/ })).toBeChecked();
  await page.getByRole("radio", { name: /GHN Standard/ }).check();
  await page.getByRole("radio", { name: /Credit or debit card/ }).check();
  await expect(page.getByTestId("preview-shipping")).toHaveText("32.000,00 ₫");
  await expect(page.getByTestId("preview-total")).toHaveText("27.152.000,00 ₫");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("link", { name: "Preview payment result", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Order NX-260929-0042 isn’t paid yet", exact: true })).toBeVisible();
  await expect(page.getByTestId("receipt-address")).toContainText("123 Demo Street, Ho Chi Minh City");
  await expect(page.getByTestId("receipt-delivery")).toContainText("GHN Standard");
  await expect(page.getByTestId("receipt-payment")).toHaveText("Credit or debit card");
  await expect(page.getByTestId("receipt-voucher")).toHaveText("NEXUS10");
  await expect(page.getByTestId("receipt-discount")).toHaveText("−68.000,00 ₫");
  await expect(page.getByTestId("receipt-total")).toHaveText("27.152.000,00 ₫");
  await page.getByRole("link", { name: "Paid", exact: true }).click();
  await expect(page.getByText("Payment received", { exact: true })).toBeVisible();
  await expect(page.getByTestId("receipt-total")).toHaveText("27.152.000,00 ₫");
  await page.getByRole("link", { name: "View Order", exact: true }).click();
  await expect(page).toHaveURL(/\/order\/preview\?state=paid$/);
  await expect(page.getByRole("heading", { name: "Sample order NX-260929-0042", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Sample order items" }).locator("li")).toHaveCount(3);
  await expect(page.getByTestId("receipt-address")).toContainText("123 Demo Street, Ho Chi Minh City");
  await expect(page.getByTestId("receipt-delivery")).toContainText("GHN Standard");
  await expect(page.getByTestId("receipt-payment")).toHaveText("Credit or debit card");
  await expect(page.getByTestId("receipt-total")).toHaveText("27.152.000,00 ₫");
  await page.reload();
  await expect(page.getByTestId("receipt-total")).toHaveText("27.152.000,00 ₫");
  await expect(page.getByTestId("receipt-address")).toContainText("123 Demo Street, Ho Chi Minh City");
  await page.getByRole("link", { name: "Back to sample result", exact: true }).click();
  await page.getByRole("link", { name: "Checkout", exact: true }).click();
  await expect(page.getByRole("radio", { name: /New sample address 123 Demo Street/ })).toBeChecked();
  await expect(page.getByRole("radio", { name: /GHN Standard/ })).toBeChecked();
  await expect(page.getByRole("radio", { name: /Credit or debit card/ })).toBeChecked();
  await expect(page.getByTestId("preview-total")).toHaveText("27.152.000,00 ₫");
  expect(purchases).toEqual([]);
});

test("sample item edits and checkout voucher carry into bank result and matching sample detail", async ({ page }) => {
  const purchases: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && /\/api\/v1\/(orders|payments)$/.test(new URL(request.url()).pathname)) purchases.push(request.url());
  });
  await page.goto("/cart/preview");
  const shirt = page.getByTestId("cart-line-preview-shirt");
  await shirt.getByRole("spinbutton").fill("3");
  await shirt.getByRole("spinbutton").press("Enter");
  await page.getByRole("button", { name: "Remove Nexus Phone Pro", exact: true }).click();
  await expect(page.getByTestId("preview-subtotal")).toHaveText("2.796.000,00 ₫");
  await page.getByRole("link", { name: "Proceed to Checkout", exact: true }).click();
  await expect(page.getByTestId("preview-item-preview-phone")).toHaveCount(0);
  await expect(page.getByTestId("preview-item-preview-shirt")).toContainText("Qty 3");
  await expect(page.getByTestId("preview-subtotal")).toHaveText("2.796.000,00 ₫");
  await page.getByLabel("Discount Code", { exact: true }).fill("INVALID");
  await page.getByRole("button", { name: "Apply Code", exact: true }).click();
  await expect(page.getByTestId("preview-discount")).toHaveText("−0,00 ₫");
  await page.getByLabel("Discount Code", { exact: true }).fill("NEXUS10");
  await page.getByRole("button", { name: "Apply Code", exact: true }).click();
  await page.getByRole("radio", { name: /Nguyen Thi Lan · Office/ }).check();
  await page.getByRole("radio", { name: /GHN Standard/ }).check();
  await page.getByRole("radio", { name: /Bank transfer \(VietQR\)/ }).check();
  await expect(page.getByTestId("preview-total")).toHaveText("2.760.000,00 ₫");
  await page.getByRole("link", { name: "Preview payment result", exact: true }).click();
  await expect(page).toHaveURL(/\/checkout\/result\/preview\?state=paid$/);
  await expect(page.getByText("Payment received", { exact: true })).toBeVisible();
  await expect(page.getByTestId("receipt-address")).toContainText("Saigon Centre, 65 Le Loi");
  await expect(page.getByTestId("receipt-payment")).toHaveText("Bank transfer (VietQR)");
  await expect(page.getByTestId("receipt-total")).toHaveText("2.760.000,00 ₫");
  await page.getByRole("link", { name: "View Order", exact: true }).click();
  await expect(page).toHaveURL(/\/order\/preview\?state=paid$/);
  await expect(page.getByTestId("preview-item-preview-shirt")).toContainText("Qty 3");
  await expect(page.getByTestId("preview-item-preview-shirt")).toContainText("Classic White · M");
  await expect(page.getByRole("region", { name: "Sample order items" }).locator("li")).toHaveCount(2);
  await expect(page.getByTestId("receipt-total")).toHaveText("2.760.000,00 ₫");
  await page.goBack();
  await expect(page).toHaveURL(/\/checkout\/result\/preview\?state=paid$/);
  await expect(page.getByText("Payment received", { exact: true })).toBeVisible();
  await expect(page.getByTestId("receipt-total")).toHaveText("2.760.000,00 ₫");
  await page.goBack();
  await expect(page).toHaveURL(/\/checkout\/preview$/);
  await expect(page.getByRole("heading", { name: "Checkout", exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Nguyen Thi Lan · Office/ })).toBeChecked();
  await expect(page.getByRole("radio", { name: /GHN Standard/ })).toBeChecked();
  await page.getByRole("link", { name: "Back to Cart", exact: true }).click();
  await expect(page.getByTestId("cart-line-preview-shirt").getByRole("spinbutton")).toHaveValue("3");
  await page.reload();
  await expect(page.getByTestId("cart-line-preview-shirt").getByRole("spinbutton")).toHaveValue("3");
  await expect(page.getByTestId("cart-line-preview-phone")).toHaveCount(0);
  expect(purchases).toEqual([]);
});

test("buyer sample screens fit mobile and desktop and provide visual evidence", async ({ page }, info) => {
  for (const viewport of [{ width: 375, height: 812 }, { width: 1440, height: 1000 }]) {
    await page.setViewportSize(viewport);
    for (const screen of [
      { name: "cart", path: "/cart/preview" },
      { name: "checkout", path: "/checkout/preview" },
      { name: "paid", path: "/checkout/result/preview?state=paid" },
      { name: "unpaid", path: "/checkout/result/preview?state=unpaid" },
      { name: "sample-order", path: "/order/preview?state=paid" },
    ]) {
      await page.goto(screen.path);
      await expect(page.getByText("Design preview", { exact: true })).toBeVisible();
      await expect(page.locator("header").getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const filename = `${screen.name}-${viewport.width}.png`;
      const output = info.outputPath(filename);
      await page.screenshot({ path: output, fullPage: true, caret: "initial", style: "nextjs-portal { visibility: hidden !important; }" });
      await info.attach(filename, { path: output, contentType: "image/png" });
    }
  }
});
