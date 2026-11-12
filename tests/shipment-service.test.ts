import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import { isApiError } from "../configs/api";
import { getOrderShipment, getShipmentTracking } from "../service/shipmentService";
import type { ApiContext } from "../types/commonRequestType";

const orderId = "a1000000-0000-4000-8000-000000000001";
const shipmentId = "a2000000-0000-4000-8000-000000000001";
const otherId = "a3000000-0000-4000-8000-000000000001";
const createdAt = "2026-11-10T08:00:00Z";
const history = [
  { id: "a4000000-0000-4000-8000-000000000001", status: "CREATED", description: "Shipment created", createdAt },
  { id: "a4000000-0000-4000-8000-000000000002", status: "IN_TRANSIT", description: "Arrived at sorting facility", createdAt: "2026-11-11T11:00:00+07:00" },
];
const shipment = {
  id: shipmentId, orderId, warehouseId: otherId, buyerId: otherId,
  carrier: "GHN", serviceType: "STANDARD", trackingCode: "GHN123456789",
  status: "IN_TRANSIT", shippingFee: 30000, shippingInfo: {}, createdAt,
  updatedAt: history[1].createdAt, version: 1,
};
const tracking = {
  shipmentId, orderId, carrier: shipment.carrier, trackingCode: shipment.trackingCode,
  status: shipment.status, history,
};
const envelope = (data: unknown) => ({ code: 0, message: "response success", data });
const listEnvelope = (data: unknown = [shipment], count = 1) => ({
  ...envelope(data), page: { number: 0, size: 1, totalElements: count, totalPages: count ? 1 : 0 },
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
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
};

test("shipment lookup filters by order then reads tracking by shipment id with the current private Bearer", async () => {
  const seen: Array<{ method?: string; path: string; query: Record<string, string>; auth?: string; body: string }> = [];
  let token = "initial-buyer-token";
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://nexus.test");
    let body = "";
    for await (const chunk of request) body += chunk;
    seen.push({ method: request.method, path: url.pathname, query: Object.fromEntries(url.searchParams), auth: request.headers.authorization, body });
    response.writeHead(200, { "Content-Type": "application/json" });
    if (url.pathname.endsWith("/tracking")) response.end(JSON.stringify(envelope(tracking)));
    else {
      token = "renewed-buyer-token";
      response.end(JSON.stringify(listEnvelope()));
    }
  });
  const context: ApiContext = { baseUrl: await listen(server), getAccessToken: () => token };
  try {
    assert.deepEqual(await getOrderShipment(orderId, { context, auth: false, params: { orderId: otherId, page: 9 } }), tracking);
    assert.deepEqual(seen, [
      { method: "GET", path: "/api/v1/shipments", query: { orderId, page: "0", size: "1" }, auth: "Bearer initial-buyer-token", body: "" },
      { method: "GET", path: `/api/v1/shipments/${shipmentId}/tracking`, query: {}, auth: "Bearer renewed-buyer-token", body: "" },
    ]);
  } finally { await close(server); }
});

test("a successful empty shipment list returns null without requesting tracking", async () => {
  const requests: string[] = [];
  const server = createServer((request, response) => {
    requests.push(request.url ?? "");
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(listEnvelope([], 0)));
  });
  try {
    assert.equal(await getOrderShipment(orderId, { context: { baseUrl: await listen(server) } }), null);
    assert.equal(requests.length, 1);
    assert.ok(requests[0].startsWith("/api/v1/shipments?"));
  } finally { await close(server); }
});

test("refreshing a known shipment reads only its tracking resource with current auth and no lookup parameters", async () => {
  const requests: Array<{ method?: string; url?: string; auth?: string }> = [];
  const server = createServer((request, response) => {
    requests.push({ method: request.method, url: request.url, auth: request.headers.authorization });
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(envelope(tracking)));
  });
  let token = "first-private-token";
  const context: ApiContext = { baseUrl: await listen(server), getAccessToken: () => token };
  try {
    assert.deepEqual(await getShipmentTracking(shipmentId, orderId, { context, auth: false, params: { orderId: otherId } }), tracking);
    token = "current-private-token";
    assert.deepEqual(await getShipmentTracking(shipmentId, orderId, { context }), tracking);
    assert.deepEqual(requests, [
      { method: "GET", url: `/api/v1/shipments/${shipmentId}/tracking`, auth: "Bearer first-private-token" },
      { method: "GET", url: `/api/v1/shipments/${shipmentId}/tracking`, auth: "Bearer current-private-token" },
    ]);
    await assert.rejects(getShipmentTracking("not-a-shipment", orderId, { context }), invalidResponse);
    await assert.rejects(getShipmentTracking(shipmentId, "not-an-order", { context }), invalidResponse);
    assert.equal(requests.length, 2);
  } finally { await close(server); }
});

test("pending tracking and an empty persisted history remain explicit valid shipment data", async () => {
  const pending = { ...tracking, trackingCode: null, status: "PENDING_TRACKING", history: [] };
  const server = createServer((request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(request.url?.endsWith("/tracking") ? envelope(pending) : listEnvelope()));
  });
  try {
    assert.deepEqual(await getOrderShipment(orderId, { context: { baseUrl: await listen(server) } }), pending);
  } finally { await close(server); }
});

