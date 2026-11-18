import assert from "node:assert/strict";
import test from "node:test";
import { canPublishSellerProduct, getSellerAvailableTotal, getSellerPriceRange, getSellerProduct, getSellerProductListings, parseSellerBalance } from "../service/sellerService";
import type { ProductDetail, ProductSku } from "../types/catalogResponseType";
import type { ApiContext } from "../types/commonRequestType";

const sku: ProductSku = { id: "sku-1", productId: "product-1", skuCode: "TEST-1", color: "Black", size: "M", price: "100.00", status: "ACTIVE", shippingParcel: { weightGrams: 1200, lengthCm: 30, widthCm: 20, heightCm: 15 } };
const image = { id: "image-1", imageUrl: "https://images.example.test/product.jpg", sortOrder: 0 };
const detail: ProductDetail = { id: "product-1", name: "Own draft", slug: "own-draft", categoryId: "category-1", sellerId: "seller-1", status: "DRAFT", description: "Private draft text", auctionEnable: false, skus: [sku], images: [image], minPrice: null, maxPrice: null };
const wire = { ...detail, skus: [{ ...sku, price: 100 }] };
const invalid = (error: unknown) => typeof error === "object" && error !== null && "kind" in error && error.kind === "invalid-response";

test("publishing requires a persisted SKU with parcel measurements and a public image; an unsaved row never qualifies", () => {
  assert.equal(canPublishSellerProduct({ skus: [], images: [] }), false);
  assert.equal(canPublishSellerProduct({ skus: [sku], images: [] }), false);
  assert.equal(canPublishSellerProduct({ skus: [], images: [image] }), false);
  assert.equal(canPublishSellerProduct({ skus: [{ ...sku, id: "new-local-row" }], images: [image] }), false);
  assert.equal(canPublishSellerProduct({ skus: [sku], images: [{ ...image, imageUrl: " " }] }), false);
  assert.equal(canPublishSellerProduct({ skus: [sku], images: [image] }), true);
});

test("price range compares normalized decimal strings without rounding large prices", () => {
  assert.deepEqual(getSellerPriceRange([
    { ...sku, price: "99999999999999999.99" }, { ...sku, id: "sku-2", price: "100000000000000000.01" },
    { ...sku, id: "new-unsaved", price: "1.00" }, { ...sku, id: "inactive", price: "0.01", status: "INACTIVE" },
  ]), { minPrice: "99999999999999999.99", maxPrice: "100000000000000000.01" });
  assert.deepEqual(getSellerPriceRange([]), { minPrice: null, maxPrice: null });
});

test("owner detail uses the protected endpoint and preserves private DRAFT fields", async () => {
  let path = "";
  const result = await getSellerProduct(detail.id, { context: { getAccessToken: () => "fixture-token", fetch: async (input, init) => {
    path = new URL(String(input), "http://fixture.test").pathname;
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer fixture-token");
    return Response.json({ code: 0, message: "response success", data: wire });
  } } });
  assert.equal(path, "/api/v1/products/mine/product-1");
  assert.equal(result.status, "DRAFT"); assert.equal(result.description, "Private draft text");
  assert.equal(result.skus[0].price, "100.00");
  await assert.rejects(getSellerProduct("other-product", { context: { fetch: async () => Response.json({ code: 0, message: "response success", data: wire }) } }), invalid);
});

test("seller listings enrich each own row from its owner endpoint with SKU price range", async () => {
  const calls: string[] = [];
  const context: ApiContext = { getAccessToken: () => "fixture-token", fetch: async (input, init) => {
    const url = new URL(String(input), "http://fixture.test"); calls.push(url.pathname);
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer fixture-token");
    if (url.pathname.endsWith("/mine")) return Response.json({ code: 0, message: "response success", data: [{ ...wire, minPrice: 100 }], page: { number: 0, size: 10, totalElements: 1, totalPages: 1 } });
    return Response.json({ code: 0, message: "response success", data: wire });
  } };
  const result = await getSellerProductListings(0, {}, { context });
  assert.equal(result.content[0].minPrice, "100.00"); assert.equal(result.content[0].maxPrice, "100.00");
  assert.equal(result.content[0].images[0].imageUrl, image.imageUrl);
  assert.deepEqual(calls, ["/api/v1/products/mine", "/api/v1/products/mine/product-1"]);
});

