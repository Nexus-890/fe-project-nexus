import assert from "node:assert/strict";
import { test } from "node:test";
import { getProducts, parseProductPage } from "../service/catalogService";
import { sortProductImages } from "../components/productImageUtils";

const images = [
  { id: "back", imageUrl: "https://example.test/back.jpg", sortOrder: 20 },
  { id: "front", imageUrl: "https://example.test/front.jpg", sortOrder: 0 },
  { id: "side", imageUrl: "https://example.test/side.jpg", sortOrder: 10 },
];
const summary = { id: "product", name: "Watch", slug: "watch", minPrice: 100 };
const envelope = (data: unknown[]) => ({
  code: 0,
  message: "response success",
  data,
  page: { number: 0, size: 12, totalElements: data.length, totalPages: 1 },
});

test("list service retains optional image media and keeps the delivered URL and public auth policy", async () => {
  const result = await getProducts({}, {
    context: {
      getAccessToken: () => "must-not-send",
      fetch: async (input, init) => {
        assert.equal(String(input), "/api/v1/products");
        assert.equal(new Headers(init?.headers).has("Authorization"), false);
        return new Response(JSON.stringify(envelope([{ ...summary, images }])));
      },
    },
  });
  assert.deepEqual(result.content[0].images, images);
  assert.deepEqual(sortProductImages(result.content[0].images).map((image) => image.id), ["front", "side", "back"]);
  assert.equal(images[0].id, "back");
});

test("current backend list without images and empty/null media normalize to an empty gallery", () => {
  for (const media of [{}, { images: [] }, { images: null }]) {
    const page = parseProductPage(envelope([{ ...summary, ...media }]));
    assert.deepEqual(page.content[0].images, []);
  }
});

test("malformed optional list media is rejected; blank URLs are retained for placeholder rendering", () => {
  for (const media of ["bad", [{}], [{ ...images[0], sortOrder: 1.5 }], [{ ...images[0], imageUrl: 123 }]]) {
    assert.throws(() => parseProductPage(envelope([{ ...summary, images: media }])));
  }
  assert.equal(parseProductPage(envelope([{ ...summary, images: [{ ...images[0], imageUrl: "" }] }])).content[0].images?.[0].imageUrl, "");
  assert.deepEqual(sortProductImages([{ ...images[0], sortOrder: 0 }, { ...images[1], sortOrder: 0 }]).map((image) => image.id), ["back", "front"]);
});
