import assert from "node:assert/strict";
import { test } from "node:test";
import { isApiError, requestApi } from "../configs/api";
import { createTokenSession } from "../features/tokenSession";
import type { OidcClient } from "../features/oidc";
import type { ApiError } from "../types/commonResponseType";
import type { ApiContext } from "../types/commonRequestType";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});
const success = (data: unknown) => json({ code: 0, message: "response success", data });
const unauthorized = () => json({ title: "Unauthorized", detail: "Access token rejected" }, 401);
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
const errorIs = (verify: (error: ApiError) => void) => (error: unknown) => {
  assert.ok(isApiError(error));
  verify(error);
  return true;
};
const statusIs = (status: number) => errorIs((error) => assert.equal(error.status, status));
const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
// The provider owns renewal sharing across services. Exercise that real
// coordinator rather than giving the HTTP boundary a fake shared promise.
function tokenContext(renew: () => Promise<string | null>): ApiContext {
  const session = (accessToken: string) => ({ accessToken, subject: "buyer-1", returnTo: "/", expiresAt: Date.now() / 1000 + 120 });
  const tokens = createTokenSession({
    oidc: { renewSession: async () => {
      const next = await renew();
      if (!next) throw new Error("Fixture renewal failed");
      return session(next);
    } } as OidcClient,
    onRenew: () => {}, onFailure: () => {},
  });
  tokens.start(session("old-token"));
  return { getAccessToken: tokens.getAccessToken, renewAccessToken: tokens.renewAccessToken };
}

test("protected GET, POST, PUT, PATCH and DELETE requests share renewal and replay captured requests once", async () => {
  let renewals = 0;
  const allInitial = deferred<void>();
  const started = deferred<void>();
  const completed = deferred<string | null>();
  const calls: Array<{ path: string; method: string; authorization: string | null; body: unknown; trace: string | null }> = [];
  const context: ApiContext = {
    ...tokenContext(async () => { renewals++; started.resolve(); return completed.promise; }),
    baseUrl: "https://api.example.test",
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      const authorization = headers.get("Authorization");
      calls.push({ path: new URL(String(input)).pathname, method: init?.method ?? "GET", authorization,
        body: init?.body, trace: headers.get("X-Trace") });
      if (authorization === "Bearer old-token") {
        if (calls.length === 5) allInitial.resolve();
        await allInitial.promise;
        return unauthorized();
      }
      return success({ authorization });
    },
  };
  const payload = { skuId: "sku-1", quantity: 2 };
  const requests = (["GET", "POST", "PUT", "PATCH", "DELETE"] as const).map((method) =>
    requestApi(method, `/test/${method}`, method === "GET" ? undefined : payload, {
      context, config: { headers: { "X-Trace": "same-request" } },
    }));
  await started.promise;
  await flush();
  assert.equal(renewals, 1);
  payload.quantity = 99;
  completed.resolve("new-token");
  assert.ok((await Promise.all(requests)).every((response) => response.code === 0));
  assert.equal(renewals, 1);
  assert.equal(calls.length, 10);
  for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
    const attempts = calls.filter((call) => call.method === method);
    assert.equal(attempts.length, 2);
    assert.equal(attempts[0].authorization, "Bearer old-token");
    assert.equal(attempts[1].authorization, "Bearer new-token");
    assert.equal(attempts[0].path, attempts[1].path);
    assert.equal(attempts[0].body, attempts[1].body);
    assert.equal(attempts[0].trace, attempts[1].trace);
  }
  assert.equal(calls.find((call) => call.method === "POST")?.body, '{"skuId":"sku-1","quantity":2}');
});

test("a second 401 rejects after two sends and one renewal", async () => {
  let token = "old-token", renewals = 0, attempts = 0;
  const context: ApiContext = {
    getAccessToken: () => token,
    renewAccessToken: async () => { renewals++; token = "new-token"; return token; },
    fetch: async () => { attempts++; return unauthorized(); },
  };
  await assert.rejects(requestApi("GET", "/me", undefined, { context }), statusIs(401));
  assert.equal(attempts, 2);
  assert.equal(renewals, 1);
});

test("public requests, requests without a token and 403 responses never renew", async () => {
  let renewals = 0;
  for (const scenario of [
    { token: null, auth: true, status: 401 },
    { token: "member-token", auth: false, status: 401 },
    { token: "member-token", auth: true, status: 403 },
  ]) {
    let attempts = 0;
    const context: ApiContext = {
      getAccessToken: () => scenario.token,
      renewAccessToken: async () => { renewals++; return "replacement"; },
      fetch: async (_, init) => {
        attempts++;
        if (!scenario.token || !scenario.auth) assert.equal(new Headers(init?.headers).has("Authorization"), false);
        return json({ title: "Rejected" }, scenario.status);
      },
    };
    await assert.rejects(requestApi("GET", "/me", undefined, { context, auth: scenario.auth }), statusIs(scenario.status));
    assert.equal(attempts, 1);
  }
  assert.equal(renewals, 0);
});

