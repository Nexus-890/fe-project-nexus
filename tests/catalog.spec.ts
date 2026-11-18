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

test("home renders live catalog and auctions with responsive campaign and voucher controls", async ({
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
  await expect(tree.getByRole("link")).toHaveCount(3);
  await expect(tree.getByRole("link", { name: "Electronics", exact: true })).toBeVisible();
  await expect(tree.getByRole("link", { name: "Audio", exact: true })).toHaveCount(0);
  await expect(tree.getByRole("link", { name: "Headphones", exact: true })).toHaveCount(0);
  await expect(page.getByRole("article")).toHaveCount(11);
  await expect(page.getByRole("heading", { name: "FLASH SALE", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Today's picks", exact: true })).toBeVisible();
  await expect(page.getByText("250.000,00 ₫", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next campaign", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Upgrade time.", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Previous campaign", exact: true }).click();
  await page.getByRole("button", { name: "Save NEXUS50 sample voucher", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove NEXUS50 sample voucher", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(
    apiRequests.every(
      (url) => ["/api/v1/categories/tree", "/api/v1/products/search", "/api/v1/auctions"].includes(new URL(url).pathname),
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
  await expect(page.getByRole("article")).toHaveCount(11);
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
  await expect(page.getByRole("article")).toHaveCount(11);
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

test("cards align short, long and unavailable-price products while home categories show only roots", async ({ page }) => {
  const imageUrl = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="silver"/></svg>')}`;
  await page.route("**/api/v1/products/search?*", (route) => route.fulfill({ json: {
    code: 0, message: "response success",
    data: [
      { id: "aligned-1", slug: "short-title", name: "Short title", minPrice: 150000, images: [{ id: "photo-1", imageUrl, sortOrder: 0 }] },
      { id: "aligned-2", slug: "long-title", name: "A much longer product title with enough words to exceed the reserved two-line heading area on a narrow product card", minPrice: 15990000, images: [{ id: "photo-2", imageUrl, sortOrder: 0 }] },
      { id: "aligned-3", slug: "no-price", name: "Product without a price or image", minPrice: null, images: [] },
    ],
    page: { number: 0, size: 10, totalElements: 3, totalPages: 1 },
  } }));

  async function equalCardSizes(cards: ReturnType<Page["getByRole"]>) {
    await expect(cards).toHaveCount(3);
    const dimensions = await cards.evaluateAll((elements) => elements.map((element) => {
      const bounds = element.getBoundingClientRect();
      return { width: Math.round(bounds.width), height: Math.round(bounds.height) };
    }));
    expect(new Set(dimensions.map(({ width }) => width)).size).toBe(1);
    expect(new Set(dimensions.map(({ height }) => height)).size).toBe(1);
    await expect(cards.filter({ hasText: "Price unavailable" })).toHaveCount(1);
  }

  for (const viewport of [{ width: 375, height: 812 }, { width: 1440, height: 1000 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator("#categories").getByRole("link")).toHaveCount(3);
    await expect(page.locator("#categories").getByRole("link", { name: "Headphones", exact: true })).toHaveCount(0);
    await equalCardSizes(page.locator("#deals").getByRole("article"));
    await equalCardSizes(page.locator("#today-picks").getByRole("article"));
    await layoutChecks(page);

    await page.goto("/search");
    await expect(page.getByRole("complementary", { name: "Filters" }).getByRole("link", { name: "Headphones", exact: true })).toBeVisible();
    await equalCardSizes(page.getByRole("region", { name: "Search results" }).getByRole("article"));
    await layoutChecks(page);
  }
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
  await expect(page.getByRole("article")).toHaveCount(11);
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
  await page.route("**/api/v1/products/search?*", async (route) => {
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
  await page.route("**/api/v1/products/search?*", (route) =>
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
  await page.goto("/search?q=Product");
  await expect(
    page.getByRole("heading", { name: "Results for “Product”" }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(5);
  await page
    .getByRole("combobox", { name: "Category filter" })
    .selectOption("headphones");
  await expect(page).toHaveURL(/q=Product&category=headphones$/);
  await expect(page.getByRole("article")).toHaveCount(12);
  await page
    .getByRole("combobox", { name: "Sort by" })
    .selectOption("price,asc");
  await expect(page).toHaveURL(
    /q=Product&category=headphones&sort=price%2Casc$/,
  );
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(
    /q=Product&category=headphones&sort=price%2Casc&page=2$/,
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
  await page.getByRole("textbox", { name: "Search for anything" }).fill("Product 1");
  const categoryRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/api/v1/products/search" && url.searchParams.get("categoryId") === "headphones";
  });
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await categoryRequest;
  await expect(page).toHaveURL(/\/search\?q=Product\+1&category=headphones$/);
  await expect(page.getByRole("article")).toHaveCount(12);
  await page.reload();
  await expect(categoryPicker).toContainText("Headphones");

  await categoryPicker.click();
  await page.getByRole("option", { name: "All Categories", exact: true }).click();
  await page.getByRole("textbox", { name: "Search for anything" }).fill("");
  const allProductsRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/api/v1/products/search" && !url.searchParams.has("categoryId");
  });
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await allProductsRequest;
  await expect(page).toHaveURL(/\/search$/);
  await expect(page.getByRole("article")).toHaveCount(5);
  await expect(categoryPicker).toContainText("All Categories");
});

test("search filters survive reload, paging, category changes and header searches", async ({ page }, info) => {
  await page.goto("/search?q=Product&category=headphones&sort=price%2Casc&page=2");
  await expect(page.getByRole("article")).toHaveCount(12);
  await page.getByRole("button", { name: "More filters", exact: true }).click();
  await page.getByRole("radio", { name: "Auction", exact: true }).click();
  await expect(page).toHaveURL(/listingType=auction/);
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
  await expect(page.getByRole("checkbox", { name: "Trusted", exact: true })).toBeDisabled();
  await expect(page.getByRole("group", { name: "Condition", exact: true }).getByRole("checkbox", { name: "New", exact: true })).toBeDisabled();
  await expect(page.getByRole("radio", { name: "4 stars and up", exact: true })).toBeDisabled();
  const price = page.locator("#catalog-max-price");
  await price.focus();
  await price.press("ArrowLeft");
  await expect(page).toHaveURL(/maxPrice=49900000/);

  const expectPreservedFilters = async () => {
    await expect.poll(() => {
      const params = new URL(page.url()).searchParams;
      return [params.get("sort"), params.get("listingType"), params.getAll("trust"), params.getAll("condition"), params.get("maxPrice"), params.get("minRating")];
    }).toEqual(["price,asc", "auction", [], [], "49900000", null]);
  };
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/page=2$/);
  await expectPreservedFilters();
  await page.reload();
  await expect(page.getByRole("article")).toHaveCount(12);
  await page.getByRole("button", { name: "More filters", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Auction", exact: true })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("checkbox", { name: "Trusted", exact: true })).toBeDisabled();
  await expect(price).toHaveValue("49900000");
  await expectPreservedFilters();
  await mobileChecks(page);
  await page.screenshot({ path: info.outputPath("search-filters-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await layoutChecks(page);
  await page.screenshot({ path: info.outputPath("search-filters-desktop.png"), fullPage: true });

  await page.getByRole("complementary", { name: "Filters" }).getByRole("link", { name: "Electronics", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("category")).toBe("electronics");
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
  await expectPreservedFilters();
  const search = page.getByRole("textbox", { name: "Search for anything" });
  await search.fill("camera & lens");
  await search.press("Enter");
  await expect(page.getByRole("heading", { name: "Results for “camera & lens”", exact: true })).toBeVisible();
  await expectPreservedFilters();
  await page.goBack();
  await expect(search).toHaveValue("Product");
  await expectPreservedFilters();
  await page.getByRole("link", { name: "Remove filter Listing Type: Auction", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.getAll("trust")).toEqual([]);
  expect(new URL(page.url()).searchParams.get("condition")).toBeNull();
  await page.getByRole("link", { name: "Clear All", exact: true }).click();
  await expect(page).toHaveURL(/\/search$/);
  await expect(page.getByRole("combobox", { name: "Sort by" })).toHaveValue("relevance");
});

test("an empty search response shows a helpful empty state without an error", async ({ page }) => {
  await page.goto("/search?q=missing+item");
  await expect(page.getByRole("heading", { name: "No products found", exact: true })).toBeVisible();
  await expect(page.getByText("Try another category or change your filters.", { exact: true })).toBeVisible();
  await expect(page.getByText("0 results", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Search results" }).getByRole("alert")).toHaveCount(0);
});

test("title search and price/listing filters change the returned products and unsupported filters are disabled", async ({ page }) => {
  await page.goto("/search?q=Product+3&trust=trusted&condition=new&minRating=4");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article")).toContainText("Product 3");
  await expect.poll(() => new URL(page.url()).searchParams.has("trust")).toBe(false);
  await page.getByRole("button", { name: "More filters", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Trusted", exact: true })).toBeDisabled();
  await page.getByRole("radio", { name: "Auction", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No products found", exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "Buy Now", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  const price = page.locator("#catalog-max-price");
  await price.focus();
  await price.press("Home");
  await expect(page.getByRole("heading", { name: "No products found", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Clear All", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(5);
});

test("product hearts share the visit watchlist across shop navigation", async ({ page }) => {
  await page.goto("/search");
  await page.getByRole("button", { name: "Save Product 1 to watchlist", exact: true }).click();
  await page.getByRole("link", { name: "Saved", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Saved items", exact: true })).toBeVisible();
  await expect(page.getByRole("article", { name: "Product 1", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Remove Product 1 from watchlist", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page.getByText("A little inspiration to start?", { exact: true })).toBeVisible();
});
