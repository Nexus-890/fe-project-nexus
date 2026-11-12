import { test, expect, type Page, type APIRequestContext, type TestInfo } from "@playwright/test";

const simulation = `http://127.0.0.1:${process.env.NEXUS_CHECKOUT_API_PORT || "3923"}`;
const lineIds = ["10000000-0000-4000-8000-000000000001", "10000000-0000-4000-8000-000000000002"];
type PreviewBody = {
  shippingAddress: {
    recipientName: string; phoneNumber: string; addressLine: string;
    provinceCode: string; wardCode: string; countryCode: string;
  };
  paymentMethod: string;
};
type Evidence = {
  requests: Array<{ method: string; path: string; query: string; authorized: boolean }>;
  previews: PreviewBody[];
  completedPreviews: string[];
  orderRequests: number;
  rejectedAuth: number;
};

async function evidence(request: APIRequestContext): Promise<Evidence> {
  const response = await request.get(`${simulation}/api/test/evidence`);
  expect(response.ok()).toBe(true);
  return response.json();
}
async function options(request: APIRequestContext, changes: Record<string, boolean>) {
  const response = await request.post(`${simulation}/api/test/options`, { data: changes });
  expect(response.ok()).toBe(true);
}
async function signIn(page: Page) {
  await page.goto("/sign-in?returnTo=%2Fcheckout");
  await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/keycloak\/realms\/nexus\/protocol\/openid-connect\/auth\?/);
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("buyer@nexus.local");
  await page.getByLabel("Password", { exact: true }).fill("Fixture-pass-123!");
  await page.getByRole("button", { name: "Sign in at Keycloak", exact: true }).click();
}
async function openCheckout(page: Page) {
  await signIn(page);
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByRole("heading", { name: "Checkout", exact: true })).toBeVisible();
}
async function destination(page: Page, ward = "20308") {
  await page.getByLabel("Province / City", { exact: true }).selectOption("202");
  await page.getByLabel("Ward", { exact: true }).selectOption(ward);
}
async function capture(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(name);
  await page.screenshot({ path, fullPage: true, style: "nextjs-portal { visibility: hidden !important; }" });
  await info.attach(name, { path, contentType: "image/png" });
}

test.beforeEach(async ({ request }) => {
  expect((await request.get(`${simulation}/keycloak/test/reset`)).ok()).toBe(true);
  expect((await request.get(`${simulation}/api/test/reset`)).ok()).toBe(true);
});

