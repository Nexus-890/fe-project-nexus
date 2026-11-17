import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import test from "node:test";
import { isApiError } from "../configs/api";
import {
  getAuditLogs, getBrokerHealth, getEventLogDetail, getEventLogs, getSystemHealth,
  parseAuditLog, parseEventLogDetail, parseSystemHealth,
} from "../service/adminObservabilityService";

const timestamp = "2026-11-16T08:00:00Z";
const event = {
  id: "11111111-1111-4111-8111-111111111111", eventId: "22222222-2222-4222-8222-222222222222",
  eventType: "ShipmentFailed", aggregateType: "Shipment", aggregateId: "shipment-123",
  operatorId: null, traceId: "trace-abc", topic: "nexus.shipment", occurredAt: timestamp, receivedAt: timestamp,
};
const audit = {
  id: event.id, eventId: event.eventId, actorId: null, action: "UserRoleAssigned", entityType: "User",
  entityId: "user-123", traceId: event.traceId, occurredAt: timestamp, receivedAt: timestamp,
};
const paging = { number: 0, size: 20, totalElements: 1, totalPages: 1 };
const send = (response: ServerResponse, data: unknown, page?: unknown) => {
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ code: 0, message: "response success", data, page }));
};
const withServer = async (
  handler: (request: IncomingMessage, response: ServerResponse) => void,
  run: (baseUrl: string) => Promise<void>,
) => {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
};

test("event and audit filters serialize over HTTP with a current protected token and sibling page metadata", async () => {
  const seen: Array<{ url: string; auth: string | undefined; method: string | undefined }> = [];
  await withServer((request, response) => {
    seen.push({ url: request.url!, auth: request.headers.authorization, method: request.method });
    send(response, request.url?.startsWith("/api/v1/event-logs") ? [event] : [audit], paging);
  }, async (baseUrl) => {
    let token = "admin-a";
    const options = { context: { baseUrl, getAccessToken: () => token }, auth: false };
    const logs = await getEventLogs({ q: "trace & message", eventType: "ShipmentFailed", aggregateType: "Shipment", aggregateId: "shipment-123", operatorId: "11111111-1111-4111-8111-111111111111", from: timestamp, to: timestamp, sort: "occurredAt,desc" }, options);
    assert.deepEqual(logs, { items: [event], page: paging });
    token = "admin-b";
    const audits = await getAuditLogs({ action: "UserRoleAssigned", actorId: "11111111-1111-4111-8111-111111111111", entityType: "User", entityId: "user-123", from: timestamp, to: timestamp, page: 2, size: 5 }, options);
    assert.deepEqual(audits.items, [audit]);
  });
  assert.equal(seen.length, 2);
  for (const [index, token] of ["admin-a", "admin-b"].entries()) {
    assert.equal(seen[index].method, "GET");
    assert.equal(seen[index].auth, `Bearer ${token}`);
  }
  const events = new URL(seen[0].url, "http://example.test");
  assert.equal(events.pathname, "/api/v1/event-logs");
  assert.equal(events.searchParams.get("q"), "trace & message");
  assert.equal(events.searchParams.get("aggregateId"), "shipment-123");
  assert.equal(events.searchParams.get("eventType"), "ShipmentFailed");
  assert.equal(events.searchParams.get("sort"), "occurredAt,desc");
  assert.equal(events.searchParams.get("from"), timestamp);
  assert.equal(events.searchParams.get("page"), "0");
  assert.equal(events.searchParams.get("size"), "20");
  const audits = new URL(seen[1].url, "http://example.test");
  assert.equal(audits.pathname, "/api/v1/audit-logs");
  assert.equal(audits.searchParams.get("actorId"), "11111111-1111-4111-8111-111111111111");
  assert.equal(audits.searchParams.get("entityId"), "user-123");
  assert.equal(audits.searchParams.get("page"), "2");
  assert.equal(audits.searchParams.get("size"), "5");
});

test("event detail preserves arbitrary JSON payload, unknown envelope fields and exact original text", async () => {
  const raw = '{ "payload": [null, false, 2, "keep"], "future": { "foo": true } }';
  const detail = { event, payload: [null, false, 2, "keep"], envelope: JSON.parse(raw) as unknown, rawEnvelope: raw };
  let path: string | undefined;
  await withServer((request, response) => { path = request.url; send(response, detail); }, async (baseUrl) => {
    assert.deepEqual(await getEventLogDetail(event.id, { context: { baseUrl } }), detail);
  });
  assert.equal(path, `/api/v1/event-logs/${event.id}`);
  assert.deepEqual(parseEventLogDetail({ ...detail, payload: null, rawEnvelope: null }).payload, null);
});

