import { expect, test, type Page, type Route, type TestInfo } from "@playwright/test";

const appOrigin = process.env.NEXUS_OIDC_APP_ORIGIN || `http://127.0.0.1:${process.env.NEXUS_TEST_APP_PORT || "3102"}`;
const providerOrigin = `http://127.0.0.1:${process.env.NEXUS_TEST_PROVIDER_PORT || process.env.NEXUS_OIDC_SIM_PORT || "3913"}/keycloak`;

// These expected update/remove responses are explicit browser stand-ins. They
// do not establish live compatibility with #111's current auth/envelope code.
const cartPath = "/api/v1/carts/me";
const lineId = "10000000-0000-4000-8000-000000000001";
const productId = "20000000-0000-4000-8000-000000000001";
const skuId = "30000000-0000-4000-8000-000000000001";
const productName = "Studio headphones in silver";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};
type FixtureCart = {
  id: string;
  userId: string;
  status: "ACTIVE";
  items: Array<{
    id: string;
    productId: string;
    skuId: string;
    quantity: number;
    unitPrice: number;
  }>;
};
const envelope = (data: unknown) => ({ code: 0, message: "response success", data });
const json = (route: Route, data: unknown, status = 200) =>
  route.fulfill({ status, headers: corsHeaders, json: data });
const deferred = () => {
  let resolve = () => {};
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
};

async function installCart(page: Page, title = productName) {
  const cart: FixtureCart = {
    id: "40000000-0000-4000-8000-000000000001",
    userId: "buyer-1",
    status: "ACTIVE",
    items: [{ id: lineId, productId, skuId, quantity: 2, unitPrice: 150000 }],
  };
  const state = {
    account: { id: "buyer-1", name: "First Buyer", authorization: "" },
    carts: new Map<string, FixtureCart>([["buyer-1", cart]]),
    reads: [] as string[],
    writes: [] as Array<{ method: string; path: string; body: unknown; token: string | undefined }>,
    failedReads: false,
    rejectedUpdate: false,
    rejectedDelete: false,
    readGate: undefined as Promise<void> | undefined,
    updateGate: undefined as Promise<void> | undefined,
    deleteGate: undefined as Promise<void> | undefined,
    updateFinished: deferred(),
    finishedUpdates: 0,
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
    state.account.authorization = authorization;
    return json(route, envelope({
      id: state.account.id, email: `${state.account.id}@example.test`,
      fullName: state.account.name, phone: "0901234567", gender: null,
      address: null, dateOfBirth: null, roles: ["BUYER"], status: "ACTIVE",
      createdAt: "2026-11-02T00:00:00Z",
    }));
  });
  // This harness owns the signed-in header's private dependencies. An unrelated
  // notification fixture must not reject its token and trigger session renewal.
  await page.route("**/api/v1/notifications**", (route) => {
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: corsHeaders });
    expect(route.request().method()).toBe("GET");
    expect(state.account.authorization).toMatch(/^Bearer .+$/);
    expect(route.request().headers().authorization).toBe(state.account.authorization);
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/notifications/unread-count")
      return json(route, envelope({ count: 0 }));
    expect(path).toBe("/api/v1/notifications");
    return json(route, {
      ...envelope([]),
      page: { number: 0, size: 10, totalElements: 0, totalPages: 0 },
    });
  });
  await page.route("**/api/v1/products/*", (route) => {
    if (new URL(route.request().url()).pathname !== `/api/v1/products/${productId}`)
      return json(route, { title: "Not found", status: 404, detail: "Metadata is unavailable." }, 404);
    return json(route, envelope({
      id: productId, name: title, slug: `studio-headphones-${productId}`,
      categoryId: "electronics", sellerId: "seller-1", status: "ACTIVE",
      minPrice: 999999, description: "Current catalog metadata, not the cart price.",
      auctionEnable: false,
      skus: [{
        id: skuId, productId, skuCode: "SILVER", color: "Silver", size: null,
        price: 999999, status: "ACTIVE",
      }],
      images: [],
    }));
  });
  await page.route("**/api/v1/carts/**", async (route) => {
    const request = route.request();
    const method = request.method();
    if (method === "OPTIONS")
      return route.fulfill({ status: 204, headers: corsHeaders });
    const path = new URL(request.url()).pathname;
    const token = request.headers().authorization;
    const buyer = state.account.id;
    expect(token).toBe(state.account.authorization);
    const currentCart = state.carts.get(buyer)!;
    if (method === "GET" && path === cartPath) {
      state.reads.push(buyer);
      try {
        await state.readGate;
        return await (state.failedReads
          ? json(route, { title: "Unavailable", status: 503, detail: "Cart service is unavailable." }, 503)
          : json(route, envelope(currentCart)));
      } catch {
        // A remount or logout can cancel a deliberately held GET.
        return;
      }
    }
    const body: unknown = request.postData() ? request.postDataJSON() : null;
    state.writes.push({ method, path, body, token });
    if (method === "PUT" && path === `${cartPath}/items/${lineId}`) {
      const rejected = state.rejectedUpdate;
      try {
        await state.updateGate;
        if (rejected)
          return await json(route, {
            title: "Conflict", status: 409, code: "COMMERCE_QUANTITY_REJECTED",
            detail: "Only two units can be purchased.",
          }, 409);
        const quantity = (body as { quantity: number }).quantity;
        currentCart.items = currentCart.items.map((item) => item.id === lineId ? { ...item, quantity } : item);
        return await json(route, envelope(currentCart));
      } catch {
        // Logout may abort the old account's intercepted request.
      } finally {
        state.finishedUpdates += 1;
        state.updateFinished.resolve();
      }
      return;
    }
    if (method === "DELETE" && path === `${cartPath}/items/${lineId}`) {
      await state.deleteGate;
      if (state.rejectedDelete)
        return json(route, {
          title: "Conflict", status: 409, code: "COMMERCE_ITEM_LOCKED",
          detail: "This cart line cannot be removed right now.",
        }, 409);
      currentCart.items = currentCart.items.filter((item) => item.id !== lineId);
      return route.fulfill({ status: 204, headers: corsHeaders });
    }
    return json(route, { title: "Unexpected cart operation", status: 404 }, 404);
  });
  return state;
}