test("seller stock sums authenticated warehouse balance pages rather than default-warehouse stock", async () => {
  const calls: string[] = [];
  const total = await getSellerAvailableTotal(["sku-1", "sku-1"], { context: { getAccessToken: () => "fixture-token", fetch: async (input, init) => {
    const url = new URL(String(input), "http://fixture.test"); calls.push(url.pathname + url.search);
    assert.equal(url.pathname, "/api/v1/inventory/balances"); assert.equal(url.searchParams.get("skuId"), "sku-1");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer fixture-token");
    const number = Number(url.searchParams.get("page"));
    return Response.json({ code: 0, message: "response success", data: [{ skuId: "sku-1", warehouseId: `warehouse-${number}`, total: number + 5, available: number + 2, reserved: 2, unavailable: 1 }], page: { number, size: 100, totalElements: 101, totalPages: 2 } });
  } } });
  assert.equal(total, 5); assert.equal(calls.length, 2);
  assert.ok(calls[0].includes("page=0")); assert.ok(calls[1].includes("page=1"));
  assert.equal(await getSellerAvailableTotal([]), 0);
  assert.throws(() => parseSellerBalance({ skuId: "sku-1", warehouseId: "warehouse-1", total: 5, available: 9, reserved: 0, unavailable: 0 }, "sku-1"), invalid);
  assert.throws(() => parseSellerBalance({ skuId: "other", warehouseId: "warehouse-1", total: 1, available: 1, reserved: 0, unavailable: 0 }, "sku-1"), invalid);
});
test("every persisted SKU needs a complete valid parcel before publication, including old and inactive variants", () => {
  const missing: ProductSku = { ...sku, id: "sku-2", shippingParcel: null };
  assert.equal(canPublishSellerProduct({ skus: [missing], images: [image] }), false);
  assert.equal(canPublishSellerProduct({ skus: [sku, missing], images: [image] }), false);
  assert.equal(canPublishSellerProduct({ skus: [sku, { ...missing, status: "INACTIVE" }], images: [image] }), false);
  assert.equal(canPublishSellerProduct({ skus: [sku, { ...missing, id: "new-unsaved" }], images: [image] }), true);
  assert.equal(canPublishSellerProduct({ skus: [sku, { ...sku, id: "sku-2" }], images: [image] }), true);
  const parcels: unknown[] = [undefined, null, {}, { weightGrams: 1200, lengthCm: 30, widthCm: 20 },
    { ...sku.shippingParcel, weightGrams: 0 }, { ...sku.shippingParcel, weightGrams: 50001 },
    { ...sku.shippingParcel, lengthCm: 201 }, { ...sku.shippingParcel, widthCm: -1 }, { ...sku.shippingParcel, heightCm: 1.5 }];
  for (const shippingParcel of parcels) {
    assert.equal(canPublishSellerProduct({ skus: [sku, { ...missing, shippingParcel: shippingParcel as ProductSku["shippingParcel"] }], images: [image] }), false);
  }
});

test("owner detail preserves valid parcels and accepts old missing or null parcel metadata", async () => {
  for (const shippingParcel of [sku.shippingParcel, undefined, null]) {
    const result = await getSellerProduct(detail.id, { context: { fetch: async () => Response.json({ code: 0, message: "response success", data: {
      ...wire, skus: [{ ...wire.skus[0], shippingParcel }],
    } }) } });
    assert.deepEqual(result.skus[0].shippingParcel, shippingParcel);
    assert.equal(canPublishSellerProduct(result), shippingParcel !== undefined && shippingParcel !== null);
  }
});

test("owner detail rejects malformed and partially present parcel metadata", async () => {
  for (const shippingParcel of ["parcel", [], {}, { weightGrams: 1200, lengthCm: 30, widthCm: 20 },
    { ...sku.shippingParcel, weightGrams: 0 }, { ...sku.shippingParcel, weightGrams: 50001 },
    { ...sku.shippingParcel, lengthCm: 201 }, { ...sku.shippingParcel, widthCm: -1 }, { ...sku.shippingParcel, heightCm: 1.5 }]) {
    await assert.rejects(getSellerProduct(detail.id, { context: { fetch: async () => Response.json({ code: 0, message: "response success", data: {
      ...wire, skus: [{ ...wire.skus[0], shippingParcel }],
    } }) } }), invalid);
  }
});
