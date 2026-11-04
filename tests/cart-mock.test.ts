import assert from "node:assert/strict";
import test from "node:test";
import type { ServiceRequestOptions } from "../types/commonRequestType";

test("offline cart transport persists add/update/delete through real services and isolates accounts", async () => {
  const previousMock = process.env.NEXT_PUBLIC_CART_MOCK;
  process.env.NEXT_PUBLIC_CART_MOCK = "true";
  try {
    // Import only after selecting the fixture: config reads its flag at module load.
    const { getCart, addCartItem, updateCartItem, removeCartItem } = await import("../service/cartService");
    const { mockProductDetail } = await import("../mocks/product-detail");
    const sku = mockProductDetail.skus[0];
    assert.equal(sku.price, "499.99");
    let networkCalls = 0;
    const account = (id: string): ServiceRequestOptions => ({ context: {
      baseUrl: "http://cart-offline.test",
      mockUser: { id, email: `${id}@example.test` },
      getAccessToken: () => `${id}-fixture-token`,
      fetch: async () => {
        networkCalls += 1;
        throw new Error("The offline cart must not use the real network transport");
      },
    } });
    const first = account("offline-buyer-one");
    const second = account("offline-buyer-two");
    assert.deepEqual((await getCart(first)).items, []);
    assert.deepEqual((await getCart(second)).items, []);

    await addCartItem({ skuId: sku.id, quantity: 1 }, first);
    const added = await addCartItem({ skuId: sku.id, quantity: 1 }, first);
    assert.equal(added.userId, "offline-buyer-one");
    assert.equal(added.items.length, 1, "Adding the same SKU must update its existing line");
    assert.equal(added.items[0].skuId, sku.id);
    assert.equal(added.items[0].quantity, 2);
    assert.equal(added.items[0].unitPrice, "499.99");
    assert.equal(added.items[0].lineTotal, "999.98");
    assert.equal(added.subtotal, "999.98");
    assert.deepEqual((await getCart(second)).items, []);

    await addCartItem({ skuId: sku.id, quantity: 1 }, second);
    const updated = await updateCartItem({ itemId: added.items[0].id, quantity: 3 }, first);
    assert.equal(updated.items[0].quantity, 3);
    assert.equal(updated.subtotal, "1499.97");
    assert.deepEqual(await getCart(first), updated);
    assert.equal((await getCart(second)).items[0].quantity, 1);

    assert.equal(await removeCartItem(added.items[0].id, first), undefined,
      "The bodyless DELETE 204 must resolve without parsing a cart");
    const empty = await getCart(first);
    assert.deepEqual(empty.items, []);
    assert.equal(empty.subtotal, "0.00");
    const isolated = await getCart(second);
    assert.equal(isolated.userId, "offline-buyer-two");
    assert.equal(isolated.items[0].quantity, 1);
    assert.equal(isolated.subtotal, "499.99");
    assert.equal(networkCalls, 0);
  } finally {
    if (previousMock === undefined) delete process.env.NEXT_PUBLIC_CART_MOCK;
    else process.env.NEXT_PUBLIC_CART_MOCK = previousMock;
  }
});
