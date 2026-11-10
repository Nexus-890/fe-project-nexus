import { test, expect, type Page } from "@playwright/test";

const fixtureOrigin = `http://127.0.0.1:${process.env.NEXUS_TEST_API_PORT ?? 3911}`;

async function layoutChecks(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const clipped = await page
    .locator("header :visible, main :visible, footer :visible")
    .evaluateAll((elements) =>
      elements
        .filter(
          (el) =>
            el instanceof HTMLElement &&
            el.clientWidth > 0 &&
            el.scrollWidth > el.clientWidth + 1,
        )
        .filter((el) => !el.closest("script,style,svg,pre"))
        .map((el) => (el.textContent ?? "").trim())
        .filter(Boolean),
    );
  expect(clipped).toEqual([]);
}

async function mobileChecks(page: Page) {
  // The preserved header deliberately uses 36px rows at lg; touch targets are 44px below lg.
  expect(page.viewportSize()?.width).toBeLessThan(1024);
  await layoutChecks(page);
  const small = await page
    .locator(
      "header a:visible, header button:visible, main a:visible, main button:visible, main input:visible, main select:visible, footer a:visible, footer button:visible",
    )
    .evaluateAll((elements) =>
      elements
        .filter((el) => !el.closest("nextjs-portal"))
        .map((el) => ({
          label: el.textContent,
          rect: el.getBoundingClientRect(),
        }))
        .filter(({ rect }) => rect.width < 44 || rect.height < 44)
        .map(({ label }) => label),
    );
  expect(small).toEqual([]);
}

