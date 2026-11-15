import assert from "node:assert/strict";
import test from "node:test";
import { changeSellerProductStatus, createSellerProduct, createSellerSku, getSellerProducts, updateSellerSku } from "../service/sellerService";
import type { ApiContext } from "../types/commonRequestType";
import type { SellerSkuInput } from "../types/sellerType";
import { isApiError } from "../configs/api";

const product = { id: "product-1", name: "Sample", slug: "sample", categoryId: "category-1", sellerId: "seller-1", status: "DRAFT", minPrice: null, images: [] };

test("seller listing, draft creation and publication use protected methods and exact request data", async () => {
  const requests: { path: string; method: string; auth: string | null; body: unknown }[] = [];
  const context: ApiContext = { getAccessToken: () => "fixture-only", fetch: async (input, init) => {
    const url = new URL(String(input), "http://fixture.test");
    requests.push({ path: url.pathname + url.search, method: init?.method ?? "GET", auth: new Headers(init?.headers).get("Authorization"), body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const data = url.pathname.endsWith("mine") ? [product] : product;
    return Response.json({ code: 0, message: "response success", data, ...(Array.isArray(data) ? { page: { number: 2, size: 10, totalElements: 21, totalPages: 3 } } : {}) }, { status: init?.method === "POST" ? 201 : 200 });
  } };
  const list = await getSellerProducts(2, undefined, { context });
  assert.equal(list.page, 2); assert.equal(list.content[0].minPrice, null);
  await createSellerProduct({ name: "Sample", description: "Text", categoryId: "category-1", auctionEnable: true }, { context });
  await changeSellerProductStatus(product.id, "ACTIVE", { context });
  assert.ok(requests.every((request) => request.auth === "Bearer fixture-only"));
  assert.equal(requests[0].path, "/api/v1/products/mine?page=2&size=10");
  assert.deepEqual(requests[1], { path: "/api/v1/products", method: "POST", auth: "Bearer fixture-only", body: { name: "Sample", description: "Text", categoryId: "category-1", auctionEnable: true } });
  assert.deepEqual(requests[2], { path: "/api/v1/products/product-1/status", method: "PATCH", auth: "Bearer fixture-only", body: { status: "ACTIVE" } });
});

test("new SKU requests omit a client code and display the persisted server-generated value", async () => {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const serverCode = "SKU-11111111111141118111111111111111-01";
  const context: ApiContext = { getAccessToken: () => "fixture-only", fetch: async (input, init) => {
    calls.push({ method: init?.method ?? "GET", path: new URL(String(input), "http://fixture.test").pathname, body: JSON.parse(String(init?.body)) });
    return Response.json({ code: 0, message: "response success", data: { id: "persisted-sku", productId: "product-1", skuCode: serverCode, color: "Silver", size: "Standard", price: 100000, status: "ACTIVE" } }, { status: 201 });
  } };
  // A stale caller can have an extra runtime property; it must never reach the wire.
  const body = { skuCode: "CLIENT-MUST-NOT-CHOOSE", color: "Silver", size: "Standard", price: 100000 };
  const saved = await createSellerSku("product-1", body, { context });
  assert.equal(saved.shippingParcel, undefined);
  assert.equal(saved.id, "persisted-sku"); assert.equal(saved.price, "100000.00"); assert.equal(saved.skuCode, serverCode);
  assert.deepEqual(calls, [{ method: "POST", path: "/api/v1/products/product-1/skus", body: { color: "Silver", size: "Standard", price: 100000 } }]);
});
const parcel = { weightGrams: 1200, lengthCm: 30, widthCm: 20, heightCm: 15 };
const savedSku = { id: "persisted-sku", productId: "product-1", skuCode: "SERVER-SKU-01", color: "Silver", size: "Standard", price: 100000, status: "ACTIVE" };
const invalid = (error: unknown) => isApiError(error) && error.kind === "invalid-response";

test("SKU create and update send exact protected parcel writes and retain the saved server values", async () => {
  const serverParcel = { ...parcel, weightGrams: 1300 };
  const calls: { method: string; path: string; body: unknown; auth: string | null }[] = [];
  const context: ApiContext = { getAccessToken: () => "fixture-only", fetch: async (input, init) => {
    calls.push({ method: init?.method ?? "GET", path: new URL(String(input), "http://fixture.test").pathname,
      body: JSON.parse(String(init?.body)), auth: new Headers(init?.headers).get("Authorization") });
    return Response.json({ code: 0, message: "response success", data: { ...savedSku, shippingParcel: serverParcel } }, { status: init?.method === "POST" ? 201 : 200 });
  } };
  const body = { skuCode: "CLIENT-MUST-NOT-CHOOSE", color: "Silver", size: "Standard", price: 100000, shippingParcel: parcel };
  const created = await createSellerSku("product-1", body, { context });
  const updated = await updateSellerSku("product-1", "persisted-sku", body, { context });
  assert.deepEqual(created.shippingParcel, serverParcel);
  assert.deepEqual(updated.shippingParcel, serverParcel);
  assert.equal(updated.id, savedSku.id);
  assert.equal(updated.skuCode, savedSku.skuCode);
  assert.equal(updated.price, "100000.00");
  const expectedBody = { color: "Silver", size: "Standard", price: 100000, shippingParcel: parcel };
  assert.deepEqual(calls, [
    { method: "POST", path: "/api/v1/products/product-1/skus", auth: "Bearer fixture-only", body: expectedBody },
    { method: "PUT", path: "/api/v1/skus/persisted-sku", auth: "Bearer fixture-only", body: expectedBody },
  ]);
});

test("omitting parcel on an existing SKU preserves the server parcel and old response omissions stay compatible", async () => {
  const bodies: unknown[] = [];
  let responseParcel: typeof parcel | null | undefined = parcel;
  const context: ApiContext = { fetch: async (_input, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return Response.json({ code: 0, message: "response success", data: {
      ...savedSku, ...(responseParcel === undefined ? {} : { shippingParcel: responseParcel }),
    } });
  } };
  const body = { color: "Silver", size: "Standard", price: 100000 };
  const preserved = await updateSellerSku("product-1", "persisted-sku", body, { context });
  assert.deepEqual(preserved.shippingParcel, parcel);
  responseParcel = undefined;
  assert.equal((await updateSellerSku("product-1", "persisted-sku", body, { context })).shippingParcel, undefined);
  responseParcel = null;
  assert.equal((await updateSellerSku("product-1", "persisted-sku", body, { context })).shippingParcel, null);
  assert.deepEqual(bodies, [body, body, body]);
});

test("parcel boundary measurements survive both saved SKU response paths", async () => {
  for (const shippingParcel of [
    { weightGrams: 1, lengthCm: 1, widthCm: 1, heightCm: 1 },
    { weightGrams: 50000, lengthCm: 200, widthCm: 200, heightCm: 200 },
  ]) {
    const context: ApiContext = { fetch: async () => Response.json({ code: 0, message: "response success", data: { ...savedSku, shippingParcel } }) };
    const body = { color: "Silver", size: "Standard", price: 100000, shippingParcel };
    assert.deepEqual((await createSellerSku("product-1", body, { context })).shippingParcel, shippingParcel);
    assert.deepEqual((await updateSellerSku("product-1", "persisted-sku", body, { context })).shippingParcel, shippingParcel);
  }
});

test("partial fractional nonnumeric and out-of-range request parcels fail before create or update HTTP", async () => {
  let calls = 0;
  const context: ApiContext = { fetch: async () => { calls += 1; return Response.json({ code: 0, message: "response success", data: savedSku }); } };
  const badParcels: unknown[] = [{}, [], "parcel", { ...parcel, heightCm: undefined },
    ...[-1, 0, 50001, 1.5, "1200", Number.NaN, Number.POSITIVE_INFINITY].map((weightGrams) => ({ ...parcel, weightGrams })),
    ...["lengthCm", "widthCm", "heightCm"].flatMap((field) => [0, 201, 1.5, "20"].map((value) => ({ ...parcel, [field]: value })))];
  for (const shippingParcel of badParcels) {
    const body = { color: "Silver", size: "Standard", price: 100000, shippingParcel } as SellerSkuInput;
    await assert.rejects(createSellerSku("product-1", body, { context }), invalid);
    await assert.rejects(updateSellerSku("product-1", "persisted-sku", body, { context }), invalid);
  }
  assert.equal(calls, 0);
});

test("malformed saved parcels and mismatched updated SKU IDs reject rather than presenting a successful save", async () => {
  const badParcels: unknown[] = [{}, [], "parcel", { weightGrams: 1200, lengthCm: 30, widthCm: 20 },
    { ...parcel, weightGrams: 0 }, { ...parcel, weightGrams: 50001 },
    { ...parcel, lengthCm: 201 }, { ...parcel, widthCm: -1 }, { ...parcel, heightCm: 1.5 }];
  for (const shippingParcel of badParcels) {
    const context: ApiContext = { fetch: async () => Response.json({ code: 0, message: "response success", data: { ...savedSku, shippingParcel } }) };
    const body = { color: "Silver", size: "Standard", price: 100000, shippingParcel: parcel };
    await assert.rejects(createSellerSku("product-1", body, { context }), invalid);
    await assert.rejects(updateSellerSku("product-1", "persisted-sku", body, { context }), invalid);
  }
  await assert.rejects(updateSellerSku("product-1", "persisted-sku", { color: "Silver", size: "Standard", price: 100000, shippingParcel: parcel }, {
    context: { fetch: async () => Response.json({ code: 0, message: "response success", data: { ...savedSku, id: "other-sku", shippingParcel: parcel } }) },
  }), invalid);
});

test("SKU writes send the optional cost price apart from the selling price and keep the saved cost", async () => {
  const bodies: unknown[] = [];
  const context: ApiContext = { fetch: async (_input, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return Response.json({ code: 0, message: "response success", data: { ...savedSku, price: 150000, costPrice: 90000.5 } }, { status: init?.method === "POST" ? 201 : 200 });
  } };
  const created = await createSellerSku("product-1", { color: "Silver", size: "Standard", price: 150000, costPrice: 90000.5 }, { context });
  assert.equal(created.price, "150000.00"); assert.equal(created.costPrice, "90000.50");
  await updateSellerSku("product-1", "persisted-sku", { color: "Silver", size: "Standard", price: 150000, costPrice: 0 }, { context });
  await updateSellerSku("product-1", "persisted-sku", { color: "Silver", size: "Standard", price: 150000, costPrice: null }, { context });
  assert.deepEqual(bodies, [
    { color: "Silver", size: "Standard", price: 150000, costPrice: 90000.5 },
    { color: "Silver", size: "Standard", price: 150000, costPrice: 0 },
    { color: "Silver", size: "Standard", price: 150000 },
  ]);
  const publicSku = await createSellerSku("product-1", { color: "Silver", size: "Standard", price: 150000 }, {
    context: { fetch: async () => Response.json({ code: 0, message: "response success", data: savedSku }, { status: 201 }) },
  });
  assert.equal("costPrice" in publicSku, false);
});

test("invalid cost prices are rejected before any request and a malformed saved cost is refused", async () => {
  let calls = 0;
  const context: ApiContext = { fetch: async () => { calls += 1; return Response.json({ code: 0, message: "response success", data: savedSku }); } };
  for (const costPrice of [-1, 1.001, Number.NaN, 1e17]) {
    const body = { color: "Silver", size: "Standard", price: 150000, costPrice };
    await assert.rejects(createSellerSku("product-1", body, { context }), invalid);
    await assert.rejects(updateSellerSku("product-1", "persisted-sku", body, { context }), invalid);
  }
  assert.equal(calls, 0);
  for (const costPrice of [-1, "90000"]) {
    await assert.rejects(createSellerSku("product-1", { color: "Silver", size: "Standard", price: 150000 }, {
      context: { fetch: async () => Response.json({ code: 0, message: "response success", data: { ...savedSku, costPrice } }, { status: 201 }) },
    }), invalid);
  }
});