test("event detail rejects a different event returned for the selected resource", async () => {
  const requestedId = "33333333-3333-4333-8333-333333333333";
  const detail = { event, payload: { secret: "another-event" }, envelope: { payload: {} }, rawEnvelope: null };
  await withServer((_request, response) => send(response, detail), async (baseUrl) => {
    await assert.rejects(getEventLogDetail(requestedId, { context: { baseUrl } }),
      (error: unknown) => isApiError(error) && error.kind === "invalid-response");
  });
});

test("health preserves DOWN and UNKNOWN and nullable broker transition timestamps", async () => {
  const health = {
    services: [{ name: "user-service", status: "UP" }, { name: "shipment-service", status: "DOWN" }],
    brokers: [{ name: "kafka", status: "UNKNOWN", lastCheckedAt: null }],
  };
  const brokers = [{ name: "kafka", status: "UNKNOWN", lastCheckedAt: null, lastFailureAt: null, lastRecoveredAt: null }];
  const paths: string[] = [];
  await withServer((request, response) => {
    paths.push(request.url!);
    send(response, request.url?.endsWith("/brokers") ? brokers : health, request.url?.endsWith("/brokers") ? paging : undefined);
  }, async (baseUrl) => {
    const options = { context: { baseUrl, getAccessToken: () => "support" } };
    assert.deepEqual(await getSystemHealth(options), health);
    assert.deepEqual(await getBrokerHealth(options), brokers);
  });
  assert.deepEqual(paths, ["/api/v1/system/health", "/api/v1/system/health/brokers"]);
});

test("malformed event, audit, paging and health responses fail instead of displaying healthy or empty data", async () => {
  for (const value of [null, {}, { services: [], brokers: [{ name: "kafka", status: "HEALTHY", lastCheckedAt: null }] }, { services: [{ name: "user", status: 1 }], brokers: [] }]) {
    assert.throws(() => parseSystemHealth(value), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
  }
  assert.throws(() => parseAuditLog({ ...audit, occurredAt: "not-a-time" }));
  assert.throws(() => parseEventLogDetail({ event, envelope: {}, rawEnvelope: null }));
  for (const value of [[{ ...event, eventType: 3 }], { content: [event] }]) {
    await assert.rejects(getEventLogs({}, { context: { fetch: async () => new Response(JSON.stringify({ code: 0, message: "response success", data: value, page: paging })) } }), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
  }
  await assert.rejects(getEventLogs({}, { context: { fetch: async () => new Response(JSON.stringify({ code: 0, message: "response success", data: [] })) } }), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
  await assert.rejects(getBrokerHealth({ context: { fetch: async () => new Response(JSON.stringify({ code: 0, message: "response success", data: [{ name: "kafka", status: "UP", lastCheckedAt: null, lastFailureAt: "bad", lastRecoveredAt: null }], page: paging })) } }), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
});

test("invalid pagination, reversed dates and canceled calls do not reach the transport", async () => {
  let requests = 0;
  const context = { fetch: (async () => { requests++; return new Response(); }) satisfies typeof fetch };
  for (const filters of [{ page: -1 }, { size: 101 }, { size: 0 }, { from: "invalid" }, { from: timestamp, to: "2026-11-15T00:00:00Z" }]) {
    for (const getLogs of [getEventLogs, getAuditLogs]) {
      await assert.rejects(getLogs(filters, { context }), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
    }
  }
  await assert.rejects(getEventLogs({}, { context, signal: AbortSignal.abort() }), (error: unknown) => error instanceof DOMException && error.name === "AbortError");
  await assert.rejects(getSystemHealth({ context, signal: AbortSignal.abort() }), (error: unknown) => error instanceof DOMException && error.name === "AbortError");
  assert.equal(requests, 0);
});

test("HTTP authorization and availability failures remain errors with backend status and code", async () => {
  await withServer((_request, response) => {
    response.writeHead(403, { "Content-Type": "application/problem+json" });
    response.end(JSON.stringify({ title: "Forbidden", status: 403, code: "FORBIDDEN", detail: "Audit access denied" }));
  }, async (baseUrl) => {
    await assert.rejects(getAuditLogs({}, { context: { baseUrl } }), (error: unknown) => isApiError(error) && error.status === 403 && error.code === "FORBIDDEN");
  });
  await assert.rejects(getSystemHealth({ context: { fetch: async () => new Response("", { status: 503 }) } }), (error: unknown) => isApiError(error) && error.status === 503);
});