async function signIn(page: Page, name: string) {
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/keycloak\/realms\/nexus\/protocol\/openid-connect\/auth\?/);
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("buyer@nexus.local");
  await page.getByLabel("Password", { exact: true }).fill("Fixture-pass-123!");
  await page.getByRole("button", { name: "Sign in at Keycloak", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(`Hi ${name}`, { exact: true })).toBeVisible();
}

async function openCart(page: Page) {
  await page.getByRole("link", { name: /^Shopping cart/ }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByRole("heading", { name: "Cart", exact: true })).toBeVisible();
}

async function signInAndOpenCart(page: Page, name: string) {
  await page.goto("/sign-in");
  await signIn(page, name);
  await openCart(page);
}

async function capture(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(name);
  // Hide development diagnostics only in the exported image, after UI assertions.
  await page.screenshot({ path, fullPage: true, style: "nextjs-portal { visibility: hidden !important; }" });
  await info.attach(name, { path, contentType: "image/png" });
}

test.beforeEach(async ({ request }) => {
  expect((await request.get(`${providerOrigin}/test/reset`)).ok()).toBe(true);
});

test("signed-out cart requests sign-in without fetching protected cart data", async ({ page }) => {
  const state = await installCart(page);
  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: "Sign in to view your cart" })).toBeVisible();
  await expect(page.getByTestId(`cart-line-${lineId}`)).toHaveCount(0);
  expect(state.reads).toEqual([]);
  expect(state.writes).toEqual([]);
  await page.getByRole("main").getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/sign-in");
});

