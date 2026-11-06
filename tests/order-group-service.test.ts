import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import { isApiError } from "../configs/api";
import { getOrderGroup, listOwnOrders } from "../service/orderService";

const groupId = "a1000000-0000-4000-8000-000000000001";
const orders = [
  {
    orderId: "a2000000-0000-4000-8000-000000000001",
    orderNumber: "NX-20261104-0001", userId: "a4000000-0000-4000-8000-000000000001",
    sellerId: "a3000000-0000-4000-8000-000000000001", orderType: "STANDARD",
    status: "PENDING", createdAt: "2026-11-04T08:00:00Z", totalAmount: 200000, items: [],
  },
  {
    orderId: "a2000000-0000-4000-8000-000000000002",
    orderNumber: "NX-20261104-0002", userId: "a4000000-0000-4000-8000-000000000001",
    sellerId: "a3000000-0000-4000-8000-000000000002", orderType: "STANDARD",
    status: "PENDING", createdAt: "2026-11-04T08:00:00Z", totalAmount: 150000, items: [],
  },
];
const group = {
  orderGroupId: groupId, status: "PENDING", totalAmount: 350000,
  currency: "VND", dueAt: "2026-11-04T08:15:00Z", orders,
};
const envelope = (data: unknown) => ({ code: 0, message: "response success", data });
const invalidResponse = (error: unknown) => isApiError(error) && error.kind === "invalid-response";
const listen = async (server: Server): Promise<string> => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}`;
};
const close = async (server: Server) => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
};

test("group GET uses its group path, no request body and the current bearer; child statuses remain authoritative", async () => {
  const seen: Array<{ method?: string; path?: string; body: string; auth?: string }> = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    seen.push({ method: request.method, path: request.url, body: Buffer.concat(chunks).toString(), auth: request.headers.authorization });
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(envelope({
      ...group, orders: group.orders.map((order, index) => ({ ...order, status: seen.length === 1 && index === 1 ? "PENDING" : "PAID" })),
    })));
  });
  let token = "original-buyer-token";
  const context = { baseUrl: await listen(server), getAccessToken: () => token };
  try {
    const first = await getOrderGroup(groupId, { context, auth: false, params: { other: "ignored" } });
    assert.equal(first.orderGroupId, groupId);
    assert.equal(first.totalAmount, "350000.00");
    assert.equal(first.orders[0].totalAmount, "200000.00");
    assert.deepEqual(first.orders.map((order) => order.status), ["PAID", "PENDING"]);
    token = "renewed-buyer-token";
    const next = await getOrderGroup(groupId, { context });
    assert.equal(next.status, "PENDING");
    assert.deepEqual(next.orders.map((order) => order.status), ["PAID", "PAID"]);
    assert.deepEqual(seen, [
      { method: "GET", path: `/api/v1/orders/groups/${groupId}`, body: "", auth: "Bearer original-buyer-token" },
      { method: "GET", path: `/api/v1/orders/groups/${groupId}`, body: "", auth: "Bearer renewed-buyer-token" },
    ]);
  } finally {
    await close(server);
  }
});

test("group parsing rejects empty, mismatched, duplicate and malformed child data through real HTTP", async () => {
  let body: unknown = envelope(group);
  let status = 200;
  const server = createServer((_, response) => {
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(body));
  });
  const context = { baseUrl: await listen(server) };
  const invalidGroups: unknown[] = [
    null,
    { ...group, orderGroupId: "a1000000-0000-4000-8000-000000000002" },
    { ...group, orderGroupId: "group-one" },
    { ...group, status: " " },
    { ...group, totalAmount: "350000" },
    { ...group, totalAmount: -1 },
    { ...group, currency: "" },
    { ...group, dueAt: "2026-11-04T08:15:00" },
    { ...group, orders: [] },
    { ...group, orders: [orders[0], orders[0]] },
    { ...group, orders: [null] },
    { ...group, orders: [{ ...orders[0], status: "CANCELLED" }] },
    { ...group, orders: [{ ...orders[0], status: "UNKNOWN" }] },
    { ...group, orders: [{ ...orders[0], orderId: "order-one" }] },
    { ...group, orders: [{ ...orders[0], orderNumber: " " }] },
    { ...group, orders: [{ ...orders[0], createdAt: "not-a-time" }] },
    { ...group, orders: [{ ...orders[0], totalAmount: "200000" }] },
    { ...group, orders: [{ ...orders[0], totalAmount: -1 }] },
  ];
  try {
    for (const data of invalidGroups) {
      body = envelope(data);
      await assert.rejects(getOrderGroup(groupId, { context }), invalidResponse);
    }
    for (const invalidEnvelope of [group, { data: group }, { code: 0, message: "response success" }]) {
      body = invalidEnvelope;
      await assert.rejects(getOrderGroup(groupId, { context }), invalidResponse);
    }
    status = 204;
    await assert.rejects(getOrderGroup(groupId, { context }), invalidResponse);
  } finally {
    await close(server);
  }
});

test("group GET accepts generated order statuses and compares UUID letter case without guessing group status", async () => {
  let childStatus = "CANCELED";
  const server = createServer((_, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(envelope({ ...group, orders: [{ ...orders[0], status: childStatus }] })));
  });
  const context = { baseUrl: await listen(server) };
  try {
    for (childStatus of ["PENDING", "PAID", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELED", "REFUND_REQUESTED", "REFUNDED"]) {
      const result = await getOrderGroup(groupId.toUpperCase(), { context });
      assert.equal(result.orders[0].status, childStatus);
      assert.equal(result.status, "PENDING");
    }
  } finally {
    await close(server);
  }
});

test("group read retains Problem Details, field errors and HTTP status without retrying", async () => {
  let status = 403;
  let calls = 0;
  const server = createServer((request, response) => {
    calls++;
    response.writeHead(status, { "Content-Type": "application/problem+json" });
    response.end(JSON.stringify({
      title: "Order unavailable", status: 500, code: `ORDER_${status}`,
      detail: "This group cannot be read.", instance: request.url,
      errors: [{ field: "orderGroupId", code: "INVALID_GROUP", detail: "Check the order group reference." }],
    }));
  });
  const context = { baseUrl: await listen(server) };
  const statuses = [401, 403, 404, 409, 503];
  try {
    for (status of statuses) {
      await assert.rejects(getOrderGroup(groupId, { context }), (error: unknown) => {
        assert.ok(isApiError(error));
        assert.equal(error.status, status);
        assert.equal(error.code, `ORDER_${status}`);
        assert.equal(error.detail, "This group cannot be read.");
        assert.deepEqual(error.fieldErrors, { orderGroupId: ["Check the order group reference."] });
        return true;
      });
    }
    assert.equal(calls, statuses.length);
  } finally {
    await close(server);
  }
});

test("group cancellation aborts the live HTTP request and remains distinct from failure", async () => {
  let calls = 0;
  let started: () => void = () => {};
  const requestStarted = new Promise<void>((resolve) => { started = resolve; });
  const server = createServer(() => { calls++; started(); });
  const context = { baseUrl: await listen(server) };
  const controller = new AbortController();
  const aborted = (error: unknown) => error instanceof DOMException && error.name === "AbortError";
  try {
    const pending = getOrderGroup(groupId, { context, signal: controller.signal });
    const rejection = assert.rejects(pending, aborted);
    await requestStarted;
    controller.abort();
    await rejection;
    await assert.rejects(getOrderGroup(groupId, { context, signal: controller.signal }), aborted);
    assert.equal(calls, 1);
  } finally {
    await close(server);
  }
});

test("own order list serializes filters and maps data[] with sibling paging metadata", async () => {
  const seen: string[] = [];
  let data: unknown = orders;
  let page: unknown = { number: 1, size: 2, totalElements: 4, totalPages: 2 };
  const server = createServer((request, response) => {
    seen.push(request.url || "");
    assert.equal(request.headers.authorization, "Bearer list-buyer-token");
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ...envelope(data), page }));
  });
  const context = { baseUrl: await listen(server), getAccessToken: () => "list-buyer-token" };
  try {
    const result = await listOwnOrders({ page: 1, size: 2, status: "PAID" }, { context, auth: false });
    const url = new URL(seen[0], context.baseUrl);
    assert.equal(url.pathname, "/api/v1/orders");
    assert.deepEqual(Object.fromEntries(url.searchParams), { page: "1", size: "2", status: "PAID" });
    assert.deepEqual({ ...result, content: [] }, { content: [], page: 1, size: 2, totalElements: 4, totalPages: 2 });
    assert.deepEqual(result.content.map((order) => order.totalAmount), ["200000.00", "150000.00"]);
    data = [];
    page = { number: 0, size: 10, totalElements: 0, totalPages: 0 };
    assert.deepEqual((await listOwnOrders({}, { context })).content, []);
    assert.equal(seen[1], "/api/v1/orders?page=0&size=10");
    for (page of [undefined, { number: -1, size: 10, totalElements: 0, totalPages: 0 }])
      await assert.rejects(listOwnOrders({}, { context }), invalidResponse);
    page = { number: 0, size: 10, totalElements: 0, totalPages: 0 };
    data = group;
    await assert.rejects(listOwnOrders({}, { context }), invalidResponse);
  } finally {
    await close(server);
  }
});

test("invalid group IDs and order paging fail before sending HTTP", async () => {
  let calls = 0;
  const server = createServer((_, response) => { calls++; response.writeHead(500).end(); });
  const context = { baseUrl: await listen(server) };
  try {
    for (const invalidId of ["", " ", "group-1", "../../orders", `${groupId}?other=1`])
      await assert.rejects(getOrderGroup(invalidId, { context }), invalidResponse);
    for (const filters of [{ page: -1 }, { page: 1.5 }, { size: 0 }, { size: 101 }])
      await assert.rejects(listOwnOrders(filters, { context }), invalidResponse);
    assert.equal(calls, 0);
  } finally {
    await close(server);
  }
});
