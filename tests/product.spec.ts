import { expect, test, type Page, type Route } from "@playwright/test";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const envelope = (data: unknown) => ({
  code: 0,
  message: "response success",
  data,
});
const fulfillJson = (route: Route, data: unknown, status = 200) =>
  route.fulfill({
    status,
    headers: corsHeaders,
    json: data,
  });

const image = (color: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="${color}"/></svg>`,
  )}`;

const product = {
  id: "1",
  name: "Browser product",
  slug: "product-1",
  categoryId: "electronics",
  sellerId: "seller-1",
  status: "ACTIVE",
  minPrice: 150000,
  description: "Product supplied by the delivered API contract.",
  auctionEnable: false,
  skus: [
    {
      id: "sku-red",
      productId: "1",
      skuCode: "RED-M",
      color: "Red",
      size: "M",
      price: 150000,
      status: "ACTIVE",
    },
    {
      id: "sku-blue",
      productId: "1",
      skuCode: "BLUE-L",
      color: "Blue",
      size: "L",
      price: 175000.5,
      status: "ACTIVE",
    },
  ],
  images: [
    { id: "image-red", imageUrl: image("red"), sortOrder: 0 },
    { id: "image-blue", imageUrl: image("blue"), sortOrder: 1 },
  ],
};

const installProduct = async (page: Page) => {
  await page.route("**/api/v1/products/1", (route) =>
    fulfillJson(route, envelope(product)),
  );
};

const installAuth = async (page: Page) => {
  const account = { id: "buyer-1", name: "First Buyer" };
  await page.route("**/api/v1/auth/login", (route) => {
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: corsHeaders });
    expect(route.request().headers().authorization).toBeUndefined();
    return fulfillJson(
      route,
      envelope({
        accessToken: `browser-token-${account.id}`,
        expiresIn: 3600,
        tokenType: "Bearer",
      }),
    );
  });
  await page.route("**/api/v1/users/me", (route) => {
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: corsHeaders });
    expect(route.request().headers().authorization).toBe(
      `Bearer browser-token-${account.id}`,
    );
    return fulfillJson(
      route,
      envelope({
        id: account.id,
        email: `${account.id}@example.test`,
        phone: "0901234567",
        fullName: account.name,
        gender: null,
        address: null,
        dateOfBirth: null,
        roles: ["BUYER"],
        status: "ACTIVE",
        createdAt: "2026-10-30T00:00:00Z",
      }),
    );
  });
  return account;
};

const signIn = async (page: Page, name: string) => {
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("buyer@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Password1!");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(`Hi ${name}`, { exact: true })).toBeVisible();
};

const openProductFromHome = async (page: Page) => {
  await page
    .locator("#categories")
    .getByRole("link", { name: "Electronics", exact: true })
    .click();
  await page
    .getByRole("article")
    .filter({ hasText: "Product 1" })
    .getByRole("link")
    .click();
  await expect(
    page.getByRole("heading", { name: "Browser product", exact: true }),
  ).toBeVisible();
};

test("product SKU, price, quantity and keyboard gallery work before anonymous cart prompts sign-in", async ({
  page,
}) => {
  await installProduct(page);
  const cartRequests: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/v1/carts/me/items"
    )
      cartRequests.push(request.url());
  });
  await page.goto("/products/product-1?id=1");
  await expect(
    page.getByRole("heading", { name: "Browser product", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("150.000,00 ₫", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Blue / L", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Blue / L", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("175.000,50 ₫", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Increase quantity" }).click();
  await expect(page.getByRole("spinbutton", { name: "Quantity" })).toHaveValue(
    "2",
  );
  await page
    .getByRole("region", { name: "Browser product image gallery" })
    .press("ArrowRight");
  await expect(
    page.getByRole("img", { name: "Browser product view 2 of 2", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add to Cart", exact: true }).click();
  await expect(
    page.getByText("Please sign in before adding items.", { exact: false }),
  ).toBeVisible();
  expect(cartRequests).toEqual([]);
});

test("authenticated cart sends selected SKU and quantity, then displays typed backend errors", async ({
  page,
}) => {
  await installProduct(page);
  await installAuth(page);
  const calls: Array<{ payload: unknown; token: string | undefined }> = [];
  let rejected = false;
  await page.route("**/api/v1/carts/me/items", (route) => {
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: corsHeaders });
    calls.push({
      payload: route.request().postDataJSON(),
      token: route.request().headers().authorization,
    });
    return rejected
      ? fulfillJson(
          route,
          {
            title: "Conflict",
            status: 409,
            code: "COMMERCE_STOCK_UNAVAILABLE",
            detail: "This SKU is no longer available.",
          },
          409,
        )
      : fulfillJson(
          route,
          envelope({
            id: "cart-1",
            userId: "buyer-1",
            status: "ACTIVE",
            items: [],
          }),
          201,
        );
  });
  await page.goto("/sign-in");
  await signIn(page, "First Buyer");
  await openProductFromHome(page);
  await page.getByRole("button", { name: "Blue / L", exact: true }).click();
  await page.getByRole("spinbutton", { name: "Quantity" }).fill("3");
  await page.getByRole("button", { name: "Add to Cart", exact: true }).click();
  await expect(page.getByText("Added to cart.", { exact: true })).toBeVisible();
  expect(calls).toEqual([
    {
      payload: { skuId: "sku-blue", quantity: 3 },
      token: "Bearer browser-token-buyer-1",
    },
  ]);
  rejected = true;
  await page.getByRole("button", { name: "Add to Cart", exact: true }).click();
  await expect(
    page.getByText("This SKU is no longer available.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Added to cart.", { exact: true })).toHaveCount(
    0,
  );
  expect(calls).toHaveLength(2);
});

test("logout during a pending cart request keeps the next account free of stale success", async ({
  page,
}) => {
  await installProduct(page);
  const account = await installAuth(page);
  let release: () => void = () => {};
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  await page.route("**/api/v1/carts/me/items", async (route) => {
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: corsHeaders });
    calls += 1;
    if (calls === 1) await delayed;
    await fulfillJson(
      route,
      envelope({
        id: "cart-1",
        userId: account.id,
        status: "ACTIVE",
        items: [],
      }),
      201,
    ).catch(() => {}); // The browser may already have canceled the old session's request.
  });
  try {
    await page.goto("/sign-in");
    await signIn(page, account.name);
    await openProductFromHome(page);
    const pending = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/api/v1/carts/me/items",
    );
    await page
      .getByRole("button", { name: "Add to Cart", exact: true })
      .click();
    await pending;
    await expect(
      page.getByRole("button", { name: "Adding…", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    account.id = "buyer-2";
    account.name = "Second Buyer";
    await signIn(page, account.name);
    release();
    await openProductFromHome(page);
    await expect(page.getByText("Added to cart.", { exact: true })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: "Add to Cart", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Add to Cart", exact: true })
      .click();
    await expect(
      page.getByText("Added to cart.", { exact: true }),
    ).toBeVisible();
    expect(calls).toBe(2);
  } finally {
    release();
  }
});
