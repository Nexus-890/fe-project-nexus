import { expect, test, type Page, type Route } from "@playwright/test";

const appOrigin = process.env.NEXUS_OIDC_APP_ORIGIN || `http://127.0.0.1:${process.env.NEXUS_TEST_APP_PORT || "3102"}`;
const providerOrigin = `http://127.0.0.1:${process.env.NEXUS_TEST_PROVIDER_PORT || process.env.NEXUS_OIDC_SIM_PORT || "3913"}/keycloak`;

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
  maxPrice: 175000.5,
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
  const account = {
    id: "buyer-1",
    name: "First Buyer",
    authorization: "",
  };
  const issuedTokens = new Set<string>();
  page.on("response", async (response) => {
    // The gateway exchanges the code; the browser receives the access token in its envelope.
    // 204 is an anonymous refresh with no body.
    if (["/api/v1/auth/session", "/api/v1/auth/refresh"].includes(new URL(response.url()).pathname) && response.status() === 200) {
      const body = await response.json();
      issuedTokens.add(body.data.accessToken);
    }
  });
  await page.route("**/api/v1/users/me", async (route) => {
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: corsHeaders });
    const authorization = route.request().headers().authorization;
    expect(authorization).toMatch(/^Bearer .+$/);
    await expect.poll(() => issuedTokens.has(authorization.slice("Bearer ".length))).toBe(true);
    account.authorization = authorization;
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
  // Complete this harness's authenticated header without the separate inbox
  // fixture rejecting its token and triggering an unrelated session renewal.
  await page.route("**/api/v1/notifications**", (route) => {
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: corsHeaders });
    expect(route.request().method()).toBe("GET");
    expect(account.authorization).toMatch(/^Bearer .+$/);
    expect(route.request().headers().authorization).toBe(account.authorization);
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/notifications/unread-count")
      return fulfillJson(route, envelope({ count: 0 }));
    expect(path).toBe("/api/v1/notifications");
    return fulfillJson(route, {
      ...envelope([]),
      page: { number: 0, size: 10, totalElements: 0, totalPages: 0 },
    });
  });
  // The authenticated header reads the cart independently of the add-item flow.
  await page.route("**/api/v1/carts/me", (route) => {
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: corsHeaders });
    expect(route.request().method()).toBe("GET");
    expect(account.authorization).toMatch(/^Bearer .+$/);
    expect(route.request().headers().authorization).toBe(account.authorization);
    return fulfillJson(route, envelope({
      id: `header-cart-${account.id}`,
      userId: account.id,
      status: "ACTIVE",
      items: [],
    }));
  });
  return account;
};

const signIn = async (page: Page, name: string) => {
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/keycloak\/realms\/nexus\/protocol\/openid-connect\/auth\?/);
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("buyer@nexus.local");
  await page.getByLabel("Password", { exact: true }).fill("Fixture-pass-123!");
  await page.getByRole("button", { name: "Sign in at Keycloak", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(`Hi ${name}`, { exact: true })).toBeVisible();
};

const openProductFromHome = async (page: Page) => {
  await page
    .locator("#categories")
    .getByRole("link", { name: "Electronics", exact: true })
    .click();
  await expect(page).toHaveURL(/\/categories\/electronics$/);
  await page
    .getByRole("article")
    .filter({ hasText: "Product 1" })
    .getByRole("link")
    .click();
  await expect(
    page.getByRole("heading", { name: "Browser product", exact: true }),
  ).toBeVisible();
};