test("network errors never retry or trigger token renewal", async () => {
  let attempts = 0, renewals = 0;
  const context: ApiContext = {
    getAccessToken: () => "member-token",
    renewAccessToken: async () => { renewals++; return "replacement"; },
    fetch: async () => { attempts++; throw new Error("Connection unavailable"); },
  };
  await assert.rejects(requestApi("GET", "/me", undefined, { context }), errorIs((error) => assert.equal(error.kind, "network")));
  assert.equal(attempts, 1);
  assert.equal(renewals, 0);
});

test("a renewal outage surfaces as that outage instead of the 401, without a replay or provider details", async () => {
  for (const outage of [
    { kind: "http", status: 503, title: "Service Unavailable", detail: "upstream secret" },
    { kind: "http", status: 504, title: "Gateway Timeout", detail: "upstream secret" },
    { kind: "network", status: 0, title: "Network request failed", detail: "upstream secret" },
  ]) {
    let attempts = 0, failures = 0;
    const tokens = createTokenSession({
      oidc: { renewSession: async () => { throw outage; } } as unknown as OidcClient,
      onRenew: () => {}, onFailure: () => { failures++; },
    });
    tokens.start({ accessToken: "old-token", subject: "buyer-1", returnTo: "/", expiresAt: Date.now() / 1000 + 120 });
    const context: ApiContext = {
      getAccessToken: tokens.getAccessToken, renewAccessToken: tokens.renewAccessToken,
      fetch: async () => { attempts++; return unauthorized(); },
    };
    await assert.rejects(requestApi("PUT", "/me", { fullName: "Lan" }, { context }), errorIs((error) => {
      assert.deepEqual(error, { kind: outage.kind, status: outage.status, title: "Session renewal is temporarily unavailable." });
    }));
    assert.equal(attempts, 1);
    assert.equal(failures, 0);
    assert.equal(tokens.getAccessToken(), "old-token");
  }
});

test("failed renewal preserves original 401 and hides provider exception details", async () => {
  for (const throws of [false, true]) {
    let attempts = 0;
    const context: ApiContext = {
      getAccessToken: () => "member-token",
      renewAccessToken: async () => {
        if (throws) throw new Error("Provider contains confidential-code-and-token");
        return null;
      },
      fetch: async () => { attempts++; return unauthorized(); },
    };
    await assert.rejects(requestApi("GET", "/me", undefined, { context }), errorIs((error) => {
      assert.equal(error.kind, "http");
      assert.equal(error.status, 401);
      assert.equal(error.detail, "Access token rejected");
      assert.ok(!JSON.stringify(error).includes("confidential-code-and-token"));
    }));
    assert.equal(attempts, 1);
  }
});

test("failed renewal preserves all concurrent 401s after clearing the generation and never renews a newer account", async () => {
  for (const nextToken of [null, "new-account-token"]) {
    for (const throws of [false, true]) {
      let token: string | null = "old-token";
      let sessionId = 1, renewals = 0;
      const allStarted = deferred<void>();
      const renewalFinished = deferred<void>();
      const lateResponses = deferred<void>();
      const calls: Array<{ path: string; authorization: string | null }> = [];
      const context: ApiContext = {
        baseUrl: "https://api.example.test",
        getAccessToken: () => token,
        getSessionId: () => sessionId,
        renewAccessToken: async (failedToken) => {
          assert.equal(failedToken, "old-token");
          renewals++;
          token = null;
          sessionId++;
          renewalFinished.resolve();
          if (throws) throw new Error("Sensitive identity provider response");
          return null;
        },
        fetch: async (input, init) => {
          const path = new URL(String(input)).pathname;
          calls.push({ path, authorization: new Headers(init?.headers).get("Authorization") });
          if (calls.length === 3) allStarted.resolve();
          await allStarted.promise;
          if (path !== "/first") await lateResponses.promise;
          return unauthorized();
        },
      };
      const requests = ["first", "late-a", "late-b"].map((key) =>
        requestApi("GET", `/${key}`, undefined, { context }));
      const outcomes = Promise.allSettled(requests);
      await renewalFinished.promise;
      await assert.rejects(requests[0], statusIs(401));
      // Model either remaining logged out or completing a new login before
      // the two old requests finally receive their initial rejection.
      token = nextToken;
      if (nextToken) sessionId++;
      lateResponses.resolve();
      for (const result of await outcomes) {
        assert.equal(result.status, "rejected");
        if (result.status !== "rejected") continue;
        assert.ok(isApiError(result.reason));
        assert.equal(result.reason.kind, "http");
        assert.equal(result.reason.status, 401);
        assert.equal(result.reason.detail, "Access token rejected");
        assert.ok(!JSON.stringify(result.reason).includes("Sensitive identity"));
      }
      assert.equal(renewals, 1);
      assert.deepEqual(calls, [
        { path: "/first", authorization: "Bearer old-token" },
        { path: "/late-a", authorization: "Bearer old-token" },
        { path: "/late-b", authorization: "Bearer old-token" },
      ]);
      assert.equal(token, nextToken);
    }
  }
});

