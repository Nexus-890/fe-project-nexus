import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const simulation = `http://127.0.0.1:${process.env.NEXUS_ACCOUNT_API_PORT || "3921"}`;
const defaultAddress = {
  id: "68000000-0000-4000-8000-000000000101", recipientName: "Home Buyer", phone: "0901234567", addressLine: "12 Nguyen Hue",
  provinceCode: "202", provinceName: "Ho Chi Minh City", wardCode: "20309", wardName: "Ward 5", isDefault: true,
  createdAt: "2026-11-13T12:00:00Z", updatedAt: "2026-11-13T12:00:00Z",
};
const secondAddress = {
  id: "68000000-0000-4000-8000-000000000102", recipientName: "Office Buyer", phone: "0909876543", addressLine: "24 Tran Phu",
  provinceCode: "201", provinceName: "Ha Noi", wardCode: "20701", wardName: "Phuc Xa", isDefault: false,
  createdAt: "2026-11-13T13:00:00Z", updatedAt: "2026-11-13T13:00:00Z",
};

async function control(request: APIRequestContext, body: Record<string, unknown>) {
  expect((await request.post(`${simulation}/api/test/account/control`, { data: body })).ok()).toBe(true);
}

async function signIn(page: Page, destination: string) {
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(destination)}`);
  await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("buyer@nexus.local");
  await page.getByLabel("Password", { exact: true }).fill("Fixture-pass-123!");
  await page.getByRole("button", { name: "Sign in at Keycloak", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${destination}$`));
}

async function fillAddress(page: Page, street = "12 Nguyen Hue", province = "202", ward = "20309") {
  await page.getByLabel("Recipient name", { exact: true }).fill("Home Buyer");
  await page.getByLabel("Phone number", { exact: true }).fill("0901234567");
  await page.getByLabel("House number and street", { exact: true }).fill(street);
  await page.getByLabel("Province / City", { exact: true }).selectOption(province);
  await page.getByLabel("Ward", { exact: true }).selectOption(ward);
}

test.beforeEach(async ({ request }) => {
  for (const path of ["/keycloak/test/reset", "/api/test/reset", "/api/test/account/reset"])
    expect((await request.get(`${simulation}${path}`)).ok()).toBe(true);
});

