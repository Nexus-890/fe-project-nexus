import assert from "node:assert/strict";
import test from "node:test";
import { isApiError } from "../configs/api";
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATION_ENDPOINTS,
} from "../service/notificationService";
import type { ApiError } from "../types/commonResponseType";

const notification = {
  id: "68000000-0000-4000-8000-000000000003",
  type: "ORDER_CREATED",
  title: "Order placed",
  content: "Your order was placed.",
  readAt: null,
  createdAt: "2026-10-29T08:00:00Z",
};
const page = { number: 0, size: 10, totalElements: 1, totalPages: 1 };
const success = (data: unknown, pageInfo?: unknown) =>
  new Response(
    JSON.stringify({ code: 0, message: "response success", data, page: pageInfo }),
    { headers: { "Content-Type": "application/json" } },
  );
const errorIs = (verify: (error: ApiError) => void) => (error: unknown) => {
  assert.ok(isApiError(error));
  verify(error);
  return true;
};

test("notifications use the shared origin, latest-ten parameters and current protected token", async () => {
  const seen: Array<{ url: string; authorization: string | null }> = [];
  let token = "buyer-token";
  const context = {
    baseUrl: "https://api.test/",
    getAccessToken: () => token,
    fetch: (async (input, init) => {
      seen.push({
        url: String(input),
        authorization: new Headers(init?.headers).get("Authorization"),
      });
      return String(input).includes("unread-count")
        ? success({ count: 37 })
        : success([notification], page);
    }) satisfies typeof fetch,
  };
  assert.deepEqual(await getNotifications({}, { context, auth: false }), {
    content: [notification],
    page: 0,
    size: 10,
    totalElements: 1,
    totalPages: 1,
  });
  token = "new-buyer-token";
  assert.equal(await getUnreadNotificationCount({ context }), 37);
  assert.deepEqual(seen, [
    {
      url: "https://api.test/api/v1/notifications?page=0&size=10",
      authorization: "Bearer buyer-token",
    },
    {
      url: "https://api.test/api/v1/notifications/unread-count",
      authorization: "Bearer new-buyer-token",
    },
  ]);
});

test("notification list rejects incompatible wire shapes and invalid timestamps", async () => {
  for (const [data, pageInfo] of [
    [[notification], undefined],
    [[{ ...notification, readAt: undefined }], page],
    [[{ ...notification, createdAt: "invalid" }], page],
    [[{ ...notification, readAt: "invalid" }], page],
    [[{ ...notification, title: 42 }], page],
    [{ content: [notification] }, page],
  ]) {
    await assert.rejects(
      getNotifications({}, {
        context: { fetch: async () => success(data, pageInfo) },
      }),
      errorIs((error) => assert.equal(error.kind, "invalid-response")),
    );
  }
  const empty = await getNotifications({}, {
    context: {
      fetch: async () => success([], { ...page, totalElements: 0, totalPages: 0 }),
    },
  });
  assert.deepEqual(empty.content, []);
});

test("unread count accepts zero and rejects malformed or negative counts", async () => {
  assert.equal(await getUnreadNotificationCount({
    context: { fetch: async () => success({ count: 0 }) },
  }), 0);
  for (const data of [{ count: -1 }, { count: 1.5 }, { count: "2" }, {}, null]) {
    await assert.rejects(
      getUnreadNotificationCount({ context: { fetch: async () => success(data) } }),
      errorIs((error) => assert.equal(error.kind, "invalid-response")),
    );
  }
});

test("invalid pagination and explicit cancellation never become successful notification requests", async () => {
  let calls = 0;
  const context = {
    fetch: (async () => {
      calls++;
      return success([notification], page);
    }) satisfies typeof fetch,
  };
  for (const filters of [
    { page: -1 }, { page: 0.5 }, { size: 0 }, { size: 101 },
  ]) {
    await assert.rejects(
      getNotifications(filters, { context }),
      errorIs((error) => assert.equal(error.kind, "invalid-response")),
    );
  }
  await assert.rejects(
    getNotifications({}, { context, signal: AbortSignal.abort() }),
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  );
  assert.equal(calls, 0);
});

