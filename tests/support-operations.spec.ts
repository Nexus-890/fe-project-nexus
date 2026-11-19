import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test.skip(!process.env.NEXUS_BACKOFFICE_TEST, "Uses the explicit #230 HTTP simulation.");
const origin = `http://127.0.0.1:${process.env.NEXUS_BACKOFFICE_API_PORT || "3920"}`;
const api = `${origin}/api`, provider = `${origin}/keycloak`;
const id = (n: number) => `a2300000-0000-4000-8000-${String(n).padStart(12, "0")}`;
async function signIn(page: Page, request: APIRequestContext, role: string, destination: string) {
  const subject = role === "ADMIN" ? "68000000-0000-4000-8000-000000000001" : role === "SELLER" ? "68000000-0000-4000-8000-000000000002" : "68000000-0000-4000-8000-000000000004";
  await request.get(`${provider}/test/control?roles=${role}&subject=${subject}`);
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(destination)}`);
  await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(`${role.toLowerCase()}@nexus.local`);
  await page.getByLabel("Password", { exact: true }).fill("Fixture-pass-123!");
  await page.getByRole("button", { name: "Sign in at Keycloak", exact: true }).click();
}
async function layouts(page: Page, name: string) {
  await mkdir("test-results/operations/screenshots", { recursive: true });
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/operations/screenshots/${name}-${width}.png`, fullPage: true });
  }
}
test.beforeEach(async ({ request }) => {
  await request.get(`${provider}/test/reset`);
  await request.post(`${api}/test/reset`);
  await request.post(`${api}/test/operations/reset`);
});

