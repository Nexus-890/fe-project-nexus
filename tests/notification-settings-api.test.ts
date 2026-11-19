import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { once } from "node:events";
import { isApiError } from "../configs/api";
import { getNotificationDeliveries, getNotificationDelivery, getNotificationPreferences, updateNotificationPreferences, watchNotifications } from "../service/notificationSettingsService";

const preference = { notificationType: "BID_OUTBID", channel: "EMAIL" as const, enabled: true, mandatory: false };
const success = (data: unknown, page?: unknown) => new Response(JSON.stringify({ code: 0, message: "response success", data, page }), { headers: { "content-type": "application/json" } });
const invalid = (error: unknown) => isApiError(error) && error.kind === "invalid-response";
const delivery = { id: "delivery-a", notificationId: "notification-a", userId: "user-a", type: "BID_OUTBID", title: "Your bid was exceeded", channel: "EMAIL", status: "FAILED", attemptCount: 2,
  nextAttemptAt: null, createdAt: "2026-11-19T02:00:00Z", updatedAt: "2026-11-19T02:10:00Z", lastErrorCode: "SMTP_TIMEOUT" };
const attempt = { id: "attempt-a", attemptNumber: 1, status: "FAILED", attemptedAt: delivery.createdAt, completedAt: delivery.updatedAt, errorCode: "SMTP_TIMEOUT", retryable: true };

