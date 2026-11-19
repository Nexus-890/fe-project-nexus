import { expect, test, type Page } from "@playwright/test";
import { moderationApi, signInModeration } from "./moderationBrowserHelpers";

const userId = "68000000-0000-4000-8000-000000000004";
const adminId = "68000000-0000-4000-8000-000000000001";
const ratingId = "68000000-0000-4000-8000-000000000006";
const restrictionId = "68000000-0000-4000-8000-000000000007";
const disputeId = "68000000-0000-4000-8000-000000000008";
const headers = { "access-control-allow-origin": "*", "content-type": "application/json" };
const envelope = (data: unknown) => ({ code: 0, message: "response success", data });
const pageEnvelope = (data: unknown[]) => ({ ...envelope(data), page: { number: 0, size: 20, totalElements: data.length, totalPages: data.length ? 1 : 0 } });
const rating = { id: ratingId, orderId: "68000000-0000-4000-8000-000000000002", auctionId: null, score: 1, comment: "Package review", raterName: "B***r", ratedByMe: false, createdAt: "2026-11-19T01:00:00Z", disputeStatus: null };
const dispute = { id: disputeId, ratingId, userId, reason: "The review concerns a different order.", status: "PENDING", createdAt: "2026-11-19T02:00:00Z", resolvedAt: null as string | null, resolvedBy: null as string | null, resolutionReason: null as string | null, ratingScore: 1, ratingComment: "Package review" };

