import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import { isApiError } from "../configs/api";
import { cancelOrder, getOrder, getOrderHistory, parseOrderDetail } from "../service/orderService";

const orderId = "68000000-0000-4000-8000-000000000001";
const groupId = "78000000-0000-4000-8000-000000000001";
const buyerId = "18000000-0000-4000-8000-000000000001";
const order = { orderId, orderNumber: "NX-TEST-0001", userId: buyerId, sellerId: "28000000-0000-4000-8000-000000000001",
  orderType: "STANDARD", status: "PAID", createdAt: "2026-11-11T01:00:00Z", totalAmount: 100000.25,
  items: [{ orderItemId: "38000000-0000-4000-8000-000000000001", productId: "48000000-0000-4000-8000-000000000001",
    skuId: "58000000-0000-4000-8000-000000000001", productName: "A very long product title", skuCode: "SKU-01", imageUrl: null, quantity: 1, unitPrice: 100000.25, totalPrice: 100000.25 }],
};
const historyEntry = { id: "98000000-0000-4000-8000-000000000001", previousStatus: null, newStatus: "PENDING", reason: "Created through checkout", changedBy: buyerId, createdAt: order.createdAt };
const envelope = (data: unknown) => ({ code: 0, message: "response success", data });
const invalid = (error: unknown) => isApiError(error) && error.kind === "invalid-response";
const listen = async (server: Server) => { await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve)); const address = server.address(); assert.ok(address && typeof address !== "string"); return `http://127.0.0.1:${address.port}`; };
const close = async (server: Server) => { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); };

test("detail, chronological history and cancel use scoped auth and delivered HTTP envelopes", async () => {
  const requests: { method?: string; path?: string; body: string; auth?: string }[] = [];
  const server = createServer(async (request, response) => {
    let body = ""; for await (const chunk of request) body += chunk;
    requests.push({ method: request.method, path: request.url, body, auth: request.headers.authorization });
    response.writeHead(200, { "Content-Type": "application/json" });
    const data = request.url?.endsWith("/history") ? { ...envelope([historyEntry]), page: { number: 0, size: 1, totalElements: 1, totalPages: 1 } } : request.url?.endsWith("/cancel") ? envelope({ orderGroupId: groupId, status: "CANCELED", totalAmount: order.totalAmount, currency: "VND", dueAt: "2026-11-11T02:00:00Z", orders: [{ ...order, status: "CANCELED" }] }) : envelope(order);
    response.end(JSON.stringify(data));
  });
  const context = { baseUrl: await listen(server), getAccessToken: () => "unit-test-private-token" };
  try {
    const detail = await getOrder(orderId, { context });
    assert.equal(detail.totalAmount, "100000.25");
    assert.equal(detail.items[0].unitPrice, "100000.25");
    assert.equal(detail.items[0].imageUrl, null);
    assert.deepEqual(await getOrderHistory(orderId, { context }), [historyEntry]);
    assert.equal((await cancelOrder(orderId, "  Changed my mind  ", { context })).status, "CANCELED");
    assert.deepEqual(requests, [
      { method: "GET", path: `/api/v1/orders/${orderId}`, body: "", auth: "Bearer unit-test-private-token" },
      { method: "GET", path: `/api/v1/orders/${orderId}/history`, body: "", auth: "Bearer unit-test-private-token" },
      { method: "POST", path: `/api/v1/orders/${orderId}/cancel`, body: JSON.stringify({ reason: "Changed my mind" }), auth: "Bearer unit-test-private-token" },
    ]);
  } finally { await close(server); }
});

test("detail rejects a different order, numeric strings and malformed snapshot items", () => {
  for (const value of [
    { ...order, orderId: groupId }, { ...order, orderType: "BUY_NOW" }, { ...order, totalAmount: "100000.25" },
    { ...order, items: null }, { ...order, items: [{ ...order.items[0], quantity: 0 }] },
    { ...order, items: [{ ...order.items[0], unitPrice: "100000.25" }] },
  ]) assert.throws(() => parseOrderDetail(value, orderId), invalid);
});

test("history refuses malformed envelopes and unknown status rather than inventing timeline events", async () => {
  for (const data of [envelope([historyEntry]), { ...envelope([{ ...historyEntry, newStatus: "OUT_FOR_DELIVERY" }]), page: { number: 0, size: 1, totalElements: 1, totalPages: 1 } }]) {
    await assert.rejects(getOrderHistory(orderId, { context: { fetch: async () => new Response(JSON.stringify(data)) } }), invalid);
  }
});

test("private detail cancellation preserves ownership errors and aborts", async () => {
  await assert.rejects(cancelOrder(orderId, "Reason", { context: { fetch: async () => new Response(JSON.stringify({ title: "Forbidden", status: 403, code: "COMMERCE_FORBIDDEN", detail: "This order belongs to another buyer." }), { status: 403 }) } }), (error: unknown) => isApiError(error) && error.status === 403 && error.code === "COMMERCE_FORBIDDEN");
  const controller = new AbortController(); controller.abort();
  await assert.rejects(getOrder(orderId, { signal: controller.signal }), (error: unknown) => error instanceof Error && error.name === "AbortError");
});
