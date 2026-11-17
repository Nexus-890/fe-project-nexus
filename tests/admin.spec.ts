import { expect, test, type Page, type APIRequestContext } from "@playwright/test";

test.skip(!process.env.NEXUS_ADMIN_TEST, "Run through playwright.admin.config.ts against the explicit HTTP simulation.");
const api = `http://127.0.0.1:${process.env.NEXUS_BACKOFFICE_API_PORT || "3920"}`;
type Evidence = { requests: { method: string; path: string; body: Record<string, unknown>; query: Record<string, string>; roles: string[]; authenticated: boolean }[]; healthReads: number; users: { email: string; fullName: string; roles: string[] }[]; applications: { companyName: string; status: string; reason: string | null }[] };
const evidence = async (request: APIRequestContext): Promise<Evidence> => (await (await request.get(`${api}/api/test/admin-evidence`)).json()).data;
async function signIn(page: Page, request: APIRequestContext, role = "ADMIN", destination = "/backoffice/users") {
  expect((await request.get(`${api}/keycloak/test/control`, { params: { roles: role } })).ok()).toBe(true);
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(destination)}`);
  await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(`${role.toLowerCase()}@nexus.local`);
  await page.getByLabel("Password", { exact: true }).fill("Fixture-pass-123!");
  await page.getByRole("button", { name: "Sign in at Keycloak", exact: true }).click();
  await expect(page).toHaveURL(destination);
}
async function userAction(page: Page, action: string, name = "Nguyễn Thị Lan") {
  await page.getByLabel(`Actions for ${name}`, { exact: true }).click();
  await page.getByRole("button", { name: action, exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
async function screenshots(page: Page, name: string) {
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
    await page.screenshot({ path: `test-results/admin/${name}-${width}.png`, fullPage: true, style: "nextjs-portal { visibility: hidden !important; }" });
    const overflow = await page.evaluate(() => {
      const viewport = innerWidth;
      const elements = Array.from(document.querySelectorAll<HTMLElement>("body *")).flatMap((element) => {
        const bounds = element.getBoundingClientRect();
        if (bounds.right <= viewport + 1) return [];
        for (let ancestor = element.parentElement; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
          const overflowX = getComputedStyle(ancestor).overflowX;
          const frame = ancestor.getBoundingClientRect();
          if (["auto", "scroll", "hidden", "clip"].includes(overflowX) && frame.right <= viewport + 1 && frame.left >= 0) return [];
        }
        const style = getComputedStyle(element);
        return [{ tag: element.tagName, className: element.className, right: Math.round(bounds.right), width: Math.round(bounds.width), minWidth: style.minWidth, display: style.display, overflowX: style.overflowX }];
      }).slice(0, 25);
      return { documentWidth: document.documentElement.scrollWidth, viewport, elements };
    });
    expect(overflow.documentWidth <= overflow.viewport, `Document overflow: ${JSON.stringify(overflow)}`).toBe(true);
  }
}
test.beforeEach(async ({ request }) => {
  expect((await request.get(`${api}/keycloak/test/reset`)).ok()).toBe(true);
  expect((await request.post(`${api}/api/test/reset`)).ok()).toBe(true);
});

test("anonymous access redirects and does not read private administration data", async ({ page, request }) => {
  await page.goto("/backoffice/audit-logs");
  await expect(page).toHaveURL(/\/sign-in\?returnTo=/);
  expect((await evidence(request)).requests).toEqual([]);
});

test("Admin searches and edits users, assigns roles, sets password, unlocks and deletes through exact APIs", async ({ page, request }) => {
  await signIn(page, request);
  await expect(page.getByText("lan.nguyen@example.com", { exact: true })).toBeVisible();
  await screenshots(page, "users");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("searchbox", { name: "Search users by name or email" }).fill("lan.nguyen@example.com");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect.poll(async () => (await evidence(request)).requests.at(-1)?.query.q).toBe("lan.nguyen@example.com");
  await userAction(page, "Edit User");
  await page.getByRole("dialog").getByLabel("Full name", { exact: true }).fill("Lan Updated");
  await page.getByRole("dialog").getByRole("button", { name: "Edit User", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Lan Updated", { exact: true })).toBeVisible();
  await userAction(page, "Change Roles", "Lan Updated");
  await page.getByRole("dialog").getByLabel("Seller", { exact: true }).check();
  await page.getByRole("dialog").getByRole("button", { name: "Change Roles", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await userAction(page, "Set Password", "Lan Updated");
  await page.getByLabel("New password", { exact: true }).fill("Changed-fixture-123!");
  await page.getByRole("dialog").getByRole("button", { name: "Set Password", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await userAction(page, "Unlock User", "Lan Updated");
  await page.getByRole("dialog").getByRole("button", { name: "Unlock User", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await userAction(page, "Delete User", "Lan Updated");
  await page.getByRole("dialog").getByRole("button", { name: "Delete User", exact: true }).click();
  await expect(page.getByText("No users found", { exact: true })).toBeVisible();
  const actual = await evidence(request);
  expect(actual.requests.every((row) => row.authenticated)).toBe(true);
  expect(actual.requests.find((row) => /\/users\/[^/]+$/.test(row.path) && row.method === "PUT")?.body).toEqual({
    fullName: "Lan Updated", email: "lan.nguyen@example.com", address: "Ho Chi Minh City", dateOfBirth: "2000-01-01", gender: "FEMALE",
  });
  expect(actual.requests.find((row) => row.path.endsWith("/roles") && row.method === "PUT")?.body).toEqual({ roleCodes: ["BUYER", "SELLER"] });
  for (const [method, suffix] of [["PUT", "/password"], ["POST", "/unlock"], ["DELETE", "000000000001"]])
    expect(actual.requests.some((row) => row.method === method && row.path.endsWith(suffix))).toBe(true);
});

test("Admin creates a user and role/status filters return the requested account", async ({ page, request }) => {
  await signIn(page, request);
  await page.getByLabel("Filter users by status").selectOption("LOCKED");
  await expect(page.getByText("bao.tran@example.com", { exact: true })).toBeVisible();
  await expect(page.getByText("lan.nguyen@example.com", { exact: true })).toHaveCount(0);
  await page.getByLabel("Filter users by status").selectOption("ACTIVE");
  await expect(page.getByText("lan.nguyen@example.com", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Create User", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name", { exact: true }).fill("New Staff");
  await dialog.getByLabel("Email", { exact: true }).fill("new.staff@example.com");
  await dialog.getByLabel("Phone", { exact: true }).fill("0901234569");
  await dialog.getByLabel("Identity number", { exact: true }).fill("079200000227");
  await dialog.getByLabel("Initial password", { exact: true }).fill("Initial-fixture-123!");
  await dialog.getByLabel("Gender").selectOption("OTHER");
  await dialog.getByLabel("Date of birth", { exact: true }).fill("2000-01-01");
  await dialog.getByLabel("Address", { exact: true }).fill("Ho Chi Minh City");
  await dialog.getByLabel("Support Staff", { exact: true }).check();
  await dialog.getByRole("button", { name: "Create User", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByLabel("Filter users by role").selectOption("SUPPORT_STAFF");
  await expect(page.getByText("New Staff", { exact: true })).toBeVisible();
  await expect(page.getByText("lan.nguyen@example.com", { exact: true })).toHaveCount(0);
  expect((await evidence(request)).users.find((user) => user.email === "new.staff@example.com")?.roles).toEqual(["BUYER", "SUPPORT_STAFF"]);
  const writes = (await evidence(request)).requests.filter((row) => row.path === "/api/v1/users" && row.method === "POST");
  expect(writes).toHaveLength(1);
  expect(writes[0].body).toEqual({ fullName: "New Staff", email: "new.staff@example.com", phone: "0901234569", identityNumber: "079200000227", gender: "OTHER", address: "Ho Chi Minh City", dateOfBirth: "2000-01-01", roleCodes: ["BUYER", "SUPPORT_STAFF"] });
});

test("Support can search and edit but cannot mutate roles, approve sellers or read audit", async ({ page, request }) => {
  await signIn(page, request, "SUPPORT_STAFF");
  const nav = page.getByRole("navigation", { name: "Back-office navigation" });
  await expect(nav.getByRole("link", { name: "Audit Logs", exact: true })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Seller Applications", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create User", exact: true })).toHaveCount(0);
  await page.getByRole("searchbox", { name: "Search users by name or email" }).fill("lan.nguyen@example.com");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect.poll(async () => (await evidence(request)).requests.at(-1)?.query.q).toBe("lan.nguyen@example.com");
  await page.getByLabel("Actions for Nguyễn Thị Lan").click();
  for (const action of ["Set Password", "Change Roles", "Delete User", "Unlock User"])
    await expect(page.getByRole("button", { name: action, exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Edit User", exact: true }).click();
  await page.getByLabel("Full name", { exact: true }).fill("Support Updated");
  await page.getByRole("dialog").getByRole("button", { name: "Edit User", exact: true }).click();
  await expect(page.getByText("Support Updated", { exact: true })).toBeVisible();
  for (const path of ["audit-logs", "seller-applications"]) {
    await page.goto(`/backoffice/${path}`);
    await expect(page.getByRole("heading", { name: "Access denied", exact: true })).toBeVisible();
  }
  expect((await evidence(request)).requests.some((row) => /audit-logs|sellers\/applications/.test(row.path))).toBe(false);
  expect((await evidence(request)).requests.filter((row) => row.method !== "GET")).toEqual([
    expect.objectContaining({ method: "PUT", path: "/api/v1/users/b2270000-0000-4000-8000-000000000001", roles: ["SUPPORT_STAFF"] }),
  ]);
});

test("event filters and full payload/envelope match captured data; Admin audit is read-only", async ({ page, request }) => {
  await signIn(page, request, "ADMIN", "/backoffice/event-logs");
  await page.getByRole("button", { name: "ShipmentFailed", exact: true }).click();
  await expect(page.getByLabel("Event payload", { exact: true })).toContainText("Carrier unavailable");
  await page.getByRole("button", { name: "Full envelope", exact: true }).click();
  await expect(page.getByLabel("Full event envelope", { exact: true })).toContainText("extraField");
  await page.getByRole("button", { name: "Original JSON", exact: true }).click();
  await expect(page.getByLabel("Original event JSON", { exact: true })).toContainText('"attempts":[1,2]');
  await screenshots(page, "event-logs");
  await page.getByLabel("Search event logs", { exact: true }).fill("no match");
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(page.getByText("No events found", { exact: true })).toBeVisible();
  await page.goto("/backoffice/audit-logs");
  await expect(page.getByRole("rowheader", { name: "UserRoleAssigned", exact: true })).toBeVisible();
  await screenshots(page, "audit-logs");
  expect((await evidence(request)).requests.filter((row) => row.path.includes("audit-logs")).every((row) => row.method === "GET")).toBe(true);
});

test("health renders every service and broker, polls at ten seconds and preserves outage feedback", async ({ page, request }) => {
  await signIn(page, request, "SUPPORT_STAFF", "/backoffice/health");
  await expect(page.getByRole("heading", { name: "Message Broker · kafka", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "shipment-service", exact: true })).toBeVisible();
  for (const service of ["user-service", "catalog-service", "commerce-service", "auction-service", "payment-service", "inventory-service", "notification-service", "rating-service", "api-gateway", "config-service", "discovery-service", "keycloak"])
    await expect(page.getByRole("heading", { name: service, exact: true })).toBeVisible();
  await expect(page.getByText("1 unavailable", { exact: true })).toBeVisible();
  const before = (await evidence(request)).healthReads;
  await expect.poll(async () => (await evidence(request)).healthReads, { timeout: 14_000, intervals: [1000] }).toBeGreaterThan(before);
  await screenshots(page, "health");
  expect((await request.post(`${api}/api/test/admin-control`, { data: { failure: "system/health" } })).ok()).toBe(true);
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByRole("alert").first()).toContainText("Temporary upstream outage");
  await expect(page.getByText("Service statuses below are from the last successful refresh.", { exact: true })).toBeVisible();
});

test("Admin approves and rejects applications with a reason and authoritative status refetch", async ({ page, request }) => {
  await signIn(page, request, "ADMIN", "/backoffice/seller-applications");
  await expect(page.getByRole("heading", { name: "Seller applications", exact: true })).toBeVisible();
  await screenshots(page, "seller-applications");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("row").filter({ hasText: "Lan Audio" }).getByRole("button", { name: "Approve", exact: true }).click();
  await page.getByRole("button", { name: "Confirm approval", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Application approved. The buyer can sign in again to access the seller back office.", { exact: true })).toBeVisible();
  await page.getByRole("row").filter({ hasText: "Bao Books" }).getByRole("button", { name: "Reject", exact: true }).click();
  await expect(page.getByRole("button", { name: "Confirm rejection", exact: true })).toBeDisabled();
  await page.getByLabel("Rejection reason (required)").fill("Please clarify the registered company details.");
  await page.getByRole("button", { name: "Confirm rejection", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Status").selectOption("REJECTED");
  await expect(page.getByText("Please clarify the registered company details.", { exact: false })).toBeVisible();
  const actual = await evidence(request);
  expect(actual.applications.find((entry) => entry.companyName === "Lan Audio")?.status).toBe("ACTIVE");
  expect(actual.applications.find((entry) => entry.companyName === "Bao Books")?.reason).toBe("Please clarify the registered company details.");
  expect(actual.requests.filter((row) => /\/sellers\/applications\/[^/]+\/(?:approve|reject)$/.test(row.path))).toEqual([
    expect.objectContaining({ method: "POST", path: "/api/v1/sellers/applications/b2270000-0000-4000-8000-000000000010/approve", body: {}, roles: ["ADMIN"] }),
    expect.objectContaining({ method: "POST", path: "/api/v1/sellers/applications/b2270000-0000-4000-8000-000000000011/reject", body: { reason: "Please clarify the registered company details." }, roles: ["ADMIN"] }),
  ]);
});
