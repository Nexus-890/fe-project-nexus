import { expect, test, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";

const simulation = "http://127.0.0.1:3914";
const groupId = "a1000000-0000-4000-8000-000000000001";
const paymentPath = `/checkout/payment/${groupId}`;
const memo = "NX20261104001";
const transferContent = `SEVQR ${memo}`;

async function evidence(request: APIRequestContext) {
  const response = await request.get(`${simulation}/api/test/evidence`);
  expect(response.ok()).toBe(true);
  return response.json();
}

async function mode(request: APIRequestContext, value: string) {
  expect((await request.get(`${simulation}/api/test/mode?mode=${value}`)).ok()).toBe(true);
}

async function signIn(page: Page) {
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(paymentPath)}`);
  await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/keycloak\/realms\/nexus\/protocol\/openid-connect\/auth\?/);
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("buyer@nexus.local");
  await page.getByLabel("Password", { exact: true }).fill("Fixture-pass-123!");
  await page.getByRole("button", { name: "Sign in at Keycloak", exact: true }).click();
  await expect(page).toHaveURL(paymentPath);
  await expect(page.getByRole("heading", { name: "Payment", exact: true })).toBeVisible();
}

async function assertQr(page: Page) {
  const qr = page.getByRole("img", { name: "Payment QR code", exact: true });
  await expect(qr).toHaveCount(1);
  await expect(qr).toBeVisible();
  await expect(qr).toHaveJSProperty("complete", true);
  expect(await qr.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  return qr;
}

async function screenshot(page: Page, info: TestInfo, name: string) {
  const path = info.outputPath(name);
  await page.screenshot({ path, fullPage: true, style: "nextjs-portal { visibility: hidden !important; }" });
  await info.attach(name, { path, contentType: "image/png" });
}

test.beforeEach(async ({ request }) => {
  expect((await request.get(`${simulation}/keycloak/test/reset`)).ok()).toBe(true);
  expect((await request.get(`${simulation}/api/test/reset`)).ok()).toBe(true);
});

test("signed-out buyer sees sign-in and sends no protected payment request", async ({ page, request }) => {
  await page.goto(paymentPath);
  await expect(page.getByRole("heading", { name: "Sign in to continue payment" })).toBeVisible();
  expect((await evidence(request)).paymentRequests).toEqual([]);
  await expect(page.getByRole("img", { name: "Payment QR code" })).toHaveCount(0);
  await page.getByRole("main").getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(`/sign-in?returnTo=${encodeURIComponent(paymentPath)}`);
});

test("two shops use one QR and selectable copyable group values at 375x812", async ({ page, request }, info) => {
  await page.addInitScript(() => {
    const values: string[] = [];
    Object.defineProperty(window, "__paymentCopies", { value: values });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value: string) => { values.push(value); } } });
  });
  await signIn(page);
  const qr = await assertQr(page);
  const amount = page.getByText("350.000 ₫", { exact: true });
  const account = page.getByText("0000000002", { exact: true });
  const transferMemo = page.getByText(transferContent, { exact: true });
  for (const field of [amount, account, transferMemo]) {
    await expect(field).toBeVisible();
    expect(await field.evaluate((element) => getComputedStyle(element).userSelect)).toBe("text");
  }
  await page.getByRole("button", { name: "Copy bank account", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Bank account copied." })).toBeVisible();
  await page.getByRole("button", { name: "Copy amount", exact: true }).click();
  await page.getByRole("button", { name: "Copy transfer memo", exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { __paymentCopies: string[] }).__paymentCopies)).toEqual(["0000000002", "350000", transferContent]);
  const calls = await evidence(request);
  expect(calls.shops).toHaveLength(2);
  expect(calls.shops.reduce((total: number, shop: { amount: number }) => total + shop.amount, 0)).toBe(350000);
  // Development StrictMode may cancel an already-sent idempotent read and
  // remount it. Each request must carry only this group, with a valid Bearer.
  expect(calls.paymentRequests.length).toBeGreaterThanOrEqual(1);
  expect(calls.paymentRequests.length).toBeLessThanOrEqual(2);
  expect(calls.paymentRequests.every((call: unknown) => JSON.stringify(call) === JSON.stringify({ method: "POST", body: { orderGroupId: groupId } }))).toBe(true);
  expect(calls.authenticatedPayments).toBe(calls.paymentRequests.length);
  expect(calls.qrRequests).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  const box = await qr.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(812);
  await screenshot(page, info, "payment-mobile-375x812.png");
  await page.setViewportSize({ width: 1440, height: 1056 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await screenshot(page, info, "payment-desktop-1440.png");
});

test("server deadline survives laptop clock an hour ahead, refresh and reload with reauthentication", async ({ page, request }) => {
  await signIn(page);
  await assertQr(page);
  await expect(page.getByTestId("payment-countdown")).toHaveText(/^(10:00|09:5\d)$/);
  const before = await page.getByTestId("payment-countdown").innerText();
  const initialCalls = (await evidence(request)).paymentRequests.length;
  await page.clock.setFixedTime(new Date(Date.now() + 3600000));
  await page.getByRole("button", { name: "Refresh payment", exact: true }).click();
  await expect.poll(async () => (await evidence(request)).paymentRequests.length).toBe(initialCalls + 1);
  await expect(page.getByRole("button", { name: "Refresh payment", exact: true })).toBeEnabled();
  await expect(page.getByTestId("payment-countdown")).toHaveText(/^(10:00|09:5\d)$/);
  await expect(page.getByText(transferContent, { exact: true })).toBeVisible();
  expect(await page.getByTestId("payment-countdown").innerText()).not.toBe("00:00");
  expect(before).not.toBe("00:00");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Sign in to continue payment" })).toBeVisible();
  expect((await evidence(request)).paymentRequests).toHaveLength(initialCalls + 1);
  // Auth is intentionally in memory. A full reload requires signing in again.
  await page.clock.setFixedTime(new Date());
  await signIn(page);
  await assertQr(page);
  await expect(page.getByText(transferContent, { exact: true })).toBeVisible();
  await expect.poll(async () => (await evidence(request)).paymentRequests.length).toBeGreaterThanOrEqual(initialCalls + 2);
  expect((await evidence(request)).paymentRequests.every((call: { body: { orderGroupId: string } }) => call.body.orderGroupId === groupId)).toBe(true);
});

test("zero remaining time hides QR and disables every transfer copy action", async ({ page, request }, info) => {
  await mode(request, "short");
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Payment expired", exact: true })).toBeVisible();
  await expect(page.getByTestId("payment-countdown")).toHaveText("00:00");
  await expect(page.getByRole("img", { name: "Payment QR code" })).toHaveCount(0);
  for (const name of ["Copy amount", "Copy bank account", "Copy transfer memo"])
    await expect(page.getByRole("button", { name, exact: true })).toBeDisabled();
  await screenshot(page, info, "payment-expired-375x812.png");
});

test("clipboard failure preserves selectable details and provides manual-copy feedback", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new DOMException("Permission denied", "NotAllowedError"); } } });
  });
  await signIn(page);
  await assertQr(page);
  await page.getByRole("button", { name: "Copy transfer memo", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Couldn’t copy. Select the text above and copy it manually." })).toBeVisible();
  await expect(page.getByText(transferContent, { exact: true })).toBeVisible();
});

test("Problem Details are shown and manual retry recovers without an automatic POST loop", async ({ page, request }) => {
  await mode(request, "unavailable");
  await signIn(page);
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Bank transfer instructions are temporarily unavailable.");
  await expect(page.getByRole("img", { name: "Payment QR code" })).toHaveCount(0);
  const failedCalls = (await evidence(request)).paymentRequests.length;
  expect(failedCalls).toBeGreaterThanOrEqual(1);
  expect(failedCalls).toBeLessThanOrEqual(2);
  await mode(request, "success");
  await page.getByRole("button", { name: "Retry payment", exact: true }).click();
  await assertQr(page);
  expect((await evidence(request)).paymentRequests).toHaveLength(failedCalls + 1);
});

test("missing server clock rejects instructions instead of trusting the laptop clock", async ({ page, request }) => {
  await mode(request, "missing-server-time");
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Unable to prepare payment", exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).not.toBeEmpty();
  await expect(page.getByRole("img", { name: "Payment QR code" })).toHaveCount(0);
  const failedCalls = (await evidence(request)).paymentRequests.length;
  expect(failedCalls).toBeGreaterThanOrEqual(1);
  expect(failedCalls).toBeLessThanOrEqual(2);
});

test("malformed refresh followed by unavailable retry keeps stale QR hidden until recovery", async ({ page, request }) => {
  await signIn(page);
  await assertQr(page);
  await mode(request, "missing-server-time");
  await page.getByRole("button", { name: "Refresh payment", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Unable to prepare payment", exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Payment QR code" })).toHaveCount(0);
  await mode(request, "unavailable");
  await page.getByRole("button", { name: "Retry payment", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Bank transfer instructions are temporarily unavailable.");
  await expect(page.getByRole("img", { name: "Payment QR code" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copy transfer memo" })).toHaveCount(0);
  await mode(request, "success");
  await page.getByRole("button", { name: "Retry payment", exact: true }).click();
  await assertQr(page);
  await expect(page.getByText(transferContent, { exact: true })).toBeVisible();
});

test("refresh reporting non-payable session removes previously valid QR and copy actions", async ({ page, request }) => {
  await signIn(page);
  await assertQr(page);
  await mode(request, "expired");
  await page.getByRole("button", { name: "Refresh payment", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Payment unavailable", exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("This payment session has expired.");
  await expect(page.getByRole("img", { name: "Payment QR code" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copy transfer memo" })).toHaveCount(0);
});