test("logout or account switch during renewal prevents request replay", async () => {
  for (const nextToken of [null, "different-user-token"]) {
    let token: string | null = "old-token";
    let attempts = 0;
    const started = deferred<void>();
    const completed = deferred<string | null>();
    const context: ApiContext = {
      getAccessToken: () => token,
      renewAccessToken: async () => { started.resolve(); return completed.promise; },
      fetch: async () => { attempts++; return unauthorized(); },
    };
    const pending = requestApi("POST", "/cart/items", { quantity: 1 }, { context });
    await started.promise;
    token = nextToken;
    completed.resolve("old-session-replacement");
    await assert.rejects(pending, statusIs(401));
    assert.equal(attempts, 1);
  }
});

test("logout before a late 401 does not start renewal", async () => {
  let token: string | null = "old-token";
  let renewals = 0;
  const started = deferred<void>(), response = deferred<Response>();
  const context: ApiContext = {
    getAccessToken: () => token,
    renewAccessToken: async () => { renewals++; return "replacement"; },
    fetch: async () => { started.resolve(); return response.promise; },
  };
  const pending = requestApi("GET", "/me", undefined, { context });
  await started.promise;
  token = null;
  response.resolve(unauthorized());
  await assert.rejects(pending, statusIs(401));
  assert.equal(renewals, 0);
});

test("canceling one request waiting for shared renewal leaves another retry active", async () => {
  let renewals = 0;
  const started = deferred<void>(), completed = deferred<string | null>();
  const paths: string[] = [];
  const context: ApiContext = {
    ...tokenContext(async () => { renewals++; started.resolve(); return completed.promise; }),
    baseUrl: "https://api.example.test",
    fetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      const authorization = new Headers(init?.headers).get("Authorization");
      paths.push(`${path}:${authorization}`);
      return authorization === "Bearer old-token" ? unauthorized() : success({ path });
    },
  };
  const abort = new AbortController();
  const canceled = requestApi("GET", "/canceled", undefined, { context, signal: abort.signal });
  const survivor = requestApi("GET", "/survivor", undefined, { context });
  await started.promise;
  await flush();
  const rejected = assert.rejects(canceled, isAbort);
  abort.abort();
  await rejected;
  completed.resolve("new-token");
  assert.deepEqual((await survivor).data, { path: "/survivor" });
  assert.equal(renewals, 1);
  assert.deepEqual(paths, ["/canceled:Bearer old-token", "/survivor:Bearer old-token", "/survivor:Bearer new-token"]);
});

test("an already canceled request never reaches transport or renewal", async () => {
  const controller = new AbortController();
  controller.abort();
  let attempts = 0, renewals = 0;
  const context: ApiContext = {
    getAccessToken: () => "old-token",
    renewAccessToken: async () => { renewals++; return "new-token"; },
    fetch: async () => { attempts++; return unauthorized(); },
  };
  await assert.rejects(requestApi("GET", "/me", undefined, { context, signal: controller.signal }), isAbort);
  assert.equal(attempts, 0);
  assert.equal(renewals, 0);
});

test("session changes discard late protected successes even if a new login reuses a token", async () => {
  let sessionId = 1, renewals = 0;
  const started = deferred<void>(), response = deferred<Response>();
  const context: ApiContext = {
    getAccessToken: () => "same-token", getSessionId: () => sessionId,
    renewAccessToken: async () => { renewals++; return "same-token"; },
    fetch: async () => { started.resolve(); return response.promise; },
  };
  const pending = requestApi("GET", "/me", undefined, { context });
  await started.promise;
  sessionId++;
  response.resolve(success({ id: "previous-account" }));
  await assert.rejects(pending, errorIs((error) => assert.equal(error.kind, "aborted")));
  assert.equal(renewals, 0);
});

test("a session change during renewal cannot replay a write under the new login", async () => {
  let sessionId = 1, token = "old-token", attempts = 0;
  const started = deferred<void>(), completed = deferred<string | null>();
  const context: ApiContext = {
    getAccessToken: () => token, getSessionId: () => sessionId,
    renewAccessToken: async () => { started.resolve(); return completed.promise; },
    fetch: async () => { attempts++; return unauthorized(); },
  };
  const pending = requestApi("PUT", "/cart/items/item-1", { quantity: 2 }, { context });
  await started.promise;
  sessionId++;
  token = "replacement";
  completed.resolve("replacement");
  await assert.rejects(pending, errorIs((error) => assert.equal(error.kind, "aborted")));
  assert.equal(attempts, 1);
});