test("cart displays snapshot unit and line prices with a disabled checkout at desktop", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1056 });
  const state = await installCart(page);
  await signInAndOpenCart(page, state.account.name);
  const line = page.getByTestId(`cart-line-${lineId}`);
  await expect(line).toContainText(productName);
  await expect(line.getByRole("spinbutton")).toHaveValue("2");
  await expect(line.getByText("150.000,00 ₫", { exact: true })).toBeVisible();
  await expect(line.getByText("300.000,00 ₫", { exact: true })).toBeVisible();
  await expect(page.getByTestId("cart-subtotal")).toHaveText("300.000,00 ₫");
  await expect(page.getByRole("main")).not.toContainText("999.999");
  await expect(page.getByRole("button", { name: /Place order|Proceed to Checkout/i })).toBeDisabled();
  await expect(page.getByRole("main")).toContainText(/checkout.*not available|order.*not available|coming soon/i);
  await expect(page.getByRole("link", { name: /^Shopping cart/ })).toHaveAccessibleName(/2/);
  expect(state.reads).toContain("buyer-1");
  await capture(page, info, "cart-desktop-1440.png");
  await page.setViewportSize({ width: 375, height: 812 });
  await capture(page, info, "cart-mobile-375x812.png");
});

test("quantity changes subtotal before the response and rejection restores the snapshot", async ({ page }) => {
  const state = await installCart(page);
  const gate = deferred();
  state.updateGate = gate.promise;
  state.rejectedUpdate = true;
  try {
    await signInAndOpenCart(page, state.account.name);
    const line = page.getByTestId(`cart-line-${lineId}`);
    await expect(line.getByRole("spinbutton")).toHaveValue("2");
    await line.getByRole("button", { name: /Increase quantity/ }).click();
    await expect(page.getByTestId("cart-subtotal")).toHaveText("450.000,00 ₫");
    await expect(line.getByRole("spinbutton")).toHaveValue("3");
    await expect(line.getByRole("button", { name: /Increase quantity/ })).toBeDisabled();
    await expect.poll(() => state.writes.length).toBe(1);
    expect(state.writes[0]).toEqual({
      method: "PUT", path: `${cartPath}/items/${lineId}`,
      body: { quantity: 3 }, token: state.account.authorization,
    });
    gate.resolve();
    await expect(page.getByText("Only two units can be purchased.", { exact: true })).toBeVisible();
    await expect(line.getByRole("spinbutton")).toHaveValue("2");
    await expect(page.getByTestId("cart-subtotal")).toHaveText("300.000,00 ₫");
    await expect(line.getByRole("button", { name: /Increase quantity/ })).toBeEnabled();
    expect(state.writes).toHaveLength(1);
  } finally {
    gate.resolve();
  }
});

test("successful quantity edit survives navigation, session restoration and explicit sign-out", async ({ page }) => {
  const state = await installCart(page);
  await signInAndOpenCart(page, state.account.name);
  const line = page.getByTestId(`cart-line-${lineId}`);
  const quantity = line.getByRole("spinbutton");
  await quantity.fill("");
  await quantity.press("Tab");
  await expect(quantity).toHaveValue("2");
  expect(state.writes).toEqual([]);
  await quantity.fill("30");
  await quantity.fill("3");
  expect(state.writes).toEqual([]);
  await quantity.press("Enter");
  await expect(page.getByTestId("cart-subtotal")).toHaveText("450.000,00 ₫");
  await expect.poll(() => state.carts.get("buyer-1")!.items[0].quantity).toBe(3);
  await expect(line.getByRole("button", { name: /Increase quantity/ })).toBeEnabled();
  await page.getByRole("link", { name: "Nexus home", exact: true }).click();
  await openCart(page);
  await expect(line.getByRole("spinbutton")).toHaveValue("3");
  // The HttpOnly cookie restores the session on reload, so the cart is read again with a fresh token.
  const readsBeforeRestore = state.reads.length;
  await page.reload();
  await expect(page.getByText(`Hi ${state.account.name}`, { exact: true })).toBeVisible();
  await expect(line.getByRole("spinbutton")).toHaveValue("3");
  await expect(page.getByTestId("cart-subtotal")).toHaveText("450.000,00 ₫");
  expect(state.reads.length).toBeGreaterThan(readsBeforeRestore);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  // Wait for the Keycloak end-session redirect to land back on the home page before navigating.
  await expect(page).toHaveURL(`${appOrigin}/`);
  await page.waitForLoadState();
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: "Sign in to view your cart" })).toBeVisible();
  const readsBeforeLogin = state.reads.length;
  await page.getByRole("main").getByRole("link", { name: "Sign in", exact: true }).click();
  await signIn(page, state.account.name);
  await openCart(page);
  await expect(line.getByRole("spinbutton")).toHaveValue("3");
  await expect(page.getByTestId("cart-subtotal")).toHaveText("450.000,00 ₫");
  expect(state.reads.length).toBeGreaterThan(readsBeforeLogin);
});

