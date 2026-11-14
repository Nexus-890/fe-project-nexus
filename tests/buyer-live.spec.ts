import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";

test.skip(!process.env.NEXUS_LIVE_BUYER_TEST, "Requires real catalog, commerce and rating service jars plus dedicated PostgreSQL databases.");
const provider = `http://127.0.0.1:${process.env.NEXUS_TEST_PROVIDER_PORT || "3993"}`;
const router = `http://127.0.0.1:${process.env.NEXUS_LIVE_ROUTER_PORT || "3994"}`;
const orderId = "68220000-0000-4000-8000-000000000301";

test("browser searches PostgreSQL and confirms then rates an order through real service HTTP", async ({ page, request }, info) => {
  expect((await request.post(`${router}/test/reset`)).ok()).toBe(true);
  expect((await request.get(`${provider}/keycloak/test/reset`)).ok()).toBe(true);
  expect((await request.get(`${provider}/api/test/reset`)).ok()).toBe(true);
  const permissions = "PROFILE.VIEW,ORDER.LIST,ORDER.VIEW,REPUTATION.VIEW,REPUTATION.RATE";
  expect((await request.get(`${provider}/keycloak/test/control?roles=BUYER&privileges=${encodeURIComponent(permissions)}`)).ok()).toBe(true);

  await page.goto("/search?q=Nexus220+Tablet&sort=price%2Casc");
  await expect(page.getByText("14 results", { exact: true })).toBeVisible();
  const products = page.getByRole("region", { name: "Search results", exact: true }).getByRole("article");
  await expect(products).toHaveCount(12);
  await expect(products.first()).toContainText("Nexus220 Tablet 01");
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await expect(products).toHaveCount(2);
  await expect(products.first()).toContainText("Nexus220 Tablet 13");
  await page.getByRole("combobox", { name: "Sort by", exact: true }).selectOption("price,desc");
  await expect(products.first()).toContainText("Nexus220 Tablet 14");
  await expect.poll(() => new URL(page.url()).searchParams.has("page")).toBe(false);
  await page.goto("/search?q=Nexus220+missing");
  await expect(page.getByRole("heading", { name: "No products found", exact: true })).toBeVisible();

  await page.goto(`/sign-in?returnTo=${encodeURIComponent(`/order/${orderId}`)}`);
  await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("buyer@nexus.local");
  await page.getByLabel("Password", { exact: true }).fill("Fixture-pass-123!");
  await page.getByRole("button", { name: "Sign in at Keycloak", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Order NX-LIVE-220", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Order received", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Rate the seller", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Order received", exact: true }).click();
  await page.getByRole("button", { name: "Confirm receipt", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Receipt confirmed. Your order is completed." })).toBeVisible();
  await expect(page.getByRole("region", { name: "Order history", exact: true })).toContainText("Buyer confirmed receipt");
  // Deliver the committed event projection explicitly; this harness does not exercise a Kafka broker.
  expect((await request.post(`${router}/test/project-completion`)).ok()).toBe(true);
  await page.getByRole("button", { name: "Rate the seller", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Rate the seller", exact: true });
  await dialog.getByRole("radio", { name: "4 stars", exact: true }).check();
  await dialog.getByLabel("Review (optional)", { exact: true }).fill("Verified against the real rating service.");
  await dialog.getByRole("button", { name: "Submit Rating", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "You rated this seller 4 out of 5." })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "You rated this seller 4 out of 5." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Rate the seller", exact: true })).toHaveCount(0);

  await page.goto("/products/nexus220-tablet-01?id=68220000-0000-4000-8000-000000000101");
  const seller = page.getByRole("region", { name: "Seller reputation", exact: true });
  await expect(seller).toContainText("78/100");
  await expect(seller).toContainText("Trusted");
  const evidence = await (await request.get(`${router}/test/evidence`)).json();
  expect(evidence.database).toEqual({ completed: 1, completionHistories: 1, completionEvents: 1, ratings: 1, ratingEvents: 1 });
  expect(evidence.calls).toEqual(expect.arrayContaining([
    expect.objectContaining({ method: "GET", service: "catalog", path: "/api/v1/products", status: 200 }),
    expect.objectContaining({ method: "POST", service: "commerce", path: `/api/v1/orders/${orderId}/confirm-receipt`, status: 200 }),
    expect.objectContaining({ method: "POST", service: "rating", path: "/api/v1/ratings", status: 201 }),
  ]));
  const evidencePath = info.outputPath("real-service-and-postgresql-evidence.json");
  await writeFile(evidencePath, JSON.stringify(evidence, null, 2));
  await info.attach("real-service-and-postgresql-evidence", { path: evidencePath, contentType: "application/json" });
});
