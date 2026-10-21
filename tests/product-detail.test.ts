import { test } from "node:test";
import assert from "node:assert/strict";
import { createCatalogService } from "../service/catalog";
import { createCartService } from "../service/cart";
import type { ApiClient } from "../types/api/type";
import type { ApiResult } from "../types/common/response/type";

function clientFor(values: Record<string, unknown>) {
  const calls: Array<{ method: string; path: string; body?: unknown; options?: unknown }> = [];
  const client: ApiClient = {
    get: async <T>(path: string, options?: unknown): Promise<ApiResult<T>> => {
      calls.push({ method: "GET", path, options });
      return { ok: true, data: values[path] as T };
    },
    post: async <T>(path: string, body?: unknown, options?: unknown): Promise<ApiResult<T>> => {
      calls.push({ method: "POST", path, body, options });
      return { ok: true, data: values[path] as T };
    },
    put: async <T>(path: string, body?: unknown, options?: unknown): Promise<ApiResult<T>> => {
      calls.push({ method: "PUT", path, body, options });
      return { ok: true, data: values[path] as T };
    },
  };
  return { calls, client };
}

test("product detail keeps the UUID path and normalizes numeric SKU prices", async () => {
  const fixture = clientFor({
    "/api/v1/products/a%2Fb": {
      id: "product-1",
      name: "Demo product",
      slug: "demo-product",
      minPrice: null,
      status: "ACTIVE",
      categoryId: "category-1",
      sellerId: "seller-1",
      description: null,
      auctionEnable: false,
      skus: [{
        id: "sku-1", productId: "product-1", skuCode: "SKU-1", color: "Red", size: "M", price: 150000, status: "ACTIVE",
      }],
      images: [],
    },
  });

  const result = await createCatalogService({ client: fixture.client }).getProduct("a/b");
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.skus[0].price, "150000.00");
  assert.deepEqual(fixture.calls, [{
    method: "GET",
    path: "/api/v1/products/a%2Fb",
    options: { signal: undefined, auth: false },
  }]);
});

test("adding a cart item accepts the commerce response and normalizes numeric unit prices", async () => {
  const fixture = clientFor({
    "/api/v1/carts/me/items": {
      id: "cart-1",
      userId: "buyer-1",
      status: "ACTIVE",
      items: [{ id: "item-1", productId: "product-1", skuId: "sku-1", quantity: 2, unitPrice: 150000.5 }],
    },
  });

  const result = await createCartService({ client: fixture.client }).addCartItem({ skuId: "sku-1", quantity: 2 });
  assert.deepEqual(result, {
    ok: true,
    data: {
      id: "cart-1",
      userId: "buyer-1",
      status: "ACTIVE",
      items: [{ id: "item-1", productId: "product-1", skuId: "sku-1", quantity: 2, unitPrice: "150000.50" }],
    },
  });
  assert.deepEqual(fixture.calls, [{
    method: "POST",
    path: "/api/v1/carts/me/items",
    body: { skuId: "sku-1", quantity: 2 },
    options: { auth: true, signal: undefined },
  }]);
});

test("commerce cart supports an empty cart and string-encoded prices", async () => {
  for (const items of [[], [{ id: "item-1", productId: "product-1", skuId: "sku-1", quantity: 1, unitPrice: "0.00" }]]) {
    const cart = { id: "cart-1", userId: "buyer-1", status: "ACTIVE", items };
    const fixture = clientFor({ "/api/v1/carts/me/items": cart });
    assert.deepEqual(
      await createCartService({ client: fixture.client }).addCartItem({ skuId: "sku-1", quantity: 1 }),
      { ok: true, data: cart },
    );
  }
});

test("commerce cart rejects malformed item quantities, prices, and missing owner ids", async () => {
  const item = { id: "item-1", productId: "product-1", skuId: "sku-1", quantity: 1, unitPrice: 10 };
  for (const cart of [
    { id: "cart-1", status: "ACTIVE", items: [item] },
    { id: "cart-1", userId: "buyer-1", status: "ACTIVE", items: [{ ...item, quantity: 0 }] },
    { id: "cart-1", userId: "buyer-1", status: "ACTIVE", items: [{ ...item, unitPrice: -1 }] },
    { id: "cart-1", userId: "buyer-1", status: "ACTIVE", items: [{ ...item, unitPrice: "invalid" }] },
  ]) {
    const fixture = clientFor({ "/api/v1/carts/me/items": cart });
    const result = await createCartService({ client: fixture.client }).addCartItem({ skuId: "sku-1", quantity: 1 });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.kind, "invalid-response");
  }
});