test("a rejected last-line removal restores the line, subtotal and API reason", async ({ page }) => {
  const state = await installCart(page);
  const gate = deferred();
  state.deleteGate = gate.promise;
  state.rejectedDelete = true;
  try {
    await signInAndOpenCart(page, state.account.name);
    const line = page.getByTestId(`cart-line-${lineId}`);
    await line.getByRole("button", { name: /Remove/ }).click();
    await expect(line).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Your cart is empty", exact: true })).toBeVisible();
    await expect.poll(() => state.writes.length).toBe(1);
    gate.resolve();
    await expect(line.getByRole("spinbutton")).toHaveValue("2");
    await expect(page.getByTestId("cart-subtotal")).toHaveText("300.000,00 ₫");
    await expect(page.getByText("This cart line cannot be removed right now.", { exact: true })).toBeVisible();
    await expect(line.getByRole("button", { name: /Remove/ })).toBeEnabled();
    expect(state.writes).toHaveLength(1);
  } finally {
    gate.resolve();
  }
});

test("bodyless remove response leaves an empty cart and a working catalog link", async ({ page }) => {
  const state = await installCart(page);
  await signInAndOpenCart(page, state.account.name);
  const line = page.getByTestId(`cart-line-${lineId}`);
  await line.getByRole("button", { name: /Remove/ }).click();
  await expect(line).toHaveCount(0);
  const catalog = page.getByRole("main").getByRole("link", { name: "Browse catalog", exact: true });
  await expect(catalog).toBeVisible();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0]).toEqual({
    method: "DELETE", path: `${cartPath}/items/${lineId}`,
    body: null, token: state.account.authorization,
  });
  await catalog.click();
  await expect(page).not.toHaveURL(/\/cart$/);
  await expect(page.getByRole("main")).toBeVisible();
});