test("preferences use scoped authenticated GET/PUT and preserve required transactional choices", async () => {
  const requests: { path: string; method?: string; auth: string | null; body: unknown }[] = [];
  const context = { baseUrl: "https://api.test", getAccessToken: () => "current", fetch: (async (input, init) => {
    requests.push({ path: String(input), method: init?.method, auth: new Headers(init?.headers).get("authorization"), body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return success({ preferences: [{ ...preference, enabled: init?.method === "PUT" ? false : true }, { ...preference, notificationType: "ORDER_CREATED", mandatory: true }] });
  }) satisfies typeof fetch };
  assert.equal((await getNotificationPreferences({ context, auth: false })).preferences.length, 2);
  await updateNotificationPreferences({ preferences: [{ notificationType: "BID_OUTBID", channel: "EMAIL", enabled: false }] }, { context });
  assert.deepEqual(requests.map((row) => [row.path, row.method, row.auth]), [
    ["https://api.test/api/v1/notifications/preferences", "GET", "Bearer current"], ["https://api.test/api/v1/notifications/preferences", "PUT", "Bearer current"],
  ]);
  assert.deepEqual(requests[1].body, { preferences: [{ notificationType: "BID_OUTBID", channel: "EMAIL", enabled: false }] });
  for (const preferences of [[{ ...preference, mandatory: true, enabled: false }], [preference, preference], [{ ...preference, channel: "PUSH" }]])
    await assert.rejects(getNotificationPreferences({ context: { fetch: async () => success({ preferences }) } }), invalid);
});

test("delivery filters serialize once, reject incompatible results, and parse exact attempt details", async () => {
  let url = "";
  const context = { baseUrl: "https://api.test", getAccessToken: () => "admin", fetch: (async (input) => { url = String(input); return success([delivery], { number: 0, size: 20, totalElements: 1, totalPages: 1 }); }) satisfies typeof fetch };
  const page = await getNotificationDeliveries({ status: "FAILED", channel: "EMAIL", errorCode: "SMTP_TIMEOUT", from: delivery.createdAt, to: delivery.updatedAt }, { context });
  assert.equal(page.items[0].attemptCount, 2);
  const recovered = await getNotificationDeliveries({ errorCode: "SMTP_TIMEOUT" }, { context: { fetch: async () => success([{ ...delivery, status: "SENT", lastErrorCode: null }], { number: 0, size: 20, totalElements: 1, totalPages: 1 }) } });
  assert.equal(recovered.items[0].status, "SENT");
  assert.deepEqual(Object.fromEntries(new URL(url).searchParams), { page: "0", size: "20", status: "FAILED", channel: "EMAIL", errorCode: "SMTP_TIMEOUT", from: delivery.createdAt, to: delivery.updatedAt });
  await assert.rejects(getNotificationDeliveries({ status: "SENT" }, { context }), invalid);
  let calls = 0;
  await assert.rejects(getNotificationDeliveries({ from: delivery.updatedAt, to: delivery.createdAt }, { context: { fetch: async () => { calls++; return success([]); } } }), invalid);
  assert.equal(calls, 0);
  assert.deepEqual((await getNotificationDelivery(delivery.id, { context: { fetch: async () => success({ ...delivery, attempts: [attempt] }) } })).attempts, [attempt]);
  await assert.rejects(getNotificationDelivery("another", { context: { fetch: async () => success({ ...delivery, attempts: [] }) } }), invalid);
  await assert.rejects(getNotificationDelivery(delivery.id, { context: { fetch: async () => success({ ...delivery, attempts: [{ ...attempt, status: "SENT" }] }) } }), invalid);
});

test("private SSE renews once over HTTP, parses split UTF8 frames, and keeps credentials out of URLs", async () => {
  const requests: { url?: string; authorization?: string }[] = [];
  const server = createServer((request, response) => {
    requests.push({ url: request.url, authorization: request.headers.authorization });
    if (request.headers.authorization === "Bearer expired") { response.writeHead(401, { "content-type": "application/problem+json" }); response.end(JSON.stringify({ title: "Expired" })); return; }
    response.writeHead(200, { "content-type": "text/event-stream" });
    const frame = Buffer.from('event: heartbeat\ndata: ok\n\nevent: notifications\nid: opaque\ndata: {"unreadCount":3,\ndata: "revision":"mới"}\n\n');
    const split = frame.indexOf(Buffer.from("ớ")) + 1;
    response.write(frame.subarray(0, split));
    setTimeout(() => response.end(frame.subarray(split)), 10);
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string");
  let token = "expired", renewals = 0;
  const snapshots: unknown[] = [];
  try {
    await watchNotifications((snapshot) => snapshots.push(snapshot), { context: {
      baseUrl: `http://127.0.0.1:${address.port}`, getAccessToken: () => token, getSessionId: () => 2,
      renewAccessToken: async () => { renewals++; token = "renewed"; return token; },
    } });
    assert.equal(renewals, 1);
    assert.deepEqual(requests, [{ url: "/api/v1/notifications/stream", authorization: "Bearer expired" }, { url: "/api/v1/notifications/stream", authorization: "Bearer renewed" }]);
    assert.deepEqual(snapshots, [{ unreadCount: 3, revision: "mới" }]);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
});

test("SSE cancellation closes a pending read and rejects late events from another session", async () => {
  const controller = new AbortController();
  let canceled = false;
  const context = { getAccessToken: () => "token", getSessionId: () => 1, fetch: (async () => new Response(new ReadableStream({
    start(stream) { stream.enqueue(new TextEncoder().encode('event: notifications\ndata: {"unreadCount":0,"revision":"a"}\n\n')); },
    cancel() { canceled = true; },
  }), { headers: { "content-type": "text/event-stream" } })) satisfies typeof fetch };
  await assert.rejects(watchNotifications(() => controller.abort(), { context, signal: controller.signal }), (error: unknown) => error instanceof DOMException && error.name === "AbortError");
  assert.equal(canceled, true);
  let session = 1, changes = 0;
  await assert.rejects(watchNotifications(() => changes++, { context: { ...context, getSessionId: () => session, fetch: async () => {
    session = 2; return new Response('event: notifications\ndata: {"unreadCount":1,"revision":"b"}\n\n', { headers: { "content-type": "text/event-stream" } });
  } } }), (error: unknown) => isApiError(error) && error.kind === "aborted");
  assert.equal(changes, 0);
});

test("SSE rejects malformed data and non-stream successful responses", async () => {
  for (const response of [new Response("{}", { headers: { "content-type": "application/json" } }), new Response('event: notifications\ndata: {"unreadCount":-1,"revision":"b"}\n\n', { headers: { "content-type": "text/event-stream" } })])
    await assert.rejects(watchNotifications(() => assert.fail("Invalid data must not update the inbox"), { context: { getAccessToken: () => "token", fetch: async () => response } }), invalid);
});