test("shipment history preserves authoritative chronology below millisecond precision", async () => {
  const preciseHistory = [
    { ...history[0], id: history[1].id, createdAt: "2026-11-10T08:00:00.000001Z" },
    { ...history[1], id: history[0].id, createdAt: "2026-11-10T08:00:00.000002Z" },
  ];
  assert.equal(Date.parse(preciseHistory[0].createdAt), Date.parse(preciseHistory[1].createdAt));
  const server = createServer((request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(request.url?.endsWith("/tracking") ? envelope({ ...tracking, history: preciseHistory }) : listEnvelope()));
  });
  try {
    const result = await getOrderShipment(orderId, { context: { baseUrl: await listen(server) } });
    assert.deepEqual(result?.history, preciseHistory);
  } finally { await close(server); }
});

test("shipment HTTP authorization, missing routes and outages are preserved instead of treated as no shipment", async () => {
  let failureOnTracking = false;
  let status = 403;
  const server = createServer((request, response) => {
    if (failureOnTracking && !request.url?.endsWith("/tracking")) {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(listEnvelope()));
      return;
    }
    response.writeHead(status, { "Content-Type": "application/problem+json" });
    response.end(JSON.stringify({ title: "Shipment request failed", status: 200, code: `SHIPMENT_TEST_${status}`, detail: "The backend rejected this request.", instance: request.url }));
  });
  const context: ApiContext = { baseUrl: await listen(server) };
  try {
    for (failureOnTracking of [false, true]) for (status of [401, 403, 404, 503]) {
      await assert.rejects(getOrderShipment(orderId, { context }), (error: unknown) => {
        assert.ok(isApiError(error));
        assert.equal(error.kind, "http");
        assert.equal(error.status, status);
        assert.equal(error.code, `SHIPMENT_TEST_${status}`);
        assert.equal(error.detail, "The backend rejected this request.");
        return true;
      });
    }
  } finally { await close(server); }
});

test("malformed or mismatched shipment lists reject before requesting tracking", async () => {
  let body: unknown = listEnvelope();
  let trackingReads = 0;
  const server = createServer((request, response) => {
    if (request.url?.endsWith("/tracking")) trackingReads++;
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(body));
  });
  const context: ApiContext = { baseUrl: await listen(server) };
  try {
    for (body of [
      envelope([shipment]), listEnvelope(null), listEnvelope({ content: [shipment] }),
      listEnvelope([], 1), listEnvelope([shipment], 0), listEnvelope([shipment, shipment], 2),
      listEnvelope([null]), listEnvelope([{ ...shipment, id: "invalid-id" }]),
      listEnvelope([{ ...shipment, orderId: otherId }]),
    ]) await assert.rejects(getOrderShipment(orderId, { context }), invalidResponse);
    assert.equal(trackingReads, 0);
  } finally { await close(server); }
});

test("tracking rejects mismatched references, malformed statuses, dates and persisted history", async () => {
  let data: unknown = tracking;
  const server = createServer((request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(request.url?.endsWith("/tracking") ? envelope(data) : listEnvelope()));
  });
  const context: ApiContext = { baseUrl: await listen(server) };
  try {
    for (data of [
      null, { ...tracking, shipmentId: otherId }, { ...tracking, orderId: otherId },
      { ...tracking, carrier: " " }, { ...tracking, trackingCode: 123 }, { ...tracking, trackingCode: " " },
      { ...tracking, status: "UNKNOWN" }, { ...tracking, history: null },
      { ...tracking, history: [null] }, { ...tracking, history: [{ ...history[0], id: "bad-id" }] },
      { ...tracking, history: [{ ...history[0], status: "UNKNOWN" }] },
      { ...tracking, history: [{ ...history[0], description: 123 }] },
      { ...tracking, history: [{ ...history[0], createdAt: "not-a-date" }] },
      { ...tracking, history: [{ ...history[0], createdAt: "2026-11-10T08:00:00" }] },
      { ...tracking, history: [history[0], { ...history[0], id: history[0].id.toUpperCase() }] },
    ]) await assert.rejects(getOrderShipment(orderId, { context }), invalidResponse);
  } finally { await close(server); }
});

test("shipment request cancellation stays AbortError during both lookup and tracking", async () => {
  for (const cancelTracking of [false, true]) {
    let started: () => void = () => {};
    const requestStarted = new Promise<void>((resolve) => { started = resolve; });
    const server = createServer((request, response) => {
      if (cancelTracking && !request.url?.endsWith("/tracking")) {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify(listEnvelope()));
      } else started();
    });
    const context: ApiContext = { baseUrl: await listen(server) };
    const controller = new AbortController();
    try {
      const pending = getOrderShipment(orderId, { context, signal: controller.signal });
      await requestStarted;
      controller.abort();
      await assert.rejects(pending, (error: unknown) => error instanceof DOMException && error.name === "AbortError");
    } finally {
      controller.abort();
      await close(server);
    }
  }
});

test("invalid order references do not send a shipment request", async () => {
  let requests = 0;
  const context: ApiContext = { fetch: async () => { requests++; return new Response(); } };
  for (const value of ["", "order-one", `${orderId}/tracking`, `${orderId}?buyerId=${otherId}`])
    await assert.rejects(getOrderShipment(value, { context }), invalidResponse);
  assert.equal(requests, 0);
});
