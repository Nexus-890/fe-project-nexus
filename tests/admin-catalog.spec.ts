import { expect, test, type Page, type APIRequestContext } from "@playwright/test";

test.skip(!process.env.NEXUS_ADMIN_CATALOG_TEST, "Run with playwright.admin-catalog.config.ts against the explicit HTTP simulation.");
const api = `http://127.0.0.1:${process.env.NEXUS_BACKOFFICE_API_PORT || "3920"}`;
const id = (n: number) => `a2280000-0000-4000-8000-${String(n).padStart(12, "0")}`;
async function signIn(page: Page, request: APIRequestContext, destination: string, role = "ADMIN") {
  await request.get(`${api}/keycloak/test/control`, { params: { roles: role } });
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(destination)}`);
  await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(`${role.toLowerCase()}@nexus.local`);
  await page.getByLabel("Password", { exact: true }).fill("Fixture-pass-123!");
  await page.getByRole("button", { name: "Sign in at Keycloak", exact: true }).click();
}
async function screenshot(page: Page, name: string) {
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
    await page.screenshot({ path: `test-results/admin-catalog/${name}-${width}.png`, fullPage: true, style: "nextjs-portal { visibility: hidden !important; }" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
}
test.beforeEach(async ({ request }) => {
  await request.get(`${api}/keycloak/test/reset`);
  await request.post(`${api}/api/test/reset`);
  await request.post(`${api}/api/test/catalog-admin/reset`);
});

test("category create, description round trip, move to root, and bodyless delete", async ({ page, request }) => {
  await signIn(page, request, "/backoffice/categories");
  await page.getByRole("button", { name: "New category", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Speakers");
  await page.getByLabel("Slug", { exact: true }).fill("speakers");
  await page.getByLabel("Description", { exact: true }).fill("Wireless speakers");
  await page.getByLabel("Parent category", { exact: true }).selectOption(id(2));
  await page.getByRole("button", { name: "Save category", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Edit category", exact: true })).toBeVisible();
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue("Wireless speakers");
  await page.getByLabel("Parent category", { exact: true }).selectOption("");
  await page.getByRole("button", { name: "Save category", exact: true }).click();
  await expect(page.getByText("Category saved.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Books", exact: true }).click();
  await page.getByRole("button", { name: "Speakers", exact: true }).click();
  await expect(page.getByLabel("Parent category", { exact: true })).toHaveValue("");
  await screenshot(page, "categories");
  await page.getByRole("button", { name: "Delete category", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete", exact: true }).click();
  await expect(page.getByRole("button", { name: "Speakers", exact: true })).toHaveCount(0);
});

test("category conflicts and invalid move are visible backend messages", async ({ page, request }) => {
  await signIn(page, request, "/backoffice/categories");
  await page.getByRole("button", { name: "Electronics", exact: true }).click();
  await expect(page.getByLabel("Parent category", { exact: true }).getByRole("option", { name: /Headphones/ })).toHaveCount(0);
  await page.getByLabel("Parent category", { exact: true }).selectOption(id(4));
  await page.getByRole("button", { name: "Save category", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Category tree exceeds maximum depth");
  await page.getByRole("button", { name: "Delete category", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete", exact: true }).click();
  await expect(page.getByText("Category has children", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Books", exact: true }).click();
  await page.getByRole("button", { name: "Delete category", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete", exact: true }).click();
  await expect(page.getByText("Category has products", { exact: true })).toBeVisible();
});

test("warehouse create, edit and status filtering", async ({ page, request }) => {
  await signIn(page, request, "/backoffice/warehouses");
  await page.getByRole("button", { name: "New warehouse", exact: true }).click();
  await page.getByLabel("Warehouse code", { exact: true }).fill("WH_DN");
  await page.getByLabel("Warehouse name", { exact: true }).fill("Da Nang warehouse");
  await page.getByLabel("Address", { exact: true }).fill("12 Tran Phu");
  await page.getByRole("button", { name: "Save warehouse", exact: true }).click();
  await page.getByRole("button", { name: "Edit Da Nang warehouse", exact: true }).click();
  await expect(page.getByLabel("Warehouse code", { exact: true })).toBeDisabled();
  await page.getByLabel("Status", { exact: true }).selectOption("MAINTENANCE");
  await page.getByRole("button", { name: "Save warehouse", exact: true }).click();
  await page.getByLabel("Filter warehouse status").selectOption("MAINTENANCE");
  await expect(page.getByRole("table").getByText("Da Nang warehouse", { exact: true })).toBeVisible();
  await expect(page.getByRole("table").getByText("Ho Chi Minh warehouse", { exact: true })).toHaveCount(0);
  await screenshot(page, "warehouses");
});

test("SKU intake refreshes balances and ledger, paginates and rejects inactive warehouse intake", async ({ page, request }) => {
  await signIn(page, request, "/backoffice/stock");
  await page.getByLabel("Product", { exact: true }).selectOption(id(30));
  await page.getByLabel("SKU", { exact: true }).selectOption(id(31));
  await page.getByLabel("Warehouse", { exact: true }).selectOption(id(20));
  await page.getByLabel("Quantity", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Add stock", exact: true }).click();
  await expect(page.getByText("Stock received.", { exact: true })).toBeVisible();
  await expect(page.getByText("Damaged packaging", { exact: true })).toBeVisible();
  await expect(page.getByRole("table").getByText("5", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Previous page", exact: true }).click();
  await screenshot(page, "stock");
  await page.getByLabel("Warehouse", { exact: true }).selectOption(id(21));
  await expect(page.getByRole("button", { name: "Add stock", exact: true })).toBeDisabled();
  const body = await (await request.get(`${api}/api/test/catalog-admin/evidence`)).json();
  expect(body.data.balance.available).toBe(13);
  expect(body.data.requests.some((row: { path: string }) => row.path.includes("adjustments"))).toBe(false);
});

test("configuration proposal shows keys, saves values, and preserves backend wrong-type 400", async ({ page, request }) => {
  await signIn(page, request, "/backoffice/configuration");
  const input = page.getByLabel("Value for AUCTION_MIN_DURATION_HOURS", { exact: true });
  await input.fill("wrong-type");
  await input.locator("xpath=ancestor::form").getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Configuration value has the wrong type");
  await expect(input).toHaveValue("wrong-type");
  await input.fill("2");
  await input.locator("xpath=ancestor::form").getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Configuration saved.", { exact: true })).toBeVisible();
  await screenshot(page, "configuration");
  await page.reload();
  await expect(input).toHaveValue("2");
});

test("configuration unavailable has retry and no invented values", async ({ page, request }) => {
  await request.post(`${api}/api/test/catalog-admin/control`, { data: { unavailable: true } });
  await signIn(page, request, "/backoffice/configuration");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("System configuration is currently unavailable");
  await expect(page.getByRole("table")).toHaveCount(0);
  await request.post(`${api}/api/test/catalog-admin/control`, { data: { unavailable: false } });
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByLabel("Value for AUCTION_MIN_DURATION_HOURS", { exact: true })).toHaveValue("1");
});

for (const role of ["SELLER", "SUPPORT_STAFF"]) {
  test(`${role} cannot mount admin category, warehouse or config features`, async ({ page, request }) => {
    await signIn(page, request, "/backoffice", role);
    await expect(page).toHaveURL("/backoffice");
    for (const section of ["categories", "warehouses", "configuration"]) {
      await page.goto(`/backoffice/${section}`);
      await expect(page.getByRole("heading", { name: "Access denied", exact: true })).toBeVisible();
    }
    const body = await (await request.get(`${api}/api/test/catalog-admin/evidence`)).json();
    expect(body.data.requests).toHaveLength(0);
  });
}