test("blank mutation endpoints report unavailable and never PATCH the API origin", async () => {
  const originalRead = NOTIFICATION_ENDPOINTS.read;
  const originalReadAll = NOTIFICATION_ENDPOINTS.readAll;
  let calls = 0;
  const options = {
    context: {
      baseUrl: "https://api.test",
      getAccessToken: () => "private-token",
      fetch: (async () => {
        calls++;
        return new Response(null, { status: 204 });
      }) satisfies typeof fetch,
    },
  };
  try {
    NOTIFICATION_ENDPOINTS.read = "";
    NOTIFICATION_ENDPOINTS.readAll = "";
    for (const action of [
      () => markNotificationRead(notification.id, options),
      () => markAllNotificationsRead(options),
    ]) {
      await assert.rejects(action(), errorIs((error) => {
        assert.equal(error.kind, "invalid-response");
        assert.equal(error.status, 0);
        assert.equal(error.code, "NOTIFICATION_ENDPOINT_NOT_CONFIGURED");
      }));
    }
    assert.equal(calls, 0);
  } finally {
    NOTIFICATION_ENDPOINTS.read = originalRead;
    NOTIFICATION_ENDPOINTS.readAll = originalReadAll;
  }
});

test("delivered mutation paths encode IDs and support authenticated bodyless PATCH/204", async () => {
  assert.equal(NOTIFICATION_ENDPOINTS.read, "/api/v1/notifications/:id/read");
  assert.equal(NOTIFICATION_ENDPOINTS.readAll, "/api/v1/notifications/read-all");
  const seen: Array<{
    url: string;
    method: string | undefined;
    authorization: string | null;
    body: BodyInit | null | undefined;
  }> = [];
  let token = "private-token";
  const options = {
    context: {
      baseUrl: "https://api.test",
      getAccessToken: () => token,
      fetch: (async (input, init) => {
        seen.push({
          url: String(input),
          method: init?.method,
          authorization: new Headers(init?.headers).get("Authorization"),
          body: init?.body,
        });
        return new Response(null, { status: 204 });
      }) satisfies typeof fetch,
    },
  };
  assert.equal(await markNotificationRead("id/with?query", { ...options, auth: false }), undefined);
  token = "new-private-token";
  assert.equal(await markAllNotificationsRead({ ...options, auth: false }), undefined);
  assert.deepEqual(seen, [
    {
      url: "https://api.test/api/v1/notifications/id%2Fwith%3Fquery/read",
      method: "PATCH",
      authorization: "Bearer private-token",
      body: undefined,
    },
    {
      url: "https://api.test/api/v1/notifications/read-all",
      method: "PATCH",
      authorization: "Bearer new-private-token",
      body: undefined,
    },
  ]);
});

test("read mutations reject blank IDs, honor cancellation and propagate backend errors", async () => {
  let calls = 0;
  const context = {
    fetch: (async () => {
      calls++;
      return new Response(JSON.stringify({ title: "Unavailable", status: 503 }), {
        status: 503,
        headers: { "Content-Type": "application/problem+json" },
      });
    }) satisfies typeof fetch,
  };
  await assert.rejects(
    markNotificationRead(" ", { context }),
    errorIs((error) => assert.equal(error.kind, "invalid-response")),
  );
  for (const action of [markNotificationRead.bind(null, notification.id), markAllNotificationsRead]) {
    await assert.rejects(
      action({ context, signal: AbortSignal.abort() }),
      (error: unknown) => error instanceof DOMException && error.name === "AbortError",
    );
  }
  assert.equal(calls, 0);
  for (const action of [markNotificationRead.bind(null, notification.id), markAllNotificationsRead]) {
    await assert.rejects(action({ context }), errorIs((error) => {
      assert.equal(error.kind, "http");
      assert.equal(error.status, 503);
    }));
  }
  assert.equal(calls, 2);
});
