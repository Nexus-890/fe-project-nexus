import { expect, test, type Page } from "@playwright/test";

const navigationName = "My Nexus and Watchlist";
const triggerName = "Open account and watchlist navigation";

async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const width of [375, 768]) {
  test(`${width}px account and watchlist navigation supports keyboard dismissal and real destinations`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto("/");
    await expect(page.locator("header").getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
    const trigger = page.getByRole("button", { name: triggerName, exact: true });
    const navigation = page.getByRole("dialog", { name: navigationName, exact: true });

    await expect(trigger).toBeVisible();
    const triggerBounds = await trigger.boundingBox();
    expect(triggerBounds?.width).toBeGreaterThanOrEqual(44);
    expect(triggerBounds?.height).toBeGreaterThanOrEqual(44);
    await trigger.focus();
    await trigger.press("Enter");
    await expect(navigation).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(navigation.getByRole("button", { name: "Close account and watchlist navigation", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(navigation.getByRole("link", { name: "My profile", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(navigation.getByRole("link", { name: "My orders", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(navigation.getByRole("link", { name: "My Bids", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(navigation).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(navigation).toBeVisible();
    const navigationBounds = await navigation.boundingBox();
    expect(navigationBounds?.x).toBeGreaterThanOrEqual(0);
    expect((navigationBounds?.x ?? width) + (navigationBounds?.width ?? width)).toBeLessThanOrEqual(width);
    expect(await navigation.getByRole("link").evaluateAll((links) => links.every((link) => link.getBoundingClientRect().height >= 44))).toBe(true);
    await noHorizontalOverflow(page);
    await page.locator("header").click({ position: { x: 1, y: 1 } });
    await expect(navigation).toHaveCount(0);

    await trigger.click();
    await navigation.getByRole("link", { name: "Saved items", exact: true }).click();
    await expect(page).toHaveURL(/\/saved$/);
    await expect(page.getByRole("heading", { name: "Saved items", exact: true })).toBeVisible();
    await expect(navigation).toHaveCount(0);
    await noHorizontalOverflow(page);

    await trigger.click();
    await navigation.getByRole("link", { name: "My orders", exact: true }).click();
    await expect(page).toHaveURL(/\/orders$/);
    await expect(page.getByRole("heading", { name: "Sign in to view your orders", exact: true })).toBeVisible();
    await expect(navigation).toHaveCount(0);

    await trigger.click();
    await navigation.getByRole("link", { name: "My Bids", exact: true }).click();
    await expect(page).toHaveURL(/\/my-bids$/);
    await expect(page.getByRole("heading", { name: "Sign in to view your bids", exact: true })).toBeVisible();
    await expect(navigation).toHaveCount(0);

    await trigger.click();
    await navigation.getByRole("link", { name: "Explore auctions", exact: true }).click();
    await expect(page).toHaveURL(/\/auctions$/);
    await expect(page.getByRole("heading", { name: "Auctions", exact: true })).toBeVisible();
    await expect(navigation).toHaveCount(0);

    await trigger.click();
    await navigation.getByRole("link", { name: "My profile", exact: true }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  });
}

test("desktop keeps separate My Nexus and Watchlist destinations", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.locator("header").getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: triggerName, exact: true })).toBeHidden();

  const account = page.locator("header details").filter({ has: page.locator("summary", { hasText: "My Nexus" }) });
  await account.locator("summary").focus();
  await account.locator("summary").press("Enter");
  await expect(account.getByRole("link", { name: "My orders", exact: true })).toBeVisible();
  await expect(account.getByRole("link", { name: "My profile", exact: true })).toHaveAttribute("href", "/profile");
  await expect(account.getByRole("link", { name: "My Bids", exact: true })).toHaveAttribute("href", "/my-bids");
  await account.getByRole("link", { name: "Saved items", exact: true }).click();
  await expect(page).toHaveURL(/\/saved$/);

  const watchlist = page.locator("header details").filter({ has: page.locator("summary", { hasText: "Watchlist" }) });
  await watchlist.locator("summary").click();
  await expect(watchlist).toHaveAttribute("open", "");
  await expect(account).not.toHaveAttribute("open", "");
  await expect(watchlist.getByRole("link", { name: "Saved items", exact: true })).toHaveAttribute("href", "/saved");
  await watchlist.getByRole("link", { name: "Explore auctions", exact: true }).click();
  await expect(page).toHaveURL(/\/auctions$/);
  await expect(page.getByRole("heading", { name: "Auctions", exact: true })).toBeVisible();
  await account.locator("summary").click();
  await account.getByRole("link", { name: "My Bids", exact: true }).click();
  await expect(page).toHaveURL(/\/my-bids$/);
  await expect(page.getByRole("heading", { name: "Sign in to view your bids", exact: true })).toBeVisible();
  await noHorizontalOverflow(page);
});
