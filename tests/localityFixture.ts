import type { Page, Route } from "@playwright/test";

export const fixtureProvince = { code: "1000001", name: "Hồ Chí Minh" };
export const fixtureWard = { code: "1003001", name: "Phường Sài Gòn" };

export const fixtureAddress = (street: string) => `${street}, ${fixtureWard.name}, ${fixtureProvince.name}`;

export async function mockLocalities(page: Page) {
  const reply = (route: Route, data: unknown) => {
    const origin = route.request().headers().origin;
    return route.fulfill({
      json: { code: 0, message: "response success", data, page: { number: 0, size: 1, totalElements: 1, totalPages: 1 } },
      headers: origin ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true", Vary: "Origin" } : {},
    });
  };
  await page.route("**/api/v1/shipping/provinces", (route) => reply(route, [fixtureProvince]));
  await page.route("**/api/v1/shipping/wards?*", (route) => reply(route, [fixtureWard]));
}

export async function fillLocalityAddress(page: Page, street: string) {
  await page.getByRole("combobox", { name: "Province or city", exact: true }).selectOption({ label: fixtureProvince.name });
  await page.getByRole("combobox", { name: "Ward or commune", exact: true }).selectOption({ label: fixtureWard.name });
  await page.getByLabel("House number and street", { exact: true }).fill(street);
}
