import assert from "node:assert/strict";
import { test } from "node:test";
import { createApiClient } from "../lib/api-client";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});
const unauthorized = () => json({ title: "Unauthorized", detail: "Access token rejected" }, 401);
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

test("three concurrent protected 401s share one renewal and replay each request once", async () => {
  let token: string | null = "old-token";
  let renewals = 0;
  const allInitialRequests = deferred<void>();
  const renewalStarted = deferred<void>();
  const renewed = deferred<string | null>();
  const calls: Array<{ path: string; method: string; authorization: string | null; body: unknown; trace: string | null }> = [];
  const client = createApiClient({
    baseUrl: "https://api.example.test", getAccessToken: () => token,
    renewAccessToken: async (failedToken) => {
      assert.equal(failedToken, "old-token");
      renewals++;
      renewalStarted.resolve();
      token = await renewed.promise;
      return token;
    },
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      const authorization = headers.get("Authorization");
      calls.push({ path: new URL(String(input)).pathname, method: init?.method ?? "GET",
        authorization, body: init?.body, trace: headers.get("X-Trace") });
      if (authorization === "Bearer old-token") {
        if (calls.length === 3) allInitialRequests.resolve();
        await allInitialRequests.promise;
        return unauthorized();
      }
      return json({ authorization, path: new URL(String(input)).pathname });
    },
  });

  const payload = { skuId: "sku-1", quantity: 2 };
  const requests = [
    client.get("/api/v1/users/me"),
    client.get("/api/v1/carts/me"),
    client.post("/api/v1/carts/me/items", payload, { config: { headers: { "X-Trace": "same-request" } } }),
  ];
  await renewalStarted.promise;
  await flush();
  assert.equal(renewals, 1);
  payload.quantity = 99;
  renewed.resolve("new-token");
  const results = await Promise.all(requests);

  assert.ok(results.every((result) => result.ok));
  assert.equal(renewals, 1);
  assert.equal(calls.length, 6);
  for (const path of ["/api/v1/users/me", "/api/v1/carts/me", "/api/v1/carts/me/items"]) {
    const attempts = calls.filter((call) => call.path === path);
    assert.equal(attempts.length, 2);
    assert.equal(attempts[0].authorization, "Bearer old-token");
    assert.equal(attempts[1].authorization, "Bearer new-token");
    assert.equal(attempts[0].method, attempts[1].method);
    assert.equal(attempts[0].body, attempts[1].body);
    assert.equal(attempts[0].trace, attempts[1].trace);
  }
  assert.equal(calls.find((call) => call.method === "POST")?.body, '{"skuId":"sku-1","quantity":2}');
});

test("a second 401 after retry returns immediately without a second renewal", async () => {
  let token = "old-token";
  let renewals = 0;
  let attempts = 0;
  const client = createApiClient({
    getAccessToken: () => token,
    renewAccessToken: async () => { renewals++; token = "new-token"; return token; },
    fetch: async () => { attempts++; return unauthorized(); },
  });
  const result = await client.get("/api/v1/users/me");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.status, 401);
  assert.equal(attempts, 2);
  assert.equal(renewals, 1);
});

test("public requests, requests without a token, and 403 failures never renew", async () => {
  let renewals = 0;
  for (const scenario of [
    { token: null, auth: true, status: 401 },
    { token: "member-token", auth: false, status: 401 },
    { token: "member-token", auth: true, status: 403 },
  ]) {
    let attempts = 0;
    const client = createApiClient({
      getAccessToken: () => scenario.token,
      renewAccessToken: async () => { renewals++; return "replacement"; },
      fetch: async (_, init) => {
        attempts++;
        if (!scenario.token || !scenario.auth) assert.equal(new Headers(init?.headers).has("Authorization"), false);
        return json({ title: "Request rejected" }, scenario.status);
      },
    });
    const result = await client.get("/api/v1/users/me", { auth: scenario.auth });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.status, scenario.status);
    assert.equal(attempts, 1);
  }
  assert.equal(renewals, 0);
});

test("a network error is not retried or treated as a token failure", async () => {
  let attempts = 0;
  let renewals = 0;
  const client = createApiClient({
    getAccessToken: () => "member-token",
    renewAccessToken: async () => { renewals++; return "replacement"; },
    fetch: async () => { attempts++; throw new Error("Connection unavailable"); },
  });
  const result = await client.get("/api/v1/users/me");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.kind, "network");
  assert.equal(attempts, 1);
  assert.equal(renewals, 0);
});

