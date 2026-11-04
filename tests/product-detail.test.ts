import assert from "node:assert/strict";
import { test } from "node:test";
import { getProduct, parseProductDetail } from "../service/catalogService";
import { addCartItem } from "../service/cartService";
import type { ApiContext } from "../types/commonRequestType";
import { isApiError, requestApi } from "../configs/api";

const detail = {
  id: "product-1",
  name: "Demo",
  slug: "demo",
  minPrice: null,
  status: "ACTIVE",
  categoryId: "category-1",
  sellerId: "seller-1",
  description: null,
  auctionEnable: false,
  skus: [
    {
      id: "sku-1",
      productId: "product-1",
      skuCode: "SKU-1",
      color: "Red",
      size: "M",
      price: 150000,
      status: "ACTIVE",
    },
  ],
  images: [],
};
test("product detail encodes the UUID path and normalizes numeric SKU prices", async () => {
  let path = "";
  const context: ApiContext = {
    fetch: async (input) => {
      path = String(input);
      return new Response(
        JSON.stringify({ code: 0, message: "response success", data: detail }),
      );
    },
  };
  assert.equal(
    (await getProduct("a/b", { context })).skus[0].price,
    "150000.00",
  );
  assert.equal(path, "/api/v1/products/a%2Fb");
});
test("malformed SKU/image detail is rejected before the page renders", () => {
  assert.throws(() =>
    parseProductDetail({
      ...detail,
      skus: [{ ...detail.skus[0], price: "bad" }],
    }),
  );
  assert.throws(() =>
    parseProductDetail({
      ...detail,
      images: [{ id: "x", imageUrl: 42, sortOrder: 0 }],
    }),
  );
});
test("adding a cart item sends exactly skuId and quantity and accepts delivered cart DTO", async () => {
  let request: unknown;
  const context: ApiContext = {
    getAccessToken: () => "session-token",
    fetch: async (input, init) => {
      request = {
        path: String(input),
        method: init?.method,
        body: JSON.parse(String(init?.body)),
        auth: new Headers(init?.headers).get("Authorization"),
      };
      return new Response(
        JSON.stringify({
          code: 0,
          message: "response success",
          data: {
            id: "cart-1",
            userId: "user-1",
            status: "ACTIVE",
            items: [
              {
                id: "item-1",
                skuId: "sku-1",
                productId: "product-1",
                quantity: 2,
                unitPrice: 150000,
              },
            ],
          },
        }),
        { status: 201 },
      );
    },
  };
  const cart = await addCartItem({ skuId: "sku-1", quantity: 2 }, { context });
  assert.equal(cart.items[0].unitPrice, "150000.00");
  assert.deepEqual(request, {
    path: "/api/v1/carts/me/items",
    method: "POST",
    body: { skuId: "sku-1", quantity: 2 },
    auth: "Bearer session-token",
  });
  assert.equal("subtotal" in cart, false);
});
test("invalid quantity or sku fails before sending HTTP", async () => {
  let calls = 0;
  const context: ApiContext = {
    fetch: async () => {
      calls++;
      return new Response();
    },
  };
  for (const input of [
    { skuId: "", quantity: 1 },
    { skuId: "x", quantity: 0 },
    { skuId: "x", quantity: 1.5 },
  ])
    await assert.rejects(addCartItem(input, { context }));
  assert.equal(calls, 0);
});

if (process.env.NEXUS_SIM_ORIGIN)
  test("Postman simulation exercises real catalog service and shared HTTP boundary", async () => {
    const options = {
      context: { baseUrl: process.env.NEXUS_SIM_ORIGIN },
      config: { headers: { "x-mock-slug": "catalog" } },
      auth: false,
    };
    const product = await getProduct(
      "c8000000-0000-4000-8000-000000000002",
      options,
    );
    assert.equal(product.minPrice, "150000.50");
    const sku = await requestApi<{ price: number }>(
      "GET",
      "/api/v1/skus/c8000000-0000-4000-8000-000000000003",
      undefined,
      options,
    );
    assert.equal(sku.data.price, 150000.5);
    for (const [suffix, status, code] of [
      ["4", 404, "CATALOG_SKU_NOT_FOUND"],
      ["5", 503, "SERVICE_UNAVAILABLE"],
    ] as const) {
      await assert.rejects(
        requestApi(
          "GET",
          `/api/v1/skus/c8000000-0000-4000-8000-00000000000${suffix}`,
          undefined,
          options,
        ),
        (error: unknown) =>
          isApiError(error) && error.status === status && error.code === code,
      );
    }
    await assert.rejects(
      requestApi(
        "GET",
        "/api/v1/skus/c8000000-0000-4000-8000-000000000006",
        undefined,
        options,
      ),
      (error: unknown) =>
        isApiError(error) && error.kind === "invalid-response",
    );
  });
