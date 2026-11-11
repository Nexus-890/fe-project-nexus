import assert from "node:assert/strict";
import test from "node:test";
import { getSellerSales } from "../service/sellerService";
import { isApiError } from "../configs/api";

const id = "a2000000-0000-4000-8000-000000000001";
const itemId = "a2000000-0000-4000-8000-000000000002";
const order = { orderId: id, orderNumber: "NX-SALES-1", userId: id, sellerId: id, orderType: "STANDARD", status: "PAID", createdAt: "2026-11-11T04:00:00Z", totalAmount: 200000.5,
  recipientName: "Snapshot Buyer", phoneNumber: "0901234567", items: [{ orderItemId: itemId, productId: id, skuId: id, productName: "Studio Headphones", skuCode: "STUDIO-SILVER", quantity: 2, unitPrice: 100000.25, totalPrice: 200000.5, imageUrl: null }] };
const invalid = (error: unknown) => isApiError(error) && error.kind === "invalid-response";
const result = (data: unknown) => Response.json({ code: 0, message: "response success", data: [data], page: { number: 2, size: 10, totalElements: 21, totalPages: 3 } });

test("sales shows immutable recipient contact and each SKU quantity while requesting only the current seller scope", async () => {
  const rows = await getSellerSales(2, "PAID", { context: { getAccessToken: () => "seller", fetch: async (input, init) => {
    const url = new URL(String(input), "http://fixture.test");
    assert.equal(url.pathname, "/api/v1/orders/sales");
    assert.deepEqual([...url.searchParams.entries()], [["page", "2"], ["size", "10"], ["status", "PAID"]]);
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer seller");
    return result(order);
  } } });
  assert.equal(rows.page, 2); assert.equal(rows.totalElements, 21);
  assert.equal(rows.content[0].recipientName, "Snapshot Buyer"); assert.equal(rows.content[0].phoneNumber, "0901234567");
  assert.equal(rows.content[0].totalAmount, "200000.50");
  assert.deepEqual(rows.content[0].saleItems, [{ id: itemId, name: "Studio Headphones", skuCode: "STUDIO-SILVER", quantity: 2 }]);
});

test("historical missing contacts stay unavailable; malformed contact, SKU and quantity fail strict parsing", async () => {
  const historical = await getSellerSales(0, undefined, { context: { fetch: async () => result({ ...order, recipientName: undefined, phoneNumber: null }) } });
  assert.equal(historical.content[0].recipientName, null); assert.equal(historical.content[0].phoneNumber, null);
  for (const bad of [{ ...order, recipientName: 10 }, { ...order, phoneNumber: {} },
    { ...order, items: [{ ...order.items[0], skuCode: null }] }, { ...order, items: [{ ...order.items[0], quantity: 0 }] }])
    await assert.rejects(getSellerSales(0, undefined, { context: { fetch: async () => result(bad) } }), invalid);
});