test("a failed renewal preserves the original 401 and never leaks provider exception details", async () => {
  for (const throws of [false, true]) {
    let attempts = 0;
    const client = createApiClient({
      getAccessToken: () => "member-token",
      renewAccessToken: async () => {
        if (throws) throw new Error("Provider URL contains confidential-code-and-token");
        return null;
      },
      fetch: async () => { attempts++; return unauthorized(); },
    });
    const result = await client.get("/api/v1/users/me");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.kind, "http");
      assert.equal(result.error.status, 401);
      assert.equal(result.error.detail, "Access token rejected");
    }
    assert.ok(!JSON.stringify(result).includes("confidential-code-and-token"));
    assert.equal(attempts, 1);
  }
});

test("logout while a renewal is pending prevents the request from replaying", async () => {
  let token: string | null = "old-token";
  let attempts = 0;
  const started = deferred<void>();
  const completed = deferred<string | null>();
  const client = createApiClient({
    getAccessToken: () => token,
    renewAccessToken: async () => { started.resolve(); return completed.promise; },
    fetch: async () => { attempts++; return unauthorized(); },
  });
  const pending = client.get("/api/v1/users/me");
  await started.promise;
  token = null;
  completed.resolve("replacement-from-old-session");
  const result = await pending;
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.status, 401);
  assert.equal(attempts, 1);
});

test("a replacement from an earlier session cannot replay with another user's current token", async () => {
  let token = "first-user-token";
  let attempts = 0;
  const started = deferred<void>();
  const completed = deferred<string | null>();
  const client = createApiClient({
    getAccessToken: () => token,
    renewAccessToken: async () => { started.resolve(); return completed.promise; },
    fetch: async () => { attempts++; return unauthorized(); },
  });
  const pending = client.post("/api/v1/carts/me/items", { skuId: "sku-1", quantity: 1 });
  await started.promise;
  token = "different-user-token";
  completed.resolve("first-user-replacement");
  assert.equal((await pending).ok, false);
  assert.equal(attempts, 1);
});

test("logout before a late 401 arrives does not start a renewal", async () => {
  let token: string | null = "old-token";
  let renewals = 0;
  const started = deferred<void>();
  const response = deferred<Response>();
  const client = createApiClient({
    getAccessToken: () => token,
    renewAccessToken: async () => { renewals++; return "replacement"; },
    fetch: async () => { started.resolve(); return response.promise; },
  });
  const pending = client.get("/api/v1/users/me");
  await started.promise;
  token = null;
  response.resolve(unauthorized());
  assert.equal((await pending).ok, false);
  assert.equal(renewals, 0);
});

test("canceling one request waiting for shared renewal does not cancel the other request's retry", async () => {
  let token: string | null = "old-token";
  let renewals = 0;
  const started = deferred<void>();
  const completed = deferred<string | null>();
  const paths: string[] = [];
  const client = createApiClient({
    baseUrl: "https://api.example.test", getAccessToken: () => token,
    renewAccessToken: async () => { renewals++; started.resolve(); token = await completed.promise; return token; },
    fetch: async (input, init) => {
      const url = new URL(String(input));
      const authorization = new Headers(init?.headers).get("Authorization");
      paths.push(`${url.pathname}:${authorization}`);
      return authorization === "Bearer old-token" ? unauthorized() : json({ path: url.pathname });
    },
  });
  const abort = new AbortController();
  const canceled = client.get("/canceled", { signal: abort.signal });
  const survivor = client.get("/survivor");
  await started.promise;
  await flush();
  const rejected = assert.rejects(canceled, (error: unknown) => error instanceof DOMException && error.name === "AbortError");
  abort.abort();
  await rejected;
  completed.resolve("new-token");
  assert.equal((await survivor).ok, true);
  assert.equal(renewals, 1);
  assert.deepEqual(paths, ["/canceled:Bearer old-token", "/survivor:Bearer old-token", "/survivor:Bearer new-token"]);
});

test("an already canceled request never reaches the transport or renewal hook", async () => {
  const controller = new AbortController();
  controller.abort();
  let attempts = 0;
  let renewals = 0;
  const client = createApiClient({
    getAccessToken: () => "old-token",
    renewAccessToken: async () => { renewals++; return "new-token"; },
    fetch: async () => { attempts++; return unauthorized(); },
  });
  await assert.rejects(client.get("/api/v1/users/me", { signal: controller.signal }),
    (error: unknown) => error instanceof DOMException && error.name === "AbortError");
  assert.equal(attempts, 0);
  assert.equal(renewals, 0);
});
