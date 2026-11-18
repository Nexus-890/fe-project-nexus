import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test.skip(!process.env.NEXUS_MANUAL_PAYOUTS_TEST, "Use playwright.manual-payouts.config.ts for explicit HTTP simulation.");
const api = `http://127.0.0.1:${process.env.NEXUS_BACKOFFICE_API_PORT || "3920"}`;
const evidenceDir = path.join(tmpdir(), "nexus-manual-payouts-271-evidence");
const identities: Record<string, string> = { ADMIN: "68000000-0000-4000-8000-000000000001", SELLER: "68000000-0000-4000-8000-000000000002", SUPPORT_STAFF: "68000000-0000-4000-8000-000000000005" };
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const bearer = new WeakMap<Page, string>();
type Seeded = { id: string; orderId: string; sellerId: string };
type Evidence = { requests: { method: string; path: string; actor: string | null; idempotencyKey: string | null; body?: Record<string, unknown> }[]; transactions: { payoutId: string; type: string }[];
  payouts: { id: string; status: string; attempt: { id: string; state: string; ownerId: string; version: number; receiptStatus: string | null } | null }[] };

async function signIn(page: Page, request: APIRequestContext, role: string, returnTo: string) {
  const primary = role.split(",").find((entry) => entry !== "SELLER") || "SELLER";
  page.on("request", (sent) => { const header = sent.headers().authorization; if (header?.startsWith("Bearer ")) bearer.set(page, header); });
  await request.get(`${api}/keycloak/test/control?roles=${encodeURIComponent(role)}&subject=${identities[primary]}&email=${primary.toLowerCase()}@nexus.local`);
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(`${primary.toLowerCase()}@nexus.local`);
  await page.getByLabel("Password", { exact: true }).fill("Fixture-pass-123!");
  await page.getByRole("button", { name: "Sign in at Keycloak", exact: true }).click();
  await expect(page).toHaveURL(returnTo);
}
async function staff(browser: Browser, request: APIRequestContext, role: string) {
  const context = await browser.newContext(); const page = await context.newPage();
  await signIn(page, request, role, "/backoffice/manual-payouts");
  return page;
}
async function seed(request: APIRequestContext, body: Record<string, unknown> = {}): Promise<Seeded> {
  const response = await request.post(`${api}/api/test/manual-payouts/seed`, { data: { bankVerified: true, ...body } });
  expect(response.ok()).toBe(true);
  return (await response.json()).data[0];
}
const evidence = async (request: APIRequestContext): Promise<Evidence> => (await (await request.get(`${api}/api/test/manual-payouts/evidence`)).json()).data;
const detailPanel = (page: Page) => page.locator("section").filter({ has: page.getByRole("heading", { name: "Manual payout", exact: true }) });
async function open(page: Page, id: string, view = "All manual payouts") {
  await page.getByLabel("Queue views").getByRole("button", { name: view, exact: true }).click();
  await page.getByRole("button", { name: `Open payout ${id.slice(0, 8)}`, exact: true }).click();
  const panel = detailPanel(page);
  await expect(panel.getByText(id, { exact: true })).toBeVisible();
  return panel;
}
async function layouts(page: Page, name: string) {
  await mkdir(evidenceDir, { recursive: true });
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: path.join(evidenceDir, `${name}-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}
const vietnamMinutesAgo = (minutes: number) => new Date(Date.now() + 7 * 3600_000 - minutes * 60_000).toISOString().slice(0, 16);

test.beforeEach(async ({ request }) => { await request.get(`${api}/keycloak/test/reset`); await request.post(`${api}/api/test/reset`); });

test("claim race, QR, evidence, staff confirmation, seller dispute, Admin correction and retry", async ({ browser, request }) => {
  const payout = await seed(request);
  const admin = await staff(browser, request, "ADMIN");
  const support = await staff(browser, request, "SUPPORT_STAFF");
  const adminPanel = await open(admin, payout.id, "Ready to claim");
  const supportPanel = await open(support, payout.id, "Ready to claim");
  await expect(supportPanel.getByRole("button", { name: "Claim this payout", exact: true })).toBeVisible();
  await adminPanel.getByRole("button", { name: "Claim this payout", exact: true }).click();
  await expect(adminPanel.getByText("You own this payout now.", { exact: false })).toBeVisible();
  await supportPanel.getByRole("button", { name: "Claim this payout", exact: true }).click();
  await expect(supportPanel.getByRole("alert").first()).toBeVisible();
  await expect(supportPanel.getByRole("button", { name: "Claim this payout", exact: true })).toHaveCount(0);
  let state = await evidence(request);
  const claims = state.requests.filter((entry) => entry.path.endsWith(`${payout.id}/claims`));
  expect(claims.map((entry) => entry.actor)).toEqual([identities.ADMIN, identities.SUPPORT_STAFF]);
  expect(claims.every((entry) => /^[0-9a-f-]{36}$/.test(entry.idempotencyKey || ""))).toBe(true);
  expect(state.payouts.find((entry) => entry.id === payout.id)?.attempt?.ownerId).toBe(identities.ADMIN);

  await adminPanel.getByRole("button", { name: "Issue transfer QR", exact: true }).click();
  await expect(adminPanel.getByRole("img", { name: /Transfer QR for reference/ })).toBeVisible();
  await expect(adminPanel.getByText(/left$/)).toBeVisible();
  const upload = adminPanel.getByLabel(/Add evidence/);
  await upload.setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not evidence") });
  await expect(adminPanel.getByText("notes.txt is not a JPEG, PNG or PDF file.", { exact: true })).toBeVisible();
  await upload.setInputFiles({ name: "huge.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(10 * 1024 * 1024 + 1, 37) });
  await expect(adminPanel.getByText("huge.pdf is larger than 10 MiB.", { exact: true })).toBeVisible();
  await upload.setInputFiles({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("plain text pretending") });
  await expect(adminPanel.getByRole("alert").first()).toBeVisible();
  await upload.setInputFiles({ name: "bank-app.png", mimeType: "image/png", buffer: png });
  await adminPanel.getByRole("button", { name: "Open bank-app.png", exact: true }).click();
  await expect(adminPanel.getByRole("link", { name: "Save bank-app.png", exact: true })).toBeVisible();
  state = await evidence(request);
  expect(state.requests.filter((entry) => entry.path.endsWith("/evidence") && entry.method === "POST")).toHaveLength(2);

  await adminPanel.getByRole("button", { name: "Record completed transfer", exact: true }).click();
  const confirm = admin.getByRole("dialog", { name: "Record completed transfer" });
  await confirm.getByLabel("Platform source account").selectOption({ label: "Nexus payout account VCB 8899" });
  await confirm.getByLabel(/Transferred amount/).fill("95000.00");
  await confirm.getByLabel("Bank transfer reference").fill("FT26322001");
  await confirm.getByLabel(/Transferred at/).fill(vietnamMinutesAgo(2));
  await confirm.getByRole("checkbox", { name: "bank-app.png" }).check();
  await confirm.getByRole("button", { name: "Record completed transfer", exact: true }).click();
  await expect(confirm.getByRole("alert")).toHaveText("Confirm that you checked the recipient and the amount in the banking app.");
  await confirm.getByRole("checkbox", { name: /I checked in the banking app/ }).check();
  await confirm.getByRole("button", { name: "Record completed transfer", exact: true }).click();
  await expect(confirm).toHaveCount(0);
  await expect(adminPanel.getByText(/Staff confirmed transfer — awaiting seller confirmation\. This is not a bank verification\./)).toBeVisible();
  await layouts(admin, "admin-confirmed");
  state = await evidence(request);
  expect(state.transactions.filter((entry) => entry.payoutId === payout.id)).toHaveLength(1);
  expect(state.requests.find((entry) => entry.path.endsWith("/confirmation"))?.body).toMatchObject({ amount: "95000.00", bankTransferReference: "FT26322001", sourceAccountId: "9a000000-0000-4000-8000-000000000001" });

  const sellerContext = await browser.newContext(); const seller = await sellerContext.newPage();
  await signIn(seller, request, "SELLER", "/backoffice/payouts");
  await seller.getByRole("row").filter({ hasText: `Payout ${payout.id.slice(0, 8)}` }).getByRole("button", { name: "View payout", exact: true }).click();
  const receipt = seller.getByRole("region", { name: "Payout receipt", exact: true });
  await expect(receipt.getByText(/Staff confirmed transfer — awaiting your confirmation/)).toBeVisible();
  await receipt.getByRole("button", { name: "Not received / Request review", exact: true }).click();
  const dispute = seller.getByRole("dialog", { name: "Request a payout review" });
  await expect(dispute.getByRole("option", { name: "I confirmed receipt by mistake" })).toHaveCount(0);
  await dispute.getByLabel("Reason").selectOption("NOT_RECEIVED");
  await dispute.getByLabel("Explanation").fill("Nothing arrived in my VCB account after two days.");
  await dispute.getByRole("button", { name: "Send review request", exact: true }).click();
  await expect(receipt.getByText("Your review request was sent.", { exact: false })).toBeVisible();
  await expect(receipt.getByText(/Review case · Open · The money has not arrived/)).toBeVisible();
  await layouts(seller, "seller-dispute");

  await adminPanel.getByRole("button", { name: "Close payout", exact: true }).click();
  const reviewPanel = await open(admin, payout.id, "Seller disputes");
  const reconcile = reviewPanel.getByRole("region", { name: "Reconciliation", exact: true });
  await reconcile.getByRole("button", { name: "Review seller case", exact: true }).click();
  const review = admin.getByRole("dialog", { name: "Review seller case" });
  await review.getByLabel("Decision").selectOption("REQUEST_INFORMATION");
  await review.getByLabel("Note to the case").fill("Please check the account statement for 18 Nov.");
  await review.getByRole("button", { name: "Save review", exact: true }).click();
  await expect(review).toHaveCount(0);
  await reconcile.getByRole("button", { name: "Record reconciled outcome", exact: true }).click();
  const resolve = admin.getByRole("dialog", { name: "Record reconciled outcome" });
  await resolve.getByLabel("Outcome").selectOption("CONFIRMATION_RECORDED_IN_ERROR");
  await resolve.getByLabel("Reason").fill("Bank app shows no outgoing transfer for FT26322001.");
  await resolve.getByRole("button", { name: "Record outcome", exact: true }).click();
  await expect(resolve.getByRole("alert")).toBeVisible();
  await resolve.getByRole("checkbox", { name: "bank-app.png" }).check();
  await resolve.getByRole("button", { name: "Record outcome", exact: true }).click();
  await expect(resolve).toHaveCount(0);
  await expect(reconcile.getByText(/Staff confirmation corrected — awaiting authorized retry/)).toBeVisible();
  await reconcile.getByRole("button", { name: "Authorize retry on this payout", exact: true }).click();
  const retry = admin.getByRole("dialog", { name: "Authorize retry" });
  await retry.getByLabel("Authorization reason").fill("Correction recorded; transfer was never sent.");
  await retry.getByRole("button", { name: "Authorize retry", exact: true }).click();
  await expect(retry).toHaveCount(0);
  await expect(reviewPanel.getByText("Retry authorized.", { exact: false })).toBeVisible();
  state = await evidence(request);
  expect(state.payouts.find((entry) => entry.id === payout.id)?.status).toBe("PENDING");
  expect(state.transactions.filter((entry) => entry.payoutId === payout.id).map((entry) => entry.type)).toEqual(["PAYOUT", "PAYOUT_CORRECTION"]);
  expect(state.requests.filter((entry) => entry.path.endsWith("/resolution")).map((entry) => entry.actor)).toEqual([identities.ADMIN]);
});

test("Support cannot reconcile, sellers cannot open the workspace and staff cannot touch their own payout", async ({ browser, request }) => {
  const payout = await seed(request);
  const admin = await staff(browser, request, "ADMIN");
  const adminPanel = await open(admin, payout.id, "Ready to claim");
  await adminPanel.getByRole("button", { name: "Claim this payout", exact: true }).click();
  await adminPanel.getByRole("button", { name: "Issue transfer QR", exact: true }).click();
  await adminPanel.getByRole("button", { name: "Report a problem", exact: true }).click();
  const problem = admin.getByRole("dialog", { name: "Report a problem" });
  await problem.getByLabel("What went wrong").selectOption("UNCERTAIN_OUTCOME");
  await problem.getByLabel("Explanation").fill("The banking app froze after I pressed send.");
  await problem.getByRole("button", { name: "Report problem", exact: true }).click();
  await expect(problem).toHaveCount(0);

  const support = await staff(browser, request, "SUPPORT_STAFF");
  const supportPanel = await open(support, payout.id, "Needs review");
  const reconcile = supportPanel.getByRole("region", { name: "Reconciliation", exact: true });
  await expect(reconcile.getByText(/Only an administrator can resolve, correct or authorize a retry/)).toBeVisible();
  await expect(reconcile.getByRole("button")).toHaveCount(0);
  const attempt = (await evidence(request)).payouts.find((entry) => entry.id === payout.id)?.attempt;
  expect(attempt?.state).toBe("UNKNOWN");
  const direct = await request.post(`${api}/api/v1/payments/manual-payouts/${payout.id}/attempts/${attempt?.id}/resolution`, {
    headers: { Authorization: bearer.get(support) || "", "Idempotency-Key": randomUUID() }, data: { outcome: "CONFIRMED_SENT", reason: "Support should not decide this.", evidenceIds: [], expectedAttemptVersion: attempt?.version } });
  expect(direct.status()).toBe(403);
  expect((await direct.json()).code ?? JSON.stringify(await direct.json())).toContain("PAYMENT_MANUAL_PAYOUT_ADMIN_REQUIRED");
  expect((await evidence(request)).payouts.find((entry) => entry.id === payout.id)?.status).toBe("UNKNOWN");

  const own = await seed(request, { sellerId: identities.ADMIN, bankVerified: false });
  const mixedContext = await browser.newContext(); const mixed = await mixedContext.newPage();
  await signIn(mixed, request, "ADMIN,SELLER", "/backoffice/manual-payouts");
  await expect(mixed.getByRole("link", { name: "My payouts", exact: true })).toBeVisible();
  const ownPanel = await open(mixed, own.id, "On hold");
  await expect(ownPanel.getByText(/This is your own seller payout/)).toBeVisible();
  await expect(ownPanel.getByRole("button", { name: /Claim this payout|Recheck readiness|Refresh payout/ })).toHaveCount(0);

  const sellerContext = await browser.newContext(); const seller = await sellerContext.newPage();
  await signIn(seller, request, "SELLER", "/backoffice/payouts");
  await expect(seller.getByRole("link", { name: "Manual payouts", exact: true })).toHaveCount(0);
  await seller.goto("/backoffice/manual-payouts");
  await expect(seller.getByRole("heading", { name: "Access denied", exact: true })).toBeVisible();
  await expect(seller.getByLabel("Queue views")).toHaveCount(0);
});

test("an expired QR becomes uncertain, paused new work hides claim and QR, readiness releases a held payout", async ({ browser, request }) => {
  const held = await seed(request, { bankVerified: false });
  const payout = await seed(request);
  const admin = await staff(browser, request, "ADMIN");
  let panel = await open(admin, payout.id, "Ready to claim");
  await panel.getByRole("button", { name: "Claim this payout", exact: true }).click();
  await panel.getByRole("button", { name: "Issue transfer QR", exact: true }).click();
  await expect(panel.getByRole("img", { name: /Transfer QR for reference/ })).toBeVisible();
  await request.post(`${api}/api/test/manual-payouts/clock`, { data: { advanceSeconds: 601 } });
  await panel.getByRole("button", { name: "Refresh payout", exact: true }).click();
  await expect(panel.getByText("Attempt 1 · unknown", { exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Record completed transfer", exact: true })).toHaveCount(0);
  await expect(panel.getByRole("img", { name: /Transfer QR for reference/ })).toHaveCount(0);
  await expect(panel.getByText(/Do not transfer again/)).toBeVisible();
  let state = await evidence(request);
  expect(state.payouts.find((entry) => entry.id === payout.id)?.status).toBe("UNKNOWN");

  await panel.getByRole("button", { name: "Close payout", exact: true }).click();
  panel = await open(admin, held.id, "On hold");
  await expect(panel.getByText(/Blocked: The seller has no verified default bank account/)).toBeVisible();
  await request.post(`${api}/api/test/manual-payouts/config`, { data: { newWorkEnabled: false } });
  await admin.reload();
  panel = await open(admin, held.id, "All manual payouts");
  await panel.getByRole("button", { name: "Recheck readiness", exact: true }).click();
  await expect(panel.getByText("Readiness was rechecked.", { exact: false })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Claim this payout", exact: true })).toHaveCount(0);
  await expect(panel.getByText(/New claims and QR issuance are paused/)).toBeVisible();
  state = await evidence(request);
  expect(state.payouts.find((entry) => entry.id === held.id)?.status).toBe("PENDING");
  expect(state.requests.some((entry) => entry.path.endsWith(`${held.id}/claims`))).toBe(false);
  await layouts(admin, "admin-paused");
});