test("home renders the API category tree at mobile and desktop without fetching products", async ({
  page,
}, info) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    // The page-load session restore (POST /api/v1/auth/refresh, #252) is not catalog data.
    if (pathname.startsWith("/api/v1/") && !pathname.startsWith("/api/v1/auth/"))
      apiRequests.push(request.url());
  });
  await page.goto("/");
  const tree = page.locator("#categories");
  await expect(tree.locator(":scope > ul > li")).toHaveCount(3);
  await expect(
    tree
      .getByRole("link", { name: "Electronics", exact: true })
      .locator("..")
      .getByRole("link", { name: "Audio", exact: true }),
  ).toBeVisible();
  await expect(
    tree
      .getByRole("link", { name: "Audio", exact: true })
      .locator("..")
      .getByRole("link", { name: "Headphones", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(0);
  expect(
    apiRequests.every(
      (url) => new URL(url).pathname === "/api/v1/categories/tree",
    ),
  ).toBe(true);
  const initialApiRequests = [...apiRequests];
  const categoryPicker = page.getByRole("combobox", {
    name: "Search category",
  });
  await categoryPicker.click();
  await page
    .getByRole("option", { name: "Home & Living", exact: true })
    .click();
  await expect(categoryPicker).toContainText("Home & Living");
  await expect(page.getByRole("article")).toHaveCount(0);
  expect(apiRequests).toEqual(initialApiRequests);
  await mobileChecks(page);
  await page.screenshot({
    path: info.outputPath("home-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const search = page.getByRole("textbox", { name: "Search for anything" });
  expect((await search.boundingBox())?.width).toBeGreaterThanOrEqual(300);
  await search.fill("apple laptop");
  await expect(search).toHaveValue("apple laptop");
  await categoryPicker.click();
  await page
    .getByRole("option", { name: "All Categories", exact: true })
    .click();
  await expect(categoryPicker).toContainText("All Categories");
  await categoryPicker.focus();
  await categoryPicker.press("ArrowDown");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(categoryPicker).toContainText("Electronics");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await categoryPicker.press("ArrowDown");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(categoryPicker).toBeFocused();
  await expect(categoryPicker).toContainText("Electronics");
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  expect(apiRequests).toEqual(initialApiRequests);
  await layoutChecks(page);
  await page.screenshot({
    path: info.outputPath("home-desktop.png"),
    fullPage: true,
  });
  await tree.getByRole("link", { name: "Electronics", exact: true }).click();
  await expect(page).toHaveURL(/\/categories\/electronics$/);
  await expect(page.getByRole("article")).toHaveCount(2);
});

test("category has only its products and responsive layout", async ({
  page,
}, info) => {
  await page.goto("/categories/electronics");
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(page.getByRole("article").first()).toContainText("Product 1");
  await expect(page.getByRole("article").first()).toContainText("150.000,50 ₫ – 175.000,00 ₫");
  await expect(page.getByRole("article").nth(1).getByText("150.000,50 ₫", { exact: true })).toBeVisible();
  await expect(page.getByRole("article").nth(1)).not.toContainText("–");
  await expect(
    page.getByRole("heading", { name: "Discover Nexus", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Newest products", exact: true }),
  ).toHaveCount(0);
  await mobileChecks(page);
  await page.screenshot({
    path: info.outputPath("category-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await layoutChecks(page);
  await page.screenshot({
    path: info.outputPath("category-desktop.png"),
    fullPage: true,
  });
});

test("paging survives refresh, back and forward, and preserves other query params", async ({
  page,
}) => {
  await page.goto("/categories/headphones?source=shared");
  await expect(page.getByRole("article")).toHaveCount(12);
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/source=shared&page=2$/);
  await expect(page.getByRole("article").first()).toContainText("Product 112");
  await page.reload();
  await expect(page.getByRole("article").first()).toContainText("Product 112");
  await expect(page.getByText("Page 2 of 3")).toBeVisible();
  await mobileChecks(page);
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.goBack();
  await expect(page.getByRole("article").first()).toContainText("Product 112");
  await page.goForward();
  await expect(page.getByRole("article")).toHaveCount(1);
});

test("empty category, unknown slug and page outside range", async ({
  page,
}) => {
  await page.goto("/categories/home");
  await expect(page.getByText("No products found")).toBeVisible();
  const unknownCategory = await page.goto("/categories/does-not-exist");
  expect(unknownCategory?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Category not found" }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.goto("/categories/electronics?page=999");
  await expect(page.getByText("No products on this page")).toBeVisible();
  await page.getByRole("link", { name: "Go to first page" }).click();
  await expect(page.getByRole("article")).toHaveCount(2);
  await page.goto("/categories/electronics?page=-5");
  await expect(page.getByRole("article")).toHaveCount(2);
});

test("home category failure displays the error and retry restores the category tree", async ({
  page,
}) => {
  let failed = true;
  await page.route("**/api/v1/categories/tree", (route) =>
    failed
      ? route.fulfill({
          status: 503,
          json: { title: "Unavailable", status: 503 },
        })
      : route.continue(),
  );
  await page.goto("/");
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page.getByText("Unable to load categories.")).toBeVisible();
  await mobileChecks(page);
  failed = false;
  await page.getByRole("button", { name: "Retry categories" }).click();
  await expect(
    page
      .locator("#categories")
      .getByRole("link", { name: "Electronics", exact: true }),
  ).toBeVisible();
});

test("product loading and failure are independent and retry recovers", async ({
  page,
}) => {
  let failed = true;
  await page.route("**/api/v1/products?*", async (route) => {
    if (!failed) return route.continue();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({
      status: 503,
      json: { title: "Unavailable", status: 503 },
    });
  });
  await page.goto("/search");
  await expect(
    page.getByRole("status", { name: "Loading products" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("complementary", { name: "Filters" })
      .getByRole("link", { name: "Electronics", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Unable to load products")).toBeVisible();
  await mobileChecks(page);
  failed = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("article")).toHaveCount(5);
});

test("category API failure renders error instead of not-found and can recover", async ({
  page,
  request,
}) => {
  await request.get(`${fixtureOrigin}/test/tree-failure?enabled=true`);
  try {
    await page.goto("/categories/electronics");
    await expect(
      page.getByRole("heading", { name: "Unable to load this category" }),
    ).toBeVisible();
    await expect(page.getByText("Category not found")).toHaveCount(0);
  } finally {
    await request.get(`${fixtureOrigin}/test/tree-failure?enabled=false`);
  }
  await page.getByRole("button", { name: "Retry category" }).click();
  await expect(page.getByRole("article")).toHaveCount(2);
});

test("malformed successful API response renders an error", async ({ page }) => {
  await page.route("**/api/v1/products?*", (route) =>
    route.fulfill({
      json: {
        code: 0,
        message: "response success",
        data: [{ unexpected: true }],
        page: { number: 0, size: 12, totalElements: 1, totalPages: 1 },
      },
    }),
  );
  await page.goto("/search");
  await expect(page.getByText("Unable to load products")).toBeVisible();
});

test("search filters preserve query parameters and Clear All restores the default URL", async ({
  page,
}) => {
  await page.goto("/search?q=headphones");
  await expect(
    page.getByRole("heading", { name: "Results for “headphones”" }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(5);
  await page
    .getByRole("combobox", { name: "Category filter" })
    .selectOption("headphones");
  await expect(page).toHaveURL(/q=headphones&category=headphones$/);
  await expect(page.getByRole("article")).toHaveCount(12);
  await page
    .getByRole("combobox", { name: "Sort by" })
    .selectOption("price,asc");
  await expect(page).toHaveURL(
    /q=headphones&category=headphones&sort=price%2Casc$/,
  );
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(
    /q=headphones&category=headphones&sort=price%2Casc&page=2$/,
  );
  await expect(page.getByRole("article").first()).toContainText("Product 112");
  await page.getByRole("link", { name: "Clear All", exact: true }).click();
  await expect(page).toHaveURL(/\/search$/);
  await expect(
    page.getByRole("heading", { name: "Browse products" }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(5);
});

test("header category selection reaches the product API and All Categories clears it", async ({
  page,
}) => {
  await page.goto("/");
  const categoryPicker = page.getByRole("combobox", { name: "Search category" });
  await categoryPicker.click();
  await page.getByRole("option", { name: "Headphones", exact: true }).click();
  await page.getByRole("textbox", { name: "Search for anything" }).fill("wireless & wired");
  const categoryRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/api/v1/products" && url.searchParams.get("categoryId") === "headphones";
  });
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await categoryRequest;
  await expect(page).toHaveURL(/\/search\?q=wireless\+%26\+wired&category=headphones$/);
  await expect(page.getByRole("article")).toHaveCount(12);
  await page.reload();
  await expect(categoryPicker).toContainText("Headphones");

  await categoryPicker.click();
  await page.getByRole("option", { name: "All Categories", exact: true }).click();
  await page.getByRole("textbox", { name: "Search for anything" }).fill("");
  const allProductsRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/api/v1/products" && !url.searchParams.has("categoryId");
  });
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await allProductsRequest;
  await expect(page).toHaveURL(/\/search$/);
  await expect(page.getByRole("article")).toHaveCount(5);
  await expect(categoryPicker).toContainText("All Categories");
});