test("detail information tabs use keyboard navigation and expose sample reviews without changing price", async ({ page }, info) => {
  await installProduct(page);
  await page.goto("/products/product-1?id=1");
  const reviewTab = page.getByRole("tab", { name: "Reviews 126", exact: true });
  await expect(reviewTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Sample reviews · preview content, not customer purchase feedback.")).toBeVisible();
  await page.screenshot({ path: info.outputPath("product-detail-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: info.outputPath("product-detail-desktop.png"), fullPage: true });
  await page.getByRole("tab", { name: "Description", exact: true }).click();
  await expect(page.getByText(product.description, { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Description", exact: true }).press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Specifications", exact: true })).toBeFocused();
  await expect(page.getByRole("heading", { name: "Product specifications", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Specifications", exact: true }).press("End");
  await expect(page.getByRole("heading", { name: "Shipping & Returns", exact: true })).toBeVisible();
  await expect(page.getByText("150.000,00 ₫", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test.beforeEach(async ({ request }) => {
  expect((await request.get(`${providerOrigin}/test/reset`)).ok()).toBe(true);
});

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
  await expect(page.getByTestId("product-price-range")).toHaveText("150.000,00 ₫ – 175.000,50 ₫");
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
  const account = await installAuth(page);
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
      token: account.authorization,
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
  expect(calls[1]?.token).toBe(account.authorization);
});

test("navigation during a member add cannot replace its result with an older cart read", async ({ page }) => {
  await installProduct(page);
  const account = await installAuth(page);
  let releaseAdd = () => {};
  let releaseRead = () => {};
  const pendingAdd = new Promise<void>((resolve) => { releaseAdd = resolve; });
  const pendingRead = new Promise<void>((resolve) => { releaseRead = resolve; });
  let adding = false;
  let reads = 0;
  let finishedReads = 0;
  let adds = 0;
  const cart = {
    id: "member-cart", userId: account.id, status: "ACTIVE",
    items: [{ id: "member-line", productId: "1", skuId: "sku-red", quantity: 1, unitPrice: 150000 }],
  };
  await page.route("**/api/v1/carts/me", async (route) => {
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: corsHeaders });
    reads += 1;
    const snapshot = structuredClone(cart);
    try {
      if (adding) await pendingRead;
      await fulfillJson(route, envelope(snapshot));
    } catch {
      // A successful add cancels any older in-flight cart read.
    } finally {
      finishedReads += 1;
    }
  });
  await page.route("**/api/v1/carts/me/items", async (route) => {
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: corsHeaders });
    adds += 1;
    await pendingAdd;
    cart.items[0].quantity += 1;
    await fulfillJson(route, envelope(cart), 201);
  });
  try {
    await page.goto("/sign-in");
    await signIn(page, account.name);
    await openProductFromHome(page);
    await page.clock.install();
    // Make the existing snapshot stale so mounting CartPage would refetch it.
    await page.clock.fastForward(31_000);
    const readsBeforeAdd = reads;
    adding = true;
    await page.getByRole("button", { name: "Add to Cart", exact: true }).click();
    await expect.poll(() => adds).toBe(1);
    await page.getByRole("link", { name: /^Shopping cart/ }).click();
    const line = page.getByTestId("cart-line-member-line");
    await expect(line.getByRole("button", { name: /Increase quantity/ })).toBeDisabled();
    await page.clock.runFor(100);
    expect(reads).toBe(readsBeforeAdd);
    releaseAdd();
    await expect(line.getByRole("spinbutton")).toHaveValue("2");
    await expect(line.getByRole("button", { name: /Increase quantity/ })).toBeEnabled();
    adding = false;
    releaseRead();
    await expect.poll(() => finishedReads).toBe(reads);
    await expect(line.getByRole("spinbutton")).toHaveValue("2");
    await expect(page.getByRole("link", { name: /^Shopping cart/ })).toHaveAccessibleName("Shopping cart, 1 item");
  } finally {
    releaseAdd();
    releaseRead();
  }
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
  const authorizations: Array<string | undefined> = [];
  await page.route("**/api/v1/carts/me/items", async (route) => {
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: corsHeaders });
    calls += 1;
    authorizations.push(route.request().headers().authorization);
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
    const firstAuthorization = account.authorization;
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
    await expect(page).toHaveURL((url) => url.origin === appOrigin && url.pathname === "/");
    await page.waitForLoadState("load");
    await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/sign-in" && url.searchParams.get("returnTo") === "/");
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
    expect(authorizations).toEqual([firstAuthorization, account.authorization]);
  } finally {
    release();
  }
});