test("buyer saves, edits, sets default and removes saved addresses in the account UI", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page, "/addresses");
  await expect(page.getByRole("heading", { name: "No saved addresses yet" })).toBeVisible();
  await page.getByRole("button", { name: "Add address", exact: true }).click();
  await fillAddress(page);
  const firstSave = page.waitForRequest((request) => request.url().endsWith("/api/v1/users/me/addresses") && request.method() === "POST");
  await page.getByRole("button", { name: "Save address", exact: true }).click();
  expect((await firstSave).postDataJSON()).toEqual({ recipientName: "Home Buyer", phone: "0901234567", addressLine: "12 Nguyen Hue", provinceCode: "202", provinceName: "Ho Chi Minh City", wardCode: "20309", wardName: "Ward 5", isDefault: true });
  await expect(page.getByText("Address saved.", { exact: true })).toBeVisible();
  await expect(page.getByText("1 of 10 addresses saved", { exact: true })).toBeVisible();
  await expect(page.getByText("Default", { exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Edit address for Home Buyer", exact: true }).click();
  await page.getByLabel("House number and street", { exact: true }).fill("16 Nguyen Hue");
  await page.getByRole("button", { name: "Save address", exact: true }).click();
  await expect(page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Home Buyer", exact: true }) })).toContainText("16 Nguyen Hue");
  await page.getByRole("button", { name: "Add address", exact: true }).click();
  await fillAddress(page, "24 Tran Phu", "201", "20701");
  await page.getByLabel("Recipient name", { exact: true }).fill("Office Buyer");
  await page.getByRole("button", { name: "Save address", exact: true }).click();
  await expect(page.getByText("2 of 10 addresses saved", { exact: true })).toBeVisible();
  const defaultRequest = page.waitForRequest((request) => /\/api\/v1\/users\/me\/addresses\/[^/]+\/default$/.test(request.url()) && request.method() === "POST");
  await page.getByRole("button", { name: "Set default address for Office Buyer", exact: true }).click();
  expect((await defaultRequest).postData()).toBeNull();
  await expect(page.getByText("Default address updated.", { exact: true })).toBeVisible();
  const office = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Office Buyer", exact: true }) });
  await expect(office.getByText("Default", { exact: true })).toBeVisible();
  await expect(page.getByText("Default", { exact: true })).toHaveCount(1);
  await page.screenshot({ path: info.outputPath("address-book-desktop.png"), fullPage: true, style: "nextjs-portal { visibility: hidden !important; }" });
  await page.setViewportSize({ width: 375, height: 812 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("address-book-mobile.png"), fullPage: true, style: "nextjs-portal { visibility: hidden !important; }" });
  await page.getByRole("button", { name: "Remove address for Office Buyer", exact: true }).click();
  await page.getByRole("button", { name: "Confirm removal", exact: true }).click();
  await expect(page.getByText("Address removed.", { exact: true })).toBeVisible();
  await expect(page.getByText("1 of 10 addresses saved", { exact: true })).toBeVisible();
  await expect(page.getByText("Default", { exact: true })).toHaveCount(1);
});

test("checkout preselects default and saved addresses use identical locality codes and quotes as typed addresses", async ({ page, request }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await control(request, { addresses: [defaultAddress, secondAddress] });
  await signIn(page, "/checkout");
  await expect(page.getByLabel("Deliver to", { exact: true })).toHaveValue(defaultAddress.id);
  await expect(page.getByLabel("Recipient name", { exact: true })).toHaveValue(defaultAddress.recipientName);
  await expect(page.getByLabel("Province / City", { exact: true })).toHaveValue("202");
  await expect(page.getByLabel("Ward", { exact: true })).toHaveValue("20309");
  await expect(page.getByTestId("checkout-shipping")).toContainText("45.000");
  await page.screenshot({ path: info.outputPath("checkout-saved-address-desktop.png"), fullPage: true, style: "nextjs-portal { visibility: hidden !important; }" });
  const first = await (await request.get(`${simulation}/api/test/evidence`)).json();
  expect(first.previews.at(-1).shippingAddress).toMatchObject({ provinceCode: "202", wardCode: "20309", addressLine: defaultAddress.addressLine });
  const savedPreview = first.previews.at(-1);
  await page.getByLabel("Deliver to", { exact: true }).selectOption("");
  await fillAddress(page);
  await expect(page.getByTestId("checkout-shipping")).toContainText("45.000");
  await expect.poll(async () => {
    const evidence = await (await request.get(`${simulation}/api/test/evidence`)).json();
    return evidence.previews.at(-1);
  }).toEqual(savedPreview);
  await page.getByLabel("Deliver to", { exact: true }).selectOption(secondAddress.id);
  await expect(page.getByLabel("Ward", { exact: true })).toHaveValue("20701");
  await expect(page.getByTestId("checkout-shipping")).toContainText("30.000");
  await expect(page.getByRole("button", { name: "Place order", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Place order", exact: true }).click();
  await expect(page).toHaveURL(/\/checkout\/payment\//);
});

test("checkout saves a newly entered address and it appears in the account address book", async ({ page }) => {
  await signIn(page, "/checkout");
  await expect(page.getByLabel("Deliver to", { exact: true })).toHaveValue("");
  await fillAddress(page);
  await page.getByRole("button", { name: "Save this address", exact: true }).click();
  await expect(page.getByText("Address saved to your account.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Address saved", exact: true })).toBeDisabled();
  await page.getByRole("link", { name: "Manage addresses", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Addresses", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Home Buyer", exact: true })).toBeVisible();
  await expect(page.getByText("Default", { exact: true })).toHaveCount(1);
});

test("ten-address capacity disables add until a saved address is removed", async ({ page, request }) => {
  await control(request, { addresses: Array.from({ length: 10 }, (_, index) => ({ ...defaultAddress, id: `68000000-0000-4000-8000-${String(index).padStart(12, "0")}`, recipientName: `Buyer ${index}`, isDefault: index === 0 })) });
  await signIn(page, "/addresses");
  await expect(page.getByText("10 of 10 addresses saved", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add address", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Remove address for Buyer 0", exact: true }).click();
  await page.getByRole("button", { name: "Confirm removal", exact: true }).click();
  await expect(page.getByText("9 of 10 addresses saved", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add address", exact: true })).toBeEnabled();
  await expect(page.getByText("Default", { exact: true })).toHaveCount(1);
});

test("unavailable address book preserves manual checkout and supports explicit retry", async ({ page, request }) => {
  await control(request, { addressFailure: true });
  await signIn(page, "/checkout");
  await expect(page.getByText("Saved addresses are temporarily unavailable.", { exact: true })).toBeVisible();
  await fillAddress(page);
  await expect(page.getByTestId("checkout-shipping")).toContainText("45.000");
  await control(request, { addressFailure: false });
  await page.getByRole("button", { name: "Retry saved addresses", exact: true }).click();
  await expect(page.getByLabel("Deliver to", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Ward", { exact: true })).toHaveValue("20309");
});

test("a late default address cannot overwrite typed fields and choosing new never restores that default", async ({ page, request }) => {
  await control(request, { addresses: [defaultAddress] });
  let release = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/v1/users/me/addresses", async (route) => {
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response });
  });
  try {
    await signIn(page, "/checkout");
    await page.getByLabel("Recipient name", { exact: true }).fill("Typed Buyer");
    await page.getByLabel("House number and street", { exact: true }).fill("99 Manual Street");
    release();
    await expect(page.getByLabel("Deliver to", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Deliver to", { exact: true })).toHaveValue("");
    await expect(page.getByLabel("Recipient name", { exact: true })).toHaveValue("Typed Buyer");
    await expect(page.getByLabel("House number and street", { exact: true })).toHaveValue("99 Manual Street");
    await page.getByLabel("Deliver to", { exact: true }).selectOption(defaultAddress.id);
    await expect(page.getByLabel("Ward", { exact: true })).toHaveValue("20309");
    await page.getByLabel("Deliver to", { exact: true }).selectOption("");
    await expect(page.getByLabel("Province / City", { exact: true })).toHaveValue("");
    await expect(page.getByLabel("Ward", { exact: true })).toBeDisabled();
    await expect(page.getByLabel("House number and street", { exact: true })).toHaveValue("");
  } finally { release(); }
});