test("cart load retries and mobile long titles and missing metadata remain usable", async ({ page }, info) => {
  const state = await installCart(page, `Long product title ${"UnbrokenProductName".repeat(8)} — silver headphones`);
  const missingLineId = "10000000-0000-4000-8000-000000000002";
  state.carts.get("buyer-1")!.items.push({
    id: missingLineId, productId: "20000000-0000-4000-8000-000000000002",
    skuId: "30000000-0000-4000-8000-000000000002", quantity: 1, unitPrice: 50000,
  });
  state.failedReads = true;
  await signInAndOpenCart(page, state.account.name);
  const retry = page.getByRole("button", { name: "Retry cart", exact: true });
  await expect(retry).toBeVisible();
  await expect(page.getByTestId(`cart-line-${lineId}`)).toHaveCount(0);
  state.failedReads = false;
  await retry.click();
  await expect(page.getByTestId(`cart-line-${lineId}`)).toContainText("UnbrokenProductName");
  const fallback = page.getByTestId(`cart-line-${missingLineId}`);
  await expect(fallback.getByRole("button", { name: /Remove/ })).toBeEnabled();
  await expect(page.getByTestId("cart-subtotal")).toHaveText("350.000,00 ₫");
  expect(page.viewportSize()).toEqual({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const clipped = await page.locator("header :visible, main :visible, footer :visible").evaluateAll((elements) =>
    elements.filter((element) => element instanceof HTMLElement && element.clientWidth > 0 &&
      element.scrollWidth > element.clientWidth + 1 && !element.closest("script,style,svg,pre"))
      .map((element) => element.textContent?.trim()).filter(Boolean),
  );
  expect(clipped).toEqual([]);
  const smallTargets = await page.locator(
    "header a:visible, header button:visible, main a:visible, main button:visible, main input:visible, footer a:visible",
  ).evaluateAll((elements) => elements.map((element) => ({
    label: element.getAttribute("aria-label") ?? element.textContent,
    rect: element.getBoundingClientRect(),
  })).filter(({ rect }) => rect.width < 44 || rect.height < 44).map(({ label }) => label));
  expect(smallTargets).toEqual([]);
  await capture(page, info, "cart-mobile-edge-cases.png");
});

test("a pending old-account edit cannot restore private cart data after account switching", async ({ page }) => {
  const state = await installCart(page);
  const gate = deferred();
  state.updateGate = gate.promise;
  state.carts.set("buyer-2", {
    id: "40000000-0000-4000-8000-000000000002", userId: "buyer-2", status: "ACTIVE", items: [],
  });
  try {
    await signInAndOpenCart(page, state.account.name);
    await page.getByTestId(`cart-line-${lineId}`).getByRole("button", { name: /Increase quantity/ }).click();
    await expect(page.getByTestId("cart-subtotal")).toHaveText("450.000,00 ₫");
    await expect.poll(() => state.writes.length).toBe(1);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL((url) => url.origin === appOrigin && url.pathname === "/");
    await page.waitForLoadState("load");
    await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/sign-in" && url.searchParams.get("returnTo") === "/");
    state.account.id = "buyer-2";
    state.account.name = "Second Buyer";
    await signIn(page, state.account.name);
    await openCart(page);
    await expect(page.getByRole("main").getByRole("link", { name: "Browse catalog", exact: true })).toBeVisible();
    gate.resolve();
    await state.updateFinished.promise;
    await expect(page.getByTestId(`cart-line-${lineId}`)).toHaveCount(0);
    await expect(page.getByRole("main")).not.toContainText(productName);
    await expect(page.getByRole("link", { name: /^Shopping cart/ })).toHaveAccessibleName(/0/);
    await page.getByRole("link", { name: "Nexus home", exact: true }).click();
    await openCart(page);
    await expect(page.getByTestId(`cart-line-${lineId}`)).toHaveCount(0);
  } finally {
    gate.resolve();
  }
});

test("navigation keeps cart edits locked through reconciliation and ignores a late old rejection", async ({ page }) => {
  const state = await installCart(page);
  const updateGate = deferred();
  const readGate = deferred();
  state.updateGate = updateGate.promise;
  state.rejectedUpdate = true;
  try {
    await signInAndOpenCart(page, state.account.name);
    const line = page.getByTestId(`cart-line-${lineId}`);
    await line.getByRole("button", { name: /Increase quantity/ }).click();
    await expect(page.getByTestId("cart-subtotal")).toHaveText("450.000,00 ₫");
    await expect.poll(() => state.writes.length).toBe(1);
    const initialReads = state.reads.length;
    state.readGate = readGate.promise;
    await page.getByRole("link", { name: "Nexus home", exact: true }).click();
    await expect.poll(() => state.reads.length).toBeGreaterThan(initialReads);
    await openCart(page);
    await expect(line.getByRole("button", { name: /Increase quantity/ })).toBeDisabled();
    await expect(line.getByRole("button", { name: /Remove/ })).toBeDisabled();
    expect(state.writes).toHaveLength(1);
    readGate.resolve();
    await expect(line.getByRole("button", { name: /Increase quantity/ })).toBeEnabled();
    await expect(line.getByRole("spinbutton")).toHaveValue("2");
    state.updateGate = undefined;
    state.rejectedUpdate = false;
    await line.getByRole("button", { name: /Increase quantity/ }).click();
    await expect.poll(() => state.carts.get("buyer-1")!.items[0].quantity).toBe(3);
    await expect(line.getByRole("button", { name: /Increase quantity/ })).toBeEnabled();
    await expect(page.getByTestId("cart-subtotal")).toHaveText("450.000,00 ₫");
    updateGate.resolve();
    await expect.poll(() => state.finishedUpdates).toBe(2);
    await expect(line.getByRole("spinbutton")).toHaveValue("3");
    await expect(page.getByTestId("cart-subtotal")).toHaveText("450.000,00 ₫");
    await expect(page.getByText("Only two units can be purchased.", { exact: true })).toHaveCount(0);
    expect(state.writes).toHaveLength(2);
  } finally {
    updateGate.resolve();
    readGate.resolve();
  }
});
