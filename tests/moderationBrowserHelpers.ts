import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const moderationApi = `http://127.0.0.1:${process.env.NEXUS_BACKOFFICE_API_PORT || "3944"}`;
export async function signInModeration(page: Page, request: APIRequestContext, role = "ADMIN", destination = "/backoffice/notification-deliveries", subject?: string) {
  // Compile the callback before OAuth changes history; cold dev compilation can otherwise trigger HMR during the exchange.
  expect((await request.get("/auth/callback")).ok()).toBe(true);
  expect((await request.get(`${moderationApi}/keycloak/test/control`, { params: { roles: role, ...(subject ? { subject } : {}) } })).ok()).toBe(true);
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(destination)}`);
  await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(`${role.toLowerCase()}@nexus.local`);
  await page.getByLabel("Password", { exact: true }).fill("Fixture-pass-123!");
  await page.getByRole("button", { name: "Sign in at Keycloak", exact: true }).click();
  await expect(page).toHaveURL(destination, { timeout: 30_000 });
}
