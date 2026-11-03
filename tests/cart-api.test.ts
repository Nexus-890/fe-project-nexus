import assert from "node:assert/strict";
import { test } from "node:test";
import { createApiClient } from "../lib/api-client";
import { createCartService } from "../service/cart";

const cartId = "68000000-0000-4000-8000-000000000001";
const userId = "68000000-0000-4000-8000-000000000002";
const itemId = "68000000-0000-4000-8000-000000000003";
const productId = "68000000-0000-4000-8000-000000000004";
const skuId = "68000000-0000-4000-8000-000000000005";

function backendCart() {
  return {
    id: cartId, userId, status: "ACTIVE",
    items: [{ id: itemId, productId, skuId, quantity: 3, unitPrice: 0.1 }],
  };
}

const envelope = (data: unknown) => ({ code: 0, message: "response success", data });

function serviceFor(body: unknown, status = 200) {
  return createCartService({
    client: createApiClient({
      baseUrl: "http://cart-api.test", getAccessToken: () => "cart-token",
      fetch: async () => new Response(JSON.stringify(body), { status }),
    }),
  });
}

test("GET, POST and PUT accept the delivered compact Cart envelope with numeric prices", async () => {
  const requests: Array<{ path: string; method: string | undefined; body: unknown; authorization: string | null }> = [];
  const service = createCartService({
    client: createApiClient({
      baseUrl: "http://cart-api.test", getAccessToken: () => "cart-token",
      fetch: async (input, init) => {
        requests.push({
          path: new URL(String(input)).pathname, method: init?.method,
          body: init?.body ? JSON.parse(String(init.body)) : undefined,
          authorization: new Headers(init?.headers).get("Authorization"),
        });
        return new Response(JSON.stringify(envelope(backendCart())), { status: init?.method === "POST" ? 201 : 200 });
      },
    }),
  });

  for (const result of [
    await service.getCart(),
    await service.addCartItem({ skuId, quantity: 3 }),
    await service.updateCartItem({ itemId, quantity: 3 }),
  ]) {
    assert.ok(result.ok);
    assert.equal(result.data.id, cartId);
    assert.equal(result.data.userId, userId);
    assert.equal(result.data.items[0].quantity, 3);
    assert.equal(result.data.items[0].unitPrice, "0.10");
    assert.equal(result.data.items[0].lineTotal, "0.30");
    assert.equal(result.data.items[0].productName, `Product ${productId}`);
    assert.equal(result.data.subtotal, "0.30");
    assert.equal(result.data.currency, "VND");
    assert.equal(result.data.updatedAt, undefined, "a missing backend timestamp must not require invented data");
  }
  assert.deepEqual(requests, [
    { path: "/api/v1/carts/me", method: "GET", body: undefined, authorization: "Bearer cart-token" },
    { path: "/api/v1/carts/me/items", method: "POST", body: { skuId, quantity: 3 }, authorization: "Bearer cart-token" },
    { path: `/api/v1/carts/me/items/${itemId}`, method: "PUT", body: { quantity: 3 }, authorization: "Bearer cart-token" },
  ]);
});

test("cart totals use exact decimal arithmetic for multiple lines and compatible money strings", async () => {
  const cart = backendCart();
  const result = await serviceFor(envelope({
    ...cart,
    items: [
      cart.items[0],
      { ...cart.items[0], id: "second-item", skuId: "second-sku", quantity: 2, unitPrice: 19.99 },
      { ...cart.items[0], id: "third-item", skuId: "third-sku", quantity: 2, unitPrice: "12345678901234567.89" },
    ],
  })).getCart();

  assert.ok(result.ok);
  assert.deepEqual(result.data.items.map((item) => item.lineTotal), ["0.30", "39.98", "24691357802469135.78"]);
  assert.equal(result.data.subtotal, "24691357802469176.06");
});

test("an empty compact cart needs no display metadata or backend totals", async () => {
  const result = await serviceFor(envelope({ ...backendCart(), items: [] })).getCart();
  assert.ok(result.ok);
  assert.deepEqual(result.data.items, []);
  assert.equal(result.data.subtotal, "0.00");
});

test("cart reads reject missing or malformed success envelopes and compact DTOs", async () => {
  const cart = backendCart();
  const malformed = [
    cart,
    null,
    [],
    { data: cart },
    { code: 0, data: cart },
    { code: 0, message: "response success" },
    { code: "0", message: "response success", data: cart },
    { code: 1, message: "response success", data: cart },
    { code: 0, message: null, data: cart },
    envelope(null),
    envelope({ ...cart, id: undefined }),
    envelope({ ...cart, userId: undefined }),
    envelope({ ...cart, status: "EXPIRED" }),
    envelope({ ...cart, items: null }),
    ...["id", "productId", "skuId", "quantity", "unitPrice"].map((field) =>
      envelope({ ...cart, items: [{ ...cart.items[0], [field]: undefined }] })),
    ...[0, -1, 1.5, "2", Number.MAX_SAFE_INTEGER + 1, null].map((quantity) =>
      envelope({ ...cart, items: [{ ...cart.items[0], quantity }] })),
    ...[-1, 0.001, "1.001", "1e3", "not-money", "", null].map((unitPrice) =>
      envelope({ ...cart, items: [{ ...cart.items[0], unitPrice }] })),
  ];
  for (const body of malformed) {
    const result = await serviceFor(body).getCart();
    assert.equal(result.ok, false, `must reject ${JSON.stringify(body)}`);
    if (!result.ok) assert.equal(result.error.kind, "invalid-response");
  }
});

test("cart writes validate response envelopes just like reads", async () => {
  const service = serviceFor(envelope({ ...backendCart(), items: [{ id: itemId }] }));
  for (const result of [
    await service.addCartItem({ skuId, quantity: 2 }),
    await service.updateCartItem({ itemId, quantity: 2 }),
  ]) {
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.kind, "invalid-response");
  }
});

test("cart services retain HTTP failures instead of replacing them with contract errors", async () => {
  const service = serviceFor({
    title: "Forbidden", detail: "Cart permission is required", status: 403,
    type: "urn:problem:forbidden",
  }, 403);
  for (const result of [
    await service.getCart(),
    await service.addCartItem({ skuId, quantity: 2 }),
    await service.updateCartItem({ itemId, quantity: 2 }),
    await service.removeCartItem(itemId),
  ]) {
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.kind, "http");
      assert.equal(result.error.status, 403);
      assert.equal(result.error.detail, "Cart permission is required");
    }
  }
});

test("DELETE accepts the backend 204 response without a body", async () => {
  const service = createCartService({ client: createApiClient({
    baseUrl: "http://cart-api.test",
    fetch: async (input, init) => {
      assert.equal(new URL(String(input)).pathname, `/api/v1/carts/me/items/${itemId}`);
      assert.equal(init?.method, "DELETE");
      return new Response(null, { status: 204 });
    },
  }) });
  assert.deepEqual(await service.removeCartItem(itemId), { ok: true, data: undefined });
});
