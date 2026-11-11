import { expect, test, type Page } from "@playwright/test";

const productId = "92000000-0000-4000-8000-000000000201";
const imagePath = `/api/v1/products/${productId}/images`;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==", "base64");

async function signIn(page: Page) {
  await page.route("**/api/v1/users/me", (route) => route.fulfill({ json: {
    code: 0, message: "response success", data: {
      id: "68000000-0000-4000-8000-000000000002", email: "seller@example.test",
      fullName: "Media Seller", phone: "0900000002", roles: ["SELLER"],
      status: "ACTIVE", gender: null, address: null, dateOfBirth: null, createdAt: "2026-11-03T00:00:00Z",
    },
  } }));
  await page.goto("/sign-in?returnTo=%2Fsell%2Fimages");
  await page.getByRole("button", { name: "Continue to sign in", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill("seller@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Fixture-pass-123!");
  await page.getByRole("button", { name: "Sign in at Keycloak", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Product images", exact: true })).toBeVisible();
  await page.getByLabel("Product ID", { exact: true }).fill(productId);
}

test("seller media form validates files, sends multipart and renders the returned image", async ({ page }) => {
  let uploads = 0;
  // The actual BE returns HTTP(S) URLs; keep the fixture HTTP and image bytes deterministic.
  await page.route("https://media.example.test/uploaded.png", (route) => route.fulfill({ contentType: "image/png", body: png }));
  await page.route(`**${imagePath}`, async (route) => {
    uploads++;
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers().authorization).toMatch(/^Bearer .+/);
    expect(route.request().headers()["content-type"]).toMatch(/^multipart\/form-data; boundary=/);
    expect(route.request().postDataBuffer()?.toString()).toContain('name="file"; filename="sample.png"');
    await route.fulfill({ status: 201, json: { code: 0, message: "response success", data: {
      id: "photo-1", imageUrl: "https://media.example.test/uploaded.png", sortOrder: 1,
    } } });
  });
  await signIn(page);
  await page.getByLabel("Product photo", { exact: true }).setInputFiles({ name: "invalid.txt", mimeType: "text/plain", buffer: Buffer.from("invalid") });
  await page.getByRole("button", { name: "Upload photo", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Choose a JPEG, PNG or WebP image up to 5 MB." })).toBeVisible();
  expect(uploads).toBe(0);
  await page.getByLabel("Product photo", { exact: true }).setInputFiles({ name: "sample.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Upload photo", exact: true }).click();
  await expect(page.getByText("Photo uploaded successfully", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Uploaded product photo", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "View uploaded image", exact: true })).toHaveAttribute("href", "https://media.example.test/uploaded.png");
  expect(uploads).toBe(1);
});

test("seller media form reports ownership and storage failures and can retry", async ({ page }) => {
  let uploads = 0;
  await page.route(`**${imagePath}`, (route) => {
    uploads++;
    const status = uploads === 1 ? 403 : 503;
    return route.fulfill({ status, contentType: "application/problem+json", json: {
      type: "https://nexus/errors/media", title: status === 403 ? "Forbidden" : "Unavailable", status,
      code: status === 403 ? "CATALOG_PRODUCT_FORBIDDEN" : "CATALOG_IMAGE_STORAGE_UNAVAILABLE",
      detail: status === 403 ? "This product belongs to another seller." : "Image storage is temporarily unavailable.",
    } });
  });
  await signIn(page);
  await page.getByLabel("Product photo", { exact: true }).setInputFiles({ name: "sample.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Upload photo", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "This product belongs to another seller." })).toBeVisible();
  await page.getByRole("button", { name: "Upload photo", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Image storage is temporarily unavailable." })).toBeVisible();
  await expect(page.getByText("Photo uploaded successfully", { exact: true })).toHaveCount(0);
  expect(uploads).toBe(2);
});
