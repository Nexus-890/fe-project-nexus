import { mkdir } from "node:fs/promises";
import path from "node:path";
import { test, expect } from "@playwright/test";

for (const width of [1440, 375]) {
  test(`sample delivery and rating stay local and fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const writes: string[] = [];
    page.on("request", (request) => { if (/ratings|reputations|orders/.test(new URL(request.url()).pathname) && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) writes.push(request.url()); });
    await page.goto("/orders/preview");
    await expect(page.getByRole("heading", { name: "Order NX-SAMPLE-0311", exact: true })).toBeVisible();
    await expect(page.getByText("Order, delivery, address and payment information below are illustrative.", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Download Invoice", exact: true })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Preview seller rating", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Rate your seller", exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Review sample rating", exact: true })).toBeDisabled();
    await dialog.getByRole("radio", { name: "4 stars", exact: true }).check();
    await dialog.getByRole("button", { name: "Fast shipping", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Fast shipping", exact: true })).toHaveAttribute("aria-pressed", "true");
    await dialog.getByLabel("Your review (optional)", { exact: true }).fill("Arrived as described.");
    await dialog.getByRole("button", { name: "Review sample rating", exact: true }).click();
    await expect(dialog.getByRole("status")).toContainText("Nothing was submitted.");
    expect(writes).toEqual([]);
    const directory = path.resolve("docs/features/buyer-account-evidence");
    await mkdir(directory, { recursive: true });
    await page.screenshot({ path: path.join(directory, `rating-preview-${width}.png`), fullPage: true, style: "nextjs-portal { visibility: hidden !important; }" });
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await page.getByRole("button", { name: "Preview seller rating", exact: true }).click();
    await expect(dialog.getByRole("radio", { name: "4 stars", exact: true })).toBeChecked();
    await dialog.getByRole("button", { name: "Close rating preview", exact: true }).click();
    await page.screenshot({ path: path.join(directory, `delivery-preview-${width}.png`), fullPage: true, style: "nextjs-portal { visibility: hidden !important; }" });
  });

  test(`notification preference preview retains local switches and resets at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const writes: string[] = [];
    page.on("request", (request) => { if (/preferences/.test(request.url()) && ["POST", "PUT", "PATCH"].includes(request.method())) writes.push(request.url()); });
    await page.goto("/notifications/preferences");
    await expect(page.getByRole("heading", { name: "Notification Preferences", exact: true })).toBeVisible();
    const outbid = page.getByRole("switch", { name: "Outbid alerts email", exact: true });
    await expect(outbid).toHaveAttribute("aria-checked", "true");
    await outbid.click();
    await expect(outbid).toHaveAttribute("aria-checked", "false");
    await page.getByRole("button", { name: "Apply Preview Preferences", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Nothing was saved to the server.");
    await page.getByRole("button", { name: "Reset to Defaults", exact: true }).click();
    await expect(outbid).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("switch")).toHaveCount(10);
    expect(writes).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const directory = path.resolve("docs/features/buyer-account-evidence");
    await mkdir(directory, { recursive: true });
    await page.screenshot({ path: path.join(directory, `preferences-preview-${width}.png`), fullPage: true, style: "nextjs-portal { visibility: hidden !important; }" });
  });
}