test("anonymous checkout redirects to sign in without protected checkout requests", async ({ page, request }) => {
  await page.goto("/checkout");
  await expect(page).toHaveURL(/\/sign-in\?returnTo=(?:%2F|\/)checkout$/);
  const actual = await evidence(request);
  expect(actual.requests.filter((entry) => /\/carts\/|\/shipping\/|\/checkout\//.test(entry.path))).toEqual([]);
  expect(actual.orderRequests).toBe(0);
});

test("empty cart lands on cart without requesting localities or a quote", async ({ page, request }) => {
  await options(request, { emptyCart: true });
  await signIn(page);
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByRole("heading", { name: "Your cart is empty", exact: true })).toBeVisible();
  const actual = await evidence(request);
  expect(actual.requests.filter((entry) => /\/shipping\/|\/checkout\//.test(entry.path))).toEqual([]);
  expect(actual.orderRequests).toBe(0);
});

test("two-line checkout prefills only profile text, uses saved unit prices and sums the quoted shipping", async ({ page, request }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openCheckout(page);
  await expect(page.getByLabel("Recipient name", { exact: true })).toHaveValue("Nguyen Thi Lan");
  await expect(page.getByLabel("Phone number", { exact: true })).toHaveValue("0901234567");
  await expect(page.getByLabel("Address line", { exact: true })).toHaveValue("227 Nguyen Van Cu");
  await expect(page.getByLabel("Province / City", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Ward", { exact: true })).toBeDisabled();
  await expect(page.getByTestId(`checkout-item-${lineIds[0]}`)).toContainText("150.000,00 ₫");
  await expect(page.getByTestId(`checkout-item-${lineIds[0]}`)).toContainText("300.000,00 ₫");
  await expect(page.getByTestId(`checkout-item-${lineIds[1]}`)).toContainText("125.000,00 ₫");
  await expect(page.getByTestId("checkout-subtotal")).toHaveText("425.000,00 ₫");
  await expect(page.getByText("Estimated total", { exact: true })).toBeVisible();
  await expect(page.getByTestId("checkout-total")).toHaveText("425.000,00 ₫");
  await expect(page.getByRole("main")).not.toContainText("999.999");
  expect((await evidence(request)).previews).toEqual([]);
  await destination(page);
  await expect(page.getByTestId("checkout-shipping")).toHaveText("30.000,00 ₫");
  await expect(page.getByText("Total", { exact: true })).toBeVisible();
  await expect(page.getByTestId("checkout-total")).toHaveText("455.000,00 ₫");
  await page.getByRole("button", { name: "Review address", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: /address.*ready/i })).toBeVisible();
  const actual = await evidence(request);
  expect(actual.previews[0]).toEqual({
    shippingAddress: {
      recipientName: "Nguyen Thi Lan", phoneNumber: "0901234567", addressLine: "227 Nguyen Van Cu",
      provinceCode: "202", wardCode: "20308", countryCode: "VN",
    },
    paymentMethod: "SEPAY",
  });
  expect(actual.requests.filter((entry) => /\/shipping\/|\/checkout\/|\/carts\/|\/users\/me/.test(entry.path)).every((entry) => entry.authorized)).toBe(true);
  expect(actual.rejectedAuth).toBe(0);
  expect(actual.orderRequests).toBe(0);
  await capture(page, info, "checkout-desktop-1440.png");
});

test("empty address reports each required field and sends no checkout request", async ({ page, request }) => {
  await options(request, { emptyProfile: true });
  await openCheckout(page);
  await page.getByRole("button", { name: "Review address", exact: true }).click();
  for (const name of ["Recipient name", "Phone number", "Address line", "Province / City", "Ward"])
    await expect(page.getByLabel(name, { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Recipient name", { exact: true })).toBeFocused();
  await expect(page.getByRole("alert").filter({ hasText: "Check the highlighted address fields below." })).toBeVisible();
  const actual = await evidence(request);
  expect(actual.previews).toEqual([]);
  expect(actual.orderRequests).toBe(0);
});

test("a province change resets the ward and a ward change refreshes the quote", async ({ page, request }) => {
  await openCheckout(page);
  await destination(page);
  await expect(page.getByTestId("checkout-total")).toHaveText("455.000,00 ₫");
  await page.getByLabel("Ward", { exact: true }).selectOption("20309");
  await expect(page.getByTestId("checkout-shipping")).toHaveText("45.000,00 ₫");
  await expect(page.getByTestId("checkout-total")).toHaveText("470.000,00 ₫");
  await page.getByLabel("Ward", { exact: true }).selectOption("20310");
  await expect(page.getByTestId("checkout-total")).toHaveText("455.000,00 ₫");
  await page.getByLabel("Province / City", { exact: true }).selectOption("201");
  await expect(page.getByLabel("Ward", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Ward", { exact: true }).locator("option[value='20310']")).toHaveCount(0);
  await page.getByLabel("Ward", { exact: true }).selectOption("20701");
  await expect.poll(async () => (await evidence(request)).previews.at(-1)?.shippingAddress.wardCode).toBe("20701");
  const actual = await evidence(request);
  expect(actual.requests.some((entry) => entry.path.endsWith("/wards") && entry.query === "?provinceCode=201")).toBe(true);
  expect(actual.requests.some((entry) => entry.path.endsWith("/districts"))).toBe(false);
});

test("a late quote for a previous ward cannot replace the current total", async ({ page, request }) => {
  await options(request, { slowWard: true });
  await openCheckout(page);
  await destination(page);
  await expect.poll(async () => (await evidence(request)).previews.length).toBe(1);
  await page.getByLabel("Ward", { exact: true }).selectOption("20309");
  await expect(page.getByTestId("checkout-total")).toHaveText("470.000,00 ₫");
  // Observe the old dependency response finishing rather than assuming a delay.
  await expect.poll(async () => (await evidence(request)).completedPreviews.includes("20308")).toBe(true);
  await expect(page.getByTestId("checkout-shipping")).toHaveText("45.000,00 ₫");
  expect((await evidence(request)).orderRequests).toBe(0);
});

test("ward failures are recoverable without discarding the province", async ({ page, request }) => {
  await options(request, { wardsFailure: true });
  await openCheckout(page);
  await page.getByLabel("Province / City", { exact: true }).selectOption("202");
  await expect(page.getByRole("alert").filter({ hasText: "Wards are temporarily unavailable." })).toBeVisible();
  await expect(page.getByLabel("Province / City", { exact: true })).toHaveValue("202");
  await options(request, { wardsFailure: false });
  await page.getByRole("button", { name: /Retry wards/i }).click();
  await page.getByLabel("Ward", { exact: true }).selectOption("20308");
  await expect(page.getByTestId("checkout-total")).toHaveText("455.000,00 ₫");
});

test("preview field errors remain attached to the form and retry recovers a failed quote", async ({ page, request }) => {
  await options(request, { fieldError: true });
  await openCheckout(page);
  await destination(page);
  await expect(page.getByLabel("Phone number", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Enter a reachable Vietnamese phone number.", { exact: true })).toBeVisible();
  await options(request, { fieldError: false, previewFailure: true });
  await page.getByLabel("Phone number", { exact: true }).fill("0907654321");
  await expect(page.getByRole("alert").filter({ hasText: "Shipping quotes are temporarily unavailable." }).first()).toBeVisible();
  await expect(page.getByTestId("checkout-total")).not.toHaveText("455.000,00 ₫");
  await options(request, { previewFailure: false });
  await page.getByRole("button", { name: /Retry (shipping|quote|preview)/i }).click();
  await expect(page.getByTestId("checkout-total")).toHaveText("455.000,00 ₫");
  expect((await evidence(request)).orderRequests).toBe(0);
});

test("an unavailable shipping fee is never shown as free shipping or a final total", async ({ page, request }) => {
  await options(request, { nullShippingFee: true });
  await openCheckout(page);
  await destination(page);
  await expect(page.getByTestId("checkout-shipping")).toContainText(/unavailable/i);
  await expect(page.getByTestId("checkout-shipping")).not.toHaveText("0,00 ₫");
  await expect(page.getByTestId("checkout-total")).not.toHaveText("425.000,00 ₫");
  expect((await evidence(request)).orderRequests).toBe(0);
});

for (const mode of ["malformedPreview", "changedPreview"]) {
  test(`${mode} is rejected before a final amount is displayed`, async ({ page, request }) => {
    await options(request, { [mode]: true });
    await openCheckout(page);
    await destination(page);
    await expect(page.getByRole("alert").filter({ hasText: /invalid|reconcile|cart has changed/i }).first()).toBeVisible();
    await expect(page.getByTestId("checkout-total")).toHaveText("—");
    await expect(page.getByTestId("checkout-shipping")).toHaveText("Unavailable");
    expect((await evidence(request)).orderRequests).toBe(0);
  });
}

test("mobile checkout wraps content, preserves metadata fallbacks and provides 44px targets", async ({ page, request }, info) => {
  await options(request, { metadataFailure: true });
  await openCheckout(page);
  await page.getByLabel("Recipient name", { exact: true }).fill("Nguyen Thi Lan With A Long Recipient Name For Mobile Layout");
  await page.getByLabel("Address line", { exact: true }).fill("Apartment 1204, 227 Nguyen Van Cu, a long address line to verify mobile checkout layout");
  await destination(page);
  await expect(page.getByTestId("checkout-total")).toHaveText("455.000,00 ₫");
  await expect(page.getByTestId(`checkout-item-${lineIds[0]}`)).toContainText("150.000,00 ₫");
  const geometry = await page.evaluate(() => {
    const main = document.querySelector("main")!;
    const controls = [...main.querySelectorAll<HTMLElement>("input, select, button, a")]
      .filter((control) => control.getClientRects().length > 0)
      .map((control) => ({ name: control.getAttribute("aria-label") || control.textContent?.trim(), width: control.getBoundingClientRect().width, height: control.getBoundingClientRect().height }));
    return { pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, controls };
  });
  expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.controls.filter((control) => control.width < 44 || control.height < 44)).toEqual([]);
  await capture(page, info, "checkout-mobile-375x812.png");
});

test("logout while a preview is pending cannot restore another session's checkout", async ({ page, request }) => {
  await options(request, { slowWard: true });
  await openCheckout(page);
  await destination(page);
  await expect.poll(async () => (await evidence(request)).previews.length).toBe(1);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByText("Hi Nguyen Thi Lan", { exact: true })).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/checkout$/);
  await expect.poll(async () => (await evidence(request)).completedPreviews.includes("20308")).toBe(true);
  await expect(page.getByTestId("checkout-total")).toHaveCount(0);
  expect((await evidence(request)).orderRequests).toBe(0);
});