async function inbox(page: Page) {
  await page.route(`${moderationApi}/api/v1/notifications**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/stream")) return route.fulfill({ contentType: "text/event-stream", body: 'event: notifications\ndata: {"unreadCount":0,"revision":"test"}\n\n' });
    return route.fulfill({ headers, json: path.endsWith("/unread-count") ? envelope({ count: 0 }) : pageEnvelope([]) });
  });
}

test.beforeEach(async ({ request }) => {
  expect((await request.get(`${moderationApi}/keycloak/test/reset`)).ok()).toBe(true);
  expect((await request.post(`${moderationApi}/api/test/reset`)).ok()).toBe(true);
});

test("admin adds and revokes a restriction with audit reasons and sees all transaction counts", async ({ page, request }) => {
  await inbox(page);
  await page.route(`${moderationApi}/api/v1/users?*`, (route) => route.fulfill({ headers, json: pageEnvelope([{ id: userId, fullName: "Seller under review", email: "seller@example.com", phone: "0901234567", gender: "OTHER", address: "1 Demo Street", dateOfBirth: "2000-01-01", roles: ["SELLER"], status: "ACTIVE", createdAt: "2026-11-01T00:00:00Z" }]) }));
  const rows: Record<string, unknown>[] = [];
  const writes: { method: string; body: unknown; reason: string | null }[] = [];
  await page.route(`${moderationApi}/api/v1/reputations/**`, async (route) => {
    const req = route.request(), url = new URL(req.url());
    expect(req.headers().authorization).toMatch(/^Bearer /);
    if (url.pathname.includes("/restrictions")) {
      if (req.method() === "POST") {
        const body = req.postDataJSON(); writes.push({ method: "POST", body, reason: null });
        rows.push({ id: restrictionId, userId, ...body, createdAt: new Date().toISOString(), createdBy: adminId, revokedAt: null, revokedBy: null, revocationReason: null, active: true });
        return route.fulfill({ status: 201, headers, json: envelope(rows[0]) });
      }
      if (req.method() === "DELETE") {
        writes.push({ method: "DELETE", body: null, reason: url.searchParams.get("reason") });
        Object.assign(rows[0], { active: false, revokedAt: new Date().toISOString(), revokedBy: adminId, revocationReason: url.searchParams.get("reason") });
        return route.fulfill({ headers, json: envelope(rows[0]) });
      }
      return route.fulfill({ headers, json: pageEnvelope(rows) });
    }
    return route.fulfill({ headers, json: envelope({ userId, score: 78, trustLevel: "TRUSTED", totalTransaction: 42, successfulTransaction: 40, failedTransaction: 2, ratingCount: 20, policyVersion: "reputation-policy-1" }) });
  });
  await signInModeration(page, request, "ADMIN", "/backoffice/reputations");
  await page.getByRole("button", { name: "Manage reputation for Seller under review" }).click();
  await expect(page.getByRole("region", { name: "Transaction summary" })).toContainText("40 successful transactions · 2 failed · 42 total");
  await page.getByLabel("Restricted until (your local time)").fill("2030-01-01T12:00");
  await page.getByLabel("Restriction reason", { exact: true }).fill("Repeated auction payment violations");
  await page.getByRole("button", { name: "Add restriction", exact: true }).click();
  await expect(page.getByText("Restriction added.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Remove restriction", exact: true }).click();
  await page.getByLabel("Removal reason", { exact: true }).fill("Reviewed supporting evidence");
  await page.getByRole("button", { name: "Confirm removal", exact: true }).click();
  await expect(page.getByText("Restriction removed.", { exact: true })).toBeVisible();
  await expect(page.getByText("Removal reason: Reviewed supporting evidence", { exact: true })).toBeVisible();
  expect(writes[0]).toMatchObject({ method: "POST", body: { action: "BID", reason: "Repeated auction payment violations" } });
  expect(writes[1]).toEqual({ method: "DELETE", body: null, reason: "Reviewed supporting evidence" });
  await page.setViewportSize({ width: 375, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/notification-settings/restrictions-mobile.png", fullPage: true });
});

test("recipient submits a rating dispute and its status survives reload", async ({ page, request }) => {
  await inbox(page);
  let status: string | null = null;
  let recipient = userId;
  const writes: unknown[] = [];
  await page.route(`${moderationApi}/api/v1/ratings**`, (route) => {
    const req = route.request(), url = new URL(req.url());
    if (req.method() === "POST") {
      writes.push(req.postDataJSON()); status = "PENDING";
      return route.fulfill({ status: 201, headers, json: envelope({ ...dispute, userId: recipient }) });
    }
    recipient = url.searchParams.get("userId") || userId;
    return route.fulfill({ headers, json: pageEnvelope([{ ...rating, disputeStatus: status }]) });
  });
  await signInModeration(page, request, "SELLER", "/ratings");
  await page.getByRole("button", { name: "Dispute rating", exact: true }).click();
  await page.getByLabel("Dispute reason", { exact: true }).fill(dispute.reason);
  await page.getByRole("button", { name: "Submit dispute", exact: true }).click();
  await expect(page.getByText("Your dispute was submitted for review.", { exact: true })).toBeVisible();
  expect(writes).toEqual([{ reason: dispute.reason }]);
  await page.reload();
  await expect(page.getByText("Dispute status: PENDING", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dispute submitted", exact: true })).toBeDisabled();
});

test("admin approval removes a pending dispute and the approved view shows its decision", async ({ page, request }) => {
  await inbox(page);
  let current = { ...dispute };
  await page.route(`${moderationApi}/api/v1/ratings/disputes**`, (route) => {
    const req = route.request(), url = new URL(req.url());
    if (req.method() === "PATCH") {
      const body = req.postDataJSON();
      expect(body).toEqual({ status: "APPROVED", reason: "Evidence confirms the rating is unrelated." });
      current = { ...current, status: body.status, resolvedAt: "2026-11-19T03:00:00Z", resolvedBy: adminId, resolutionReason: body.reason };
      return route.fulfill({ headers, json: envelope(current) });
    }
    return route.fulfill({ headers, json: pageEnvelope(!url.searchParams.get("status") || url.searchParams.get("status") === current.status ? [current] : []) });
  });
  await signInModeration(page, request, "ADMIN", "/backoffice/rating-disputes");
  await page.getByRole("button", { name: /Review dispute/ }).click();
  await page.getByRole("combobox", { name: "Decision", exact: true }).selectOption("APPROVED");
  await page.getByLabel("Decision reason", { exact: true }).fill("Evidence confirms the rating is unrelated.");
  await page.getByRole("button", { name: "Save decision", exact: true }).click();
  await expect(page.getByText("Dispute approved. The rating is hidden and its impact on reputation has been removed.", { exact: true })).toBeVisible();
  await expect(page.getByText("No rating disputes", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Dispute status", exact: true }).selectOption("APPROVED");
  await expect(page.getByText("Decision reason: Evidence confirms the rating is unrelated.", { exact: true })).toBeVisible();
});
