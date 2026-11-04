import { expect, test, type Locator, type Page, type Route } from "@playwright/test";

const productName = "Gallery product";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const envelope = (data: unknown) => ({
  code: 0,
  message: "response success",
  data,
});
const fulfillJson = (route: Route, data: unknown) =>
  route.fulfill({ headers: corsHeaders, json: data });
const svg = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="480"><rect width="320" height="480" fill="${color}"/></svg>`;
const imageUrl = (color: string) =>
  `data:image/svg+xml,${encodeURIComponent(svg(color))}`;
const images = [
  { id: "last", imageUrl: imageUrl("blue"), sortOrder: 20 },
  { id: "first", imageUrl: imageUrl("red"), sortOrder: 0 },
  { id: "middle", imageUrl: imageUrl("green"), sortOrder: 10 },
];
const detail = (media: typeof images) => ({
  id: "gallery-1",
  name: productName,
  slug: "gallery-product",
  categoryId: "electronics",
  sellerId: "seller-1",
  status: "ACTIVE",
  minPrice: null,
  description: null,
  auctionEnable: false,
  skus: [],
  images: media,
});
const installDetail = async (page: Page, media: typeof images) => {
  const requests: string[] = [];
  await page.route("**/api/v1/products/gallery-1", (route) => {
    requests.push(route.request().url());
    expect(route.request().headers().authorization).toBeUndefined();
    return fulfillJson(route, envelope(detail(media)));
  });
  return requests;
};
const openDetail = (page: Page) =>
  page.goto("/products/gallery-product?id=gallery-1", {
    waitUntil: "domcontentloaded",
  });
const gallery = (page: Page) =>
  page.getByRole("region", { name: `${productName} image gallery` });
const placeholder = (scope: Page | Locator, name = productName) =>
  scope.getByRole("img", { name: `${name} image placeholder`, exact: true });
const expectNoOverflow = async (page: Page) =>
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

const installList = async (page: Page, products: unknown[]) => {
  await page.route("**/api/v1/products?*", (route) =>
    fulfillJson(route, {
      ...envelope(products),
      page: {
        number: 0,
        size: 12,
        totalElements: products.length,
        totalPages: 1,
      },
    }),
  );
};
const summary = (name: string) => ({
  id: name.toLowerCase().replaceAll(" ", "-"),
  name,
  slug: name.toLowerCase().replaceAll(" ", "-"),
  categoryId: "electronics",
  minPrice: 150000,
});

test("three images follow sortOrder, thumbnail clicks and keyboard wrap without another product GET", async ({
  page,
}, info) => {
  const requests = await installDetail(page, images);
  await openDetail(page);
  const main = gallery(page).locator("img");
  const thumbnails = page.getByRole("button", {
    name: new RegExp(`^View ${productName} image \\d+$`),
  });
  await expect(thumbnails).toHaveCount(3);
  await expect(main).toHaveAttribute("src", images[1].imageUrl);
  expect(await thumbnails.locator("img").evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("src")),
  )).toEqual([images[1].imageUrl, images[2].imageUrl, images[0].imageUrl]);
  // Development Strict Mode may mount the query observer twice. Interactions
  // must never add another product request after the initial load settles.
  const initialRequestCount = requests.length;
  await thumbnails.nth(1).click();
  await expect(main).toHaveAttribute("src", images[2].imageUrl);
  await expect(thumbnails.nth(1)).toHaveAttribute("aria-current", "true");
  await thumbnails.nth(2).click();
  await expect(main).toHaveAttribute("src", images[0].imageUrl);
  await gallery(page).press("ArrowRight");
  await expect(main).toHaveAttribute("src", images[1].imageUrl);
  await gallery(page).press("ArrowLeft");
  await expect(main).toHaveAttribute("src", images[0].imageUrl);
  await page.getByRole("button", { name: "Next product image" }).click();
  await expect(main).toHaveAttribute("src", images[1].imageUrl);
  expect(requests).toHaveLength(initialRequestCount);
  await expectNoOverflow(page);
  await gallery(page).locator("..").screenshot({
    path: info.outputPath("gallery-mobile-375.png"),
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expectNoOverflow(page);
  await gallery(page).locator("..").screenshot({
    path: info.outputPath("gallery-desktop.png"),
  });
});

test("cards use the first sorted image and retain placeholders for empty or absent list media", async ({
  page,
}) => {
  const detailRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/v1\/products\//.test(new URL(request.url()).pathname))
      detailRequests.push(request.url());
  });
  // Optional listing media models the #122 response, which is not delivered by
  // this branch's backend yet. Missing media still models the current contract.
  await installList(page, [
    { ...summary("Image card"), images },
    { ...summary("Empty card"), images: [] },
    summary("Legacy card"),
  ]);
  await page.goto("/search");
  const card = page.getByRole("article", { name: "Image card", exact: true });
  await expect(card.locator("img")).toHaveAttribute("src", images[1].imageUrl);
  await expect(card.getByRole("link")).toHaveAttribute(
    "href",
    "/products/image-card?id=image-card",
  );
  for (const name of ["Empty card", "Legacy card"])
    await expect(
      placeholder(page.getByRole("article", { name, exact: true }), name),
    ).toBeVisible();
  expect(detailRequests).toEqual([]);
  await expectNoOverflow(page);
});

test("a detail without images keeps its placeholder and has no thumbnail or arrow controls", async ({
  page,
}) => {
  await installDetail(page, []);
  await openDetail(page);
  await expect(placeholder(gallery(page))).toBeVisible();
  await expect(gallery(page).locator("img")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^View Gallery product image/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^(Previous|Next) product image$/ }),
  ).toHaveCount(0);
  await expectNoOverflow(page);
});

test("404 main images and thumbnails fall back and selection can recover without uncaught errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const brokenUrl = "http://127.0.0.1:3911/gallery-test/missing.svg";
  await page.route(brokenUrl, (route) =>
    route.fulfill({ status: 404, body: "missing" }),
  );
  await installDetail(page, [
    { id: "broken", imageUrl: brokenUrl, sortOrder: 0 },
    images[2],
  ]);
  await openDetail(page);
  await expect(placeholder(gallery(page))).toBeVisible();
  const brokenThumbnail = page.getByRole("button", {
    name: `View ${productName} image 1`,
    exact: true,
  });
  await expect(placeholder(brokenThumbnail)).toBeVisible();
  await page.getByRole("button", {
    name: `View ${productName} image 2`,
    exact: true,
  }).click();
  await expect(gallery(page).locator("img")).toHaveAttribute(
    "src",
    images[2].imageUrl,
  );
  await brokenThumbnail.click();
  await expect(placeholder(gallery(page))).toBeVisible();
  expect(errors).toEqual([]);
});

test("a broken first card image uses the placeholder instead of skipping to another image", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const brokenUrl = "http://127.0.0.1:3911/gallery-test/missing-card.svg";
  await page.route(brokenUrl, (route) =>
    route.fulfill({ status: 404, body: "missing" }),
  );
  await installList(page, [{
    ...summary("Broken card"),
    images: [
      images[2],
      { id: "broken", imageUrl: brokenUrl, sortOrder: 0 },
    ],
  }]);
  await page.goto("/search");
  const card = page.getByRole("article", { name: "Broken card", exact: true });
  await expect(placeholder(card, "Broken card")).toBeVisible();
  await expect(card.locator("img")).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const outcome of ["loaded", "404"] as const)
  test(`375px gallery reserves the same space before and after an image is ${outcome}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    let release: () => void = () => {};
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    const url = `http://127.0.0.1:3911/gallery-test/delayed-${outcome}.svg`;
    await page.route(url, async (route) => {
      await delayed;
      await route.fulfill({
        status: outcome === "loaded" ? 200 : 404,
        contentType: "image/svg+xml",
        body: outcome === "loaded" ? svg("purple") : "missing",
      });
    });
    await installDetail(page, [{ id: "delayed", imageUrl: url, sortOrder: 0 }]);
    try {
      const requested = page.waitForRequest(url);
      await openDetail(page);
      await requested;
      await expect(gallery(page)).toBeVisible();
      const before = await gallery(page).boundingBox();
      const details = page.getByRole("region", { name: "Product details", exact: true });
      const detailsBefore = await details.boundingBox();
      expect(before).not.toBeNull();
      expect(detailsBefore).not.toBeNull();
      expect(Math.abs(before!.width - before!.height)).toBeLessThanOrEqual(1);
      await expectNoOverflow(page);
      release();
      if (outcome === "loaded")
        await expect.poll(() => gallery(page).locator("img").evaluate(
          (element) => (element as HTMLImageElement).naturalWidth,
        )).toBeGreaterThan(0);
      else await expect(placeholder(gallery(page))).toBeVisible();
      const after = await gallery(page).boundingBox();
      const detailsAfter = await details.boundingBox();
      expect(after).not.toBeNull();
      expect(detailsAfter).not.toBeNull();
      for (const dimension of ["x", "y", "width", "height"] as const)
        expect(Math.abs(after![dimension] - before![dimension])).toBeLessThanOrEqual(1);
      expect(Math.abs(detailsAfter!.y - detailsBefore!.y)).toBeLessThanOrEqual(1);
      await expectNoOverflow(page);
    } finally {
      release();
    }
  });
