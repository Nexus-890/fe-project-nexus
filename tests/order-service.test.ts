import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import { isApiError } from "../configs/api";
import { cancelOrder, getOrder, getOrderHistory, getOrders, parseOrderDetail, parseOrderSummary } from "../service/orderService";
import type { ApiContext } from "../types/commonRequestType";
import type { OrderFilters } from "../types/orderRequestType";

const orderId = "10000000-0000-4000-8000-000000000001";
const orderGroupId = "20000000-0000-4000-8000-000000000001";
const order = {
  orderId, orderGroupId, orderNumber: "NX-260929-0038",
  userId: "30000000-0000-4000-8000-000000000001",
  sellerId: "40000000-0000-4000-8000-000000000001",
  orderType: "STANDARD", status: "PENDING",
  createdAt: "2026-09-29T10:30:00+07:00", totalAmount: 150000.25, items: [],
};
const filters = { page: 0, size: 10 };
const pageInfo = { number: 1, size: 10, totalElements: 13, totalPages: 2 };
const envelope = (data: unknown, page: unknown = pageInfo) => ({
  code: 0, message: "response success", data, page,
});
const invalidResponse = (error: unknown) => isApiError(error) && error.kind === "invalid-response";
const listen = async (server: Server): Promise<string> => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}`;
};
const close = async (server: Server) => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve()),
  );
};

test("order list sends status and zero-based paging over HTTP using the current private token", async () => {
  const seen: Array<{ method?: string; path: string; query: Record<string, string>; auth?: string }> = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://nexus.test");
    seen.push({
      method: request.method, path: url.pathname,
      query: Object.fromEntries(url.searchParams), auth: request.headers.authorization,
    });
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(envelope([order])));
  });
  let token = "first-session-token";
  const context: ApiContext = { baseUrl: await listen(server), getAccessToken: () => token };
  try {
    const result = await getOrders({ status: "PENDING", page: 1, size: 10 }, { context, auth: false });
    assert.deepEqual(result, {
      content: [{
        orderId, orderGroupId, orderNumber: order.orderNumber,
        createdAt: order.createdAt, status: "PENDING", totalAmount: "150000.25",
      }],
      page: 1, size: 10, totalElements: 13, totalPages: 2,
    });
    assert.notEqual(result.content[0].orderGroupId, result.content[0].orderId);
    token = "second-session-token";
    await getOrders(filters, { context });
    assert.deepEqual(seen, [
      {
        method: "GET", path: "/api/v1/orders",
        query: { status: "PENDING", page: "1", size: "10" }, auth: "Bearer first-session-token",
      },
      {
        method: "GET", path: "/api/v1/orders",
        query: { page: "0", size: "10" }, auth: "Bearer second-session-token",
      },
    ]);
  } finally {
    await close(server);
  }
});

test("delivered orders remain readable without a group id and never substitute an order id", () => {
  const { orderGroupId: omittedGroup, ...deliveredOrder } = order;
  assert.ok(omittedGroup);
  assert.equal(parseOrderSummary(deliveredOrder).orderGroupId, null);
  assert.equal(parseOrderSummary({ ...order, orderGroupId: null }).orderGroupId, null);
  assert.equal(parseOrderSummary({ ...order, totalAmount: 0 }).totalAmount, "0.00");
  assert.equal(parseOrderSummary({ ...order, totalAmount: 0.1 }).totalAmount, "0.10");
  for (const status of ["PENDING", "PAID", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELED", "REFUND_REQUESTED", "REFUNDED"])
    assert.equal(parseOrderSummary({ ...order, status }).status, status);
  for (const value of [
    null,
    { ...order, orderId: "not-a-uuid" },
    { ...order, orderNumber: " " },
    { ...order, createdAt: "2026-09-29" },
    { ...order, createdAt: "not-a-date" },
    { ...order, status: "CANCELLED" },
    { ...order, totalAmount: -1 },
    { ...order, totalAmount: "150000.25" },
    { ...order, totalAmount: Infinity },
    { ...order, orderGroupId: "/checkout/payment/arbitrary-path" },
  ]) assert.throws(() => parseOrderSummary(value), invalidResponse);
});

test("order list requires the array and sibling page envelope, including an explicit empty page", async () => {
  const read = (body: unknown) => getOrders(filters, {
    context: { fetch: async () => new Response(JSON.stringify(body)) },
  });
  assert.deepEqual(await read(envelope([], { number: 0, size: 10, totalElements: 0, totalPages: 0 })), {
    content: [], page: 0, size: 10, totalElements: 0, totalPages: 0,
  });
  for (const body of [
    [order],
    { code: 0, message: "response success", data: [order] },
    envelope({ content: [order] }),
    envelope(null),
    envelope([order], { ...pageInfo, size: 0 }),
    envelope([order], { ...pageInfo, number: -1 }),
    envelope([{ ...order, status: "UNKNOWN" }]),
  ]) await assert.rejects(read(body), invalidResponse);
});

test("order HTTP failures preserve Problem Details code and detail with actual status", async () => {
  const server = createServer((request, response) => {
    response.writeHead(403, { "Content-Type": "application/problem+json" });
    response.end(JSON.stringify({
      title: "Forbidden", status: 200, code: "ACCESS_DENIED",
      detail: "You cannot view this order list.", instance: request.url,
    }));
  });
  const context = { baseUrl: await listen(server) };
  try {
    await assert.rejects(getOrders(filters, { context }), (error: unknown) => {
      assert.ok(isApiError(error));
      assert.equal(error.kind, "http");
      assert.equal(error.status, 403);
      assert.equal(error.code, "ACCESS_DENIED");
      assert.equal(error.detail, "You cannot view this order list.");
      assert.equal(error.instance, "/api/v1/orders?page=0&size=10");
      return true;
    });
  } finally {
    await close(server);
  }
});

test("canceling an in-flight order HTTP request remains AbortError", async () => {
  let started: () => void = () => {};
  const requestStarted = new Promise<void>((resolve) => { started = resolve; });
  const server = createServer(() => { started(); });
  const context = { baseUrl: await listen(server) };
  const controller = new AbortController();
  try {
    const pending = getOrders(filters, { context, signal: controller.signal });
    await requestStarted;
    controller.abort();
    await assert.rejects(pending,
      (error: unknown) => error instanceof DOMException && error.name === "AbortError",
    );
  } finally {
    controller.abort();
    await close(server);
  }
});

test("invalid order filters reject before starting an HTTP request", async () => {
  let calls = 0;
  const context: ApiContext = { fetch: async () => { calls++; return new Response(); } };
  for (const input of [
    { page: -1, size: 10 },
    { page: 0.5, size: 10 },
    { page: 0, size: 0 },
    { page: 0, size: 101 },
    { page: 0, size: 10, status: "UNKNOWN" },
  ]) await assert.rejects(getOrders(input as OrderFilters, { context }), invalidResponse);
  assert.equal(calls, 0);
});

test("order detail and history read snapshot fields through protected HTTP, cancellation posts a trimmed reason", async () => {
  const requests: Array<{ method: string | undefined; path: string; auth: string | undefined; body: string }> = [];
  const item = { orderItemId: "50000000-0000-4000-8000-000000000001", productId: "60000000-0000-4000-8000-000000000001", skuId: "70000000-0000-4000-8000-000000000001", productName: "Snapshot product", skuCode: "SKU-WHITE-M", imageUrl: null, quantity: 2, unitPrice: 75000, totalPrice: 150000 };
  const entry = { id: "80000000-0000-4000-8000-000000000001", changedBy: order.userId, previousStatus: null, newStatus: "PENDING", reason: "Order placed", createdAt: order.createdAt };
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    requests.push({ method: request.method, path: request.url ?? "", auth: request.headers.authorization, body });
    response.writeHead(200, { "Content-Type": "application/json" });
    const data = request.url?.endsWith("/history") ? [entry] : request.url?.endsWith("/cancel") ? { orderGroupId, status: "CANCELED", totalAmount: 150000, currency: "VND", dueAt: order.createdAt, orders: [{ ...order, status: "CANCELED" }] } : { ...order, totalAmount: 150000, items: [item] };
    response.end(JSON.stringify({ code: 0, message: "response success", data }));
  });
  const context: ApiContext = { baseUrl: await listen(server), getAccessToken: () => "current-private-token" };
  try {
    const result = await getOrder(orderId, { context });
    assert.equal(result.items[0].productName, "Snapshot product");
    assert.equal(result.items[0].unitPrice, "75000.00");
    assert.equal(result.items[0].totalPrice, "150000.00");
    assert.deepEqual(await getOrderHistory(orderId, { context }), [entry]);
    assert.equal((await cancelOrder(orderId, "  Changed my mind  ", { context })).orders[0].status, "CANCELED");
    assert.deepEqual(requests.map(({ method, path, auth }) => ({ method, path, auth })), [
      { method: "GET", path: `/api/v1/orders/${orderId}`, auth: "Bearer current-private-token" },
      { method: "GET", path: `/api/v1/orders/${orderId}/history`, auth: "Bearer current-private-token" },
      { method: "POST", path: `/api/v1/orders/${orderId}/cancel`, auth: "Bearer current-private-token" },
    ]);
    assert.deepEqual(JSON.parse(requests[2].body), { reason: "Changed my mind" });
  } finally { await close(server); }
});

test("order detail rejects invalid item money, duplicate ids and mismatched order references", async () => {
  const item = { orderItemId: "50000000-0000-4000-8000-000000000001", productId: "60000000-0000-4000-8000-000000000001", skuId: "70000000-0000-4000-8000-000000000001", productName: "Snapshot product", skuCode: "SKU-WHITE-M", imageUrl: null, quantity: 1, unitPrice: 75000, totalPrice: 75000 };
  for (const invalid of [{ ...item, quantity: 0 }, { ...item, unitPrice: "75000" }, { ...item, totalPrice: -1 }])
    assert.throws(() => parseOrderDetail({ ...order, items: [invalid] }), invalidResponse);
  assert.throws(() => parseOrderDetail({ ...order, items: [item, item] }), invalidResponse);
  const context: ApiContext = { fetch: async () => new Response(JSON.stringify({ code: 0, message: "response success", data: { ...order, orderId: orderGroupId, items: [item] } }), { headers: { "Content-Type": "application/json" } }) };
  await assert.rejects(getOrder(orderId, { context }), invalidResponse);
  await assert.rejects(cancelOrder(orderId, " ", { context }), invalidResponse);
  await assert.rejects(getOrder("invalid-id", { context }), invalidResponse);
});