test("admin filters all orders, paginates, sees illegal transition and changes status with a reason", async ({ page, request }) => {
  await signIn(page, request, "ADMIN", "/backoffice/orders");
  await expect(page.getByText("Showing 1–10 of 12 results", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.getByText("Showing 11–12 of 12 results", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Order status", exact: true }).selectOption("PAID");
  await page.getByRole("button", { name: "Apply order filters", exact: true }).click();
  await expect(page.getByText("Showing 1–10 of 11 results", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Manage order", exact: true }).first().click();
  await page.getByRole("combobox", { name: "New order status", exact: true }).selectOption("COMPLETED");
  await page.getByLabel("Status change reason", { exact: true }).fill("Support reviewed delivery evidence");
  await page.getByRole("button", { name: "Confirm status change", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("COMMERCE_ILLEGAL_TRANSITION");
  await page.getByRole("combobox", { name: "New order status", exact: true }).selectOption("SHIPPED");
  await page.getByRole("button", { name: "Confirm status change", exact: true }).click();
  await expect(page.getByText("Order status updated to SHIPPED.", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Order status history" })).toContainText("Support reviewed delivery evidence");
  await layouts(page, "orders");
  await page.getByLabel("Buyer UUID", { exact: true }).fill("invalid");
  await page.getByRole("button", { name: "Apply order filters", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Invalid order filters");
});

test("support reaches unreconciled payments, records a refund with one captured key and confirms manual transfer", async ({ page, request }) => {
  await signIn(page, request, "SUPPORT_STAFF", "/backoffice/payments");
  await expect(page.getByRole("table")).toContainText("UNRECONCILED");
  await layouts(page, "payments");
  await page.getByRole("combobox", { name: "Payment status", exact: true }).selectOption("FAILED");
  await page.getByRole("button", { name: "Apply payment filters", exact: true }).click();
  await expect(page.getByText("No results match these filters.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Unreconciled payments", exact: true }).click();
  await expect(page.getByRole("table")).toContainText("UNRECONCILED");
  await page.goto(`/backoffice/refunds?orderId=${id(1)}`);
  await page.getByLabel("Refund reason", { exact: true }).fill("Canceled paid order approved for full refund");
  const keys: string[] = [];
  await page.route("**/v1/refunds", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    keys.push(route.request().headers()["idempotency-key"]);
    if (keys.length === 1) return route.fulfill({ status: 503, contentType: "application/problem+json", body: JSON.stringify({ title: "Temporary outage", detail: "Please retry", code: "UNAVAILABLE" }) });
    return route.continue();
  });
  await page.getByRole("button", { name: "Record refund", exact: true }).dblclick();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("UNAVAILABLE");
  await page.getByRole("button", { name: "Retry refund request", exact: true }).click();
  await expect(page.getByRole("table")).toContainText("REQUESTED");
  expect(keys).toHaveLength(2); expect(keys[0]).toBe(keys[1]);
  await page.getByRole("button", { name: "Confirm refund transfer", exact: true }).click();
  await expect(page.getByText("No transfer receipt uploaded yet.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Complete refund", exact: true })).toBeDisabled();
  await page.getByLabel("Transfer receipt (JPEG, PNG or PDF, up to 10 MiB)", { exact: true }).setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not a receipt") });
  await expect(page.getByRole("alert").filter({ hasText: "notes.txt is not a JPEG, PNG or PDF file." })).toBeVisible();
  await page.getByLabel("Transfer receipt (JPEG, PNG or PDF, up to 10 MiB)", { exact: true }).setInputFiles({ name: "receipt.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% refund receipt\n%%EOF\n") });
  await page.getByLabel("Bank transaction reference", { exact: true }).fill("  FT2611190001  ");
  await page.getByRole("button", { name: "Upload receipt", exact: true }).click();
  const receipts = page.getByRole("list", { name: "Transfer receipts", exact: true });
  await expect(receipts.getByRole("listitem")).toHaveCount(1);
  await expect(receipts).toContainText("FT2611190001");
  await expect(receipts).toContainText("PDF");
  await expect(page.getByRole("table")).toContainText("1 receipt");
  await receipts.getByRole("button", { name: "Open receipt 1", exact: true }).click();
  await expect(receipts.getByRole("link", { name: "Save receipt 1", exact: true })).toHaveAttribute("download", /^refund-receipt-.+\.pdf$/);
  await page.getByRole("checkbox").check();
  await layouts(page, "refund-receipt");
  await page.getByRole("button", { name: "Complete refund", exact: true }).click();
  await expect(page.getByRole("table")).toContainText("COMPLETED");
  await expect(page.getByRole("status").filter({ hasText: "Refund completed." })).toBeVisible();
  await layouts(page, "refunds");
  await page.getByRole("button", { name: "View transfer receipts", exact: true }).click();
  await expect(page.getByRole("list", { name: "Transfer receipts", exact: true })).toContainText("FT2611190001");
  await expect(page.getByRole("button", { name: "Upload receipt", exact: true })).toHaveCount(0);
  const evidence = (await (await request.get(`${api}/test/operations/evidence`)).json()).data;
  expect(evidence.refunds).toHaveLength(1);
  expect(evidence.refunds[0].evidence).toHaveLength(1);
  expect(evidence.requests.filter((row: { path: string; method: string }) => row.method === "POST" && row.path.endsWith("/evidence")).map((row: { body: unknown }) => row.body)).toEqual([
    { bankReference: "FT2611190001", file: { contentType: "application/pdf", size: 32 } },
  ]);
});

test("support creates a shipment, updates status, overrides a rejected transition and reviews history", async ({ page, request }) => {
  await signIn(page, request, "SUPPORT_STAFF", `/backoffice/shipments?orderId=${id(2)}`);
  await page.getByRole("button", { name: "New shipment", exact: true }).click();
  await page.getByRole("button", { name: "Create shipment", exact: true }).dblclick();
  await expect(page.getByRole("table")).toContainText("CREATED");
  await page.getByRole("button", { name: "Close creation form", exact: true }).click();
  await page.getByRole("button", { name: "Manage shipment", exact: true }).click();
  await page.getByRole("combobox", { name: "New shipment status", exact: true }).selectOption("PACKED");
  await page.getByLabel("Shipment change reason", { exact: true }).fill("Parcel packed by warehouse");
  await page.getByRole("button", { name: "Update shipment status", exact: true }).click();
  await expect(page.getByRole("table")).toContainText("PACKED");
  await page.getByRole("combobox", { name: "New shipment status", exact: true }).selectOption("DELIVERED");
  await page.getByLabel("Shipment change reason", { exact: true }).fill("Carrier proof of delivery reviewed");
  await page.getByRole("button", { name: "Update shipment status", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("SHIPMENT_ILLEGAL_TRANSITION");
  await page.getByRole("combobox", { name: "Shipment update mode", exact: true }).selectOption("override");
  await page.getByRole("button", { name: "Confirm shipment override", exact: true }).click();
  await expect(page.getByRole("table")).toContainText("DELIVERED");
  await expect(page.getByRole("region", { name: "Shipment change history" })).toContainText("Carrier proof of delivery reviewed");
  await layouts(page, "shipments");
  const evidence = (await (await request.get(`${api}/test/operations/evidence`)).json()).data;
  expect(evidence.shipments).toHaveLength(1);
  expect(evidence.requests.filter((r: { method: string; path: string }) => r.method === "POST" && r.path === "/v1/shipments")).toHaveLength(1);
});

for (const role of ["SELLER", "SUPPORT_STAFF"]) test(`${role} is denied the admin payout page without fetching admin data`, async ({ page, request }) => {
  await signIn(page, request, role, "/backoffice");
  await expect(page).toHaveURL("/backoffice");
  const calls: string[] = []; page.on("request", (req) => { if (/\/payments\/(payouts|seller-bank-accounts)(?:\?|$)/.test(req.url())) calls.push(req.url()); });
  await page.goto("/backoffice/admin-payouts");
  await expect(page.getByRole("heading", { name: "Access denied", exact: true })).toBeVisible();
  expect(calls).toEqual([]);
});

test("support can inspect orders but cannot change their status", async ({ page, request }) => {
  await signIn(page, request, "SUPPORT_STAFF", "/backoffice/orders");
  await page.getByRole("button", { name: "Manage order", exact: true }).first().click();
  await expect(page.getByRole("region", { name: "Order status history" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm status change", exact: true })).toHaveCount(0);
});

test("admin rejects a masked bank with a reason, sees exactly four needs-action states and retries a returned payout once", async ({ page, request }) => {
  await request.post(`${api}/test/seller-seed`);
  await signIn(page, request, "ADMIN", "/backoffice/payouts");
  const bank = page.getByRole("row").filter({ hasText: "4321" });
  await bank.getByRole("button", { name: "Review bank account", exact: true }).click();
  await page.getByRole("combobox", { name: "Verification decision", exact: true }).selectOption("REJECTED");
  await page.getByLabel("Verification reason (required)", { exact: true }).fill("Bank holder name does not match seller");
  await page.getByRole("button", { name: "Confirm bank verification", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Bank account rejected." })).toBeVisible();
  await page.getByRole("combobox", { name: "Verification status", exact: true }).selectOption("REJECTED");
  await bank.getByRole("button", { name: "Review bank account", exact: true }).click();
  await page.getByRole("button", { name: "Confirm bank verification", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Bank account verified." })).toBeVisible();
  const create = async (n: number, sellerId = "68000000-0000-4000-8000-000000000002") => (await (await request.post(`${api}/test/payouts/order-completed`, { data: { orderId: id(500 + n), sellerId, status: "COMPLETED", funded: true, refund: false, orderAmount: "120000.00", shippingFee: "20000.00" } })).json()).data.payout;
  const failed = await create(1), unknown = await create(2), returned = await create(3), succeeded = await create(4);
  await create(5, id(600)); // A different seller has no verified default bank: ON_HOLD.
  for (const [payout, outcome] of [[failed, "FAILED"], [unknown, "UNKNOWN"], [returned, "SUCCEEDED"], [succeeded, "SUCCEEDED"]] as const)
    await request.post(`${api}/test/payouts/provider`, { data: { payoutId: payout.id, outcome } });
  await request.post(`${api}/test/payouts/provider`, { data: { payoutId: returned.id, outcome: "RETURNED" } });
  await page.reload();
  const table = page.getByRole("table", { name: "Seller payouts", exact: true });
  for (const status of ["On hold", "Unknown", "Failed", "Returned"]) await expect(table).toContainText(status);
  for (const status of ["Succeeded", "Pending", "Processing"]) await expect(table).not.toContainText(status);
  await table.getByRole("row").filter({ hasText: `Payout ${returned.id.slice(0, 8)}` }).getByRole("button", { name: "View payout", exact: true }).click();
  await page.getByRole("button", { name: "Retry payout", exact: true }).dblclick();
  await expect(page.getByRole("status").filter({ hasText: "The payout retry was recorded." })).toBeVisible();
  const state = (await (await request.get(`${api}/test/payouts/evidence`)).json()).data;
  expect(state.requests.filter((row: { path: string }) => row.path.endsWith(`/${returned.id}/retry`))).toHaveLength(1);
  await expect(page.getByRole("button", { name: /Create payout|Confirm payout/ })).toHaveCount(0);
  await layouts(page, "payouts");
});
