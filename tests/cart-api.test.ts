import assert from "node:assert/strict";
import { test } from "node:test";
import { addCartItem, getCart, removeCartItem, updateCartItem } from "../service/cartService";
import type { ServiceRequestOptions } from "../types/commonRequestType";

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
function optionsFor(body: unknown, status = 200): ServiceRequestOptions {
  return { context: {
    baseUrl: "http://cart-api.test", getAccessToken: () => "cart-token",
    fetch: async () => new Response(JSON.stringify(body), { status }),
  } };
}

test("GET, POST and PUT accept the delivered compact Cart envelope with numeric prices", async () => {
  const requests: Array<{ path: string; method: string | undefined; body: unknown; authorization: string | null }> = [];
  const options: ServiceRequestOptions = { context: {
    baseUrl: "http://cart-api.test", getAccessToken: () => "cart-token",
    fetch: async (input, init) => {
      requests.push({
        path: new URL(String(input)).pathname, method: init?.method,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
        authorization: new Headers(init?.headers).get("Authorization"),
      });
      return new Response(JSON.stringify(envelope(backendCart())), { status: init?.method === "POST" ? 201 : 200 });
    },
  } };
  for (const result of [
    await getCart(options),
    await addCartItem({ skuId, quantity: 3 }, options),
    await updateCartItem({ itemId, quantity: 3 }, options),
  ]) {
    assert.equal(result.id, cartId);
    assert.equal(result.userId, userId);
    assert.equal(result.items[0].quantity, 3);
    assert.equal(result.items[0].unitPrice, "0.10");
    assert.equal(result.items[0].lineTotal, "0.30");
    assert.equal(result.items[0].productName, `Product ${productId}`);
    assert.equal(result.subtotal, "0.30");
    assert.equal(result.currency, "VND");
    assert.equal(result.updatedAt, undefined, "a missing backend timestamp must not require invented data");
  }
  assert.deepEqual(requests, [
    { path: "/api/v1/carts/me", method: "GET", body: undefined, authorization: "Bearer cart-token" },
    { path: "/api/v1/carts/me/items", method: "POST", body: { skuId, quantity: 3 }, authorization: "Bearer cart-token" },
    { path: `/api/v1/carts/me/items/${itemId}`, method: "PUT", body: { quantity: 3 }, authorization: "Bearer cart-token" },
  ]);
});

test("cart totals use exact decimal arithmetic for multiple lines and compatible money strings", async () => {
  const cart = backendCart();
  const result = await getCart(optionsFor(envelope({
    ...cart, items: [
      cart.items[0],
      { ...cart.items[0], id: "second-item", skuId: "second-sku", quantity: 2, unitPrice: 19.99 },
      { ...cart.items[0], id: "third-item", skuId: "third-sku", quantity: 2, unitPrice: "12345678901234567.89" },
    ],
  })));
  assert.deepEqual(result.items.map((item) => item.lineTotal), ["0.30", "39.98", "24691357802469135.78"]);
  assert.equal(result.subtotal, "24691357802469176.06");
});

test("an empty compact cart needs no display metadata or backend totals", async () => {
  const result = await getCart(optionsFor(envelope({ ...backendCart(), items: [] })));
  assert.deepEqual(result.items, []);
  assert.equal(result.subtotal, "0.00");
});

test("HTTP success accepts an explicit integer envelope code as defined by ApiResponse", async () => {
  const result = await getCart(optionsFor({ code: 1, message: "Cart loaded", data: backendCart() }));
  assert.equal(result.id, cartId);
});

test("cart reads reject missing or malformed success envelopes and compact DTOs", async () => {
  const cart = backendCart();
  const malformed = [
    cart, null, [], { data: cart }, { code: 0, data: cart },
    { code: 0, message: "response success" },
    { code: "0", message: "response success", data: cart },
    { code: 0, message: null, data: cart },
    envelope(null), envelope({ ...cart, id: undefined }),
    envelope({ ...cart, userId: undefined }), envelope({ ...cart, status: "EXPIRED" }),
    envelope({ ...cart, items: null }),
    ...["id", "productId", "skuId", "quantity", "unitPrice"].map((field) =>
      envelope({ ...cart, items: [{ ...cart.items[0], [field]: undefined }] })),
    ...[0, -1, 1.5, "2", Number.MAX_SAFE_INTEGER + 1, null].map((quantity) =>
      envelope({ ...cart, items: [{ ...cart.items[0], quantity }] })),
    ...[-1, 0.001, "1.001", "1e3", "not-money", "", null].map((unitPrice) =>
      envelope({ ...cart, items: [{ ...cart.items[0], unitPrice }] })),
  ];
  for (const body of malformed) {
    await assert.rejects(getCart(optionsFor(body)), { kind: "invalid-response" }, `must reject ${JSON.stringify(body)}`);
  }
});

test("cart writes validate response envelopes just like reads", async () => {
  const options = optionsFor(envelope({ ...backendCart(), items: [{ id: itemId }] }));
  for (const request of [
    () => addCartItem({ skuId, quantity: 2 }, options),
    () => updateCartItem({ itemId, quantity: 2 }, options),
  ]) await assert.rejects(request(), { kind: "invalid-response" });
});

test("cart services retain HTTP failures instead of replacing them with contract errors", async () => {
  const options = optionsFor({
    title: "Forbidden", detail: "Cart permission is required", status: 403,
    type: "urn:problem:forbidden", code: "FORBIDDEN",
  }, 403);
  for (const request of [
    () => getCart(options),
    () => addCartItem({ skuId, quantity: 2 }, options),
    () => updateCartItem({ itemId, quantity: 2 }, options),
    () => removeCartItem(itemId, options),
  ]) await assert.rejects(request(), { kind: "http", status: 403, code: "FORBIDDEN", detail: "Cart permission is required" });
});

test("DELETE accepts the backend 204 response without a body", async () => {
  const options: ServiceRequestOptions = { context: {
    baseUrl: "http://cart-api.test",
    fetch: async (input, init) => {
      assert.equal(new URL(String(input)).pathname, `/api/v1/carts/me/items/${itemId}`);
      assert.equal(init?.method, "DELETE");
      return new Response(null, { status: 204 });
    },
  } };
  assert.equal(await removeCartItem(itemId, options), undefined);
});
