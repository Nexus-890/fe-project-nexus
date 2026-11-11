import assert from "node:assert/strict";
import test from "node:test";
import { changeSellerProductStatus, createSellerProduct, createSellerSku, getSellerProducts } from "../service/sellerService";
import type { ApiContext } from "../types/commonRequestType";

const product = { id: "product-1", name: "Sample", slug: "sample", categoryId: "category-1", sellerId: "seller-1", status: "DRAFT", minPrice: null, images: [] };

test("seller listing, draft creation and publication use protected methods and exact request data", async () => {
  const requests: { path: string; method: string; auth: string | null; body: unknown }[] = [];
  const context: ApiContext = { getAccessToken: () => "fixture-only", fetch: async (input, init) => {
    const url = new URL(String(input), "http://fixture.test");
    requests.push({ path: url.pathname + url.search, method: init?.method ?? "GET", auth: new Headers(init?.headers).get("Authorization"), body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const data = url.pathname.endsWith("mine") ? [product] : product;
    return Response.json({ code: 0, message: "response success", data, ...(Array.isArray(data) ? { page: { number: 2, size: 10, totalElements: 21, totalPages: 3 } } : {}) }, { status: init?.method === "POST" ? 201 : 200 });
  } };
  const list = await getSellerProducts(2, { context });
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
  assert.equal(saved.id, "persisted-sku"); assert.equal(saved.price, "100000.00"); assert.equal(saved.skuCode, serverCode);
  assert.deepEqual(calls, [{ method: "POST", path: "/api/v1/products/product-1/skus", body: { color: "Silver", size: "Standard", price: 100000 } }]);
});
