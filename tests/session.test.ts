import assert from "node:assert/strict";
import { test } from "node:test";
import { createTokenSession, renewalDelay } from "../features/auth/token-session";
import type { OidcClient, OidcSession } from "../features/auth/oidc";

function session(accessToken = "old-token", subject = "buyer-1"): OidcSession {
  return { accessToken, subject, returnTo: "/products/example", expiresAt: Date.now() / 1000 + 120 };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function fixture(renewSession: () => Promise<OidcSession>) {
  const published: OidcSession[] = [];
  let failures = 0;
  let renewals = 0;
  const oidc: OidcClient = {
    signIn: async () => {}, completeSignIn: async () => session(),
    restoreSession: async () => session(), completeSilentSignIn: async () => {},
    renewSession: async () => { renewals++; return renewSession(); },
    signOut: async () => {}, clearSession: async () => {},
  };
  const coordinator = createTokenSession({
    oidc, onRenew: (next) => { published.push(next); }, onFailure: () => { failures++; },
  });
  return { coordinator, published, get failures() { return failures; }, get renewals() { return renewals; } };
}

test("parallel 401s from different clients and proactive renewal share one session operation", async () => {
  const pending = deferred<OidcSession>();
  const context = fixture(() => pending.promise);
  context.coordinator.start(session());
  const first = context.coordinator.renewAccessToken("old-token");
  const second = context.coordinator.renewAccessToken("old-token");
  const proactive = context.coordinator.renew();
  assert.equal(first, second);
  assert.equal(first, proactive);
  await Promise.resolve();
  assert.equal(context.renewals, 1);
  pending.resolve(session("new-token"));
  assert.deepEqual(await Promise.all([first, second, proactive]), ["new-token", "new-token", "new-token"]);
  assert.equal(context.coordinator.getAccessToken(), "new-token");
  assert.equal(context.published.length, 1);
  assert.equal(context.failures, 0);
});

test("a late 401 from a previously renewed token returns the current token without another provider call", async () => {
  let index = 0;
  const context = fixture(async () => session(`new-token-${++index}`));
  context.coordinator.start(session());
  assert.equal(await context.coordinator.renew(), "new-token-1");
  assert.equal(await context.coordinator.renewAccessToken("old-token"), "new-token-1");
  assert.equal(await context.coordinator.renewAccessToken("new-token-1"), "new-token-2");
  assert.equal(await context.coordinator.renewAccessToken("old-token"), "new-token-2");
  assert.equal(await context.coordinator.renewAccessToken("new-token-1"), "new-token-2");
  assert.equal(context.renewals, 2);
});

test("the replacement token is published before the consumer callback runs", async () => {
  const next = session("replacement");
  let visibleDuringCallback: string | null = null;
  const coordinator = createTokenSession({
    oidc: { renewSession: async () => next } as OidcClient,
    onRenew: () => { visibleDuringCallback = coordinator.getAccessToken(); },
    onFailure: () => { assert.fail("renewal should succeed"); },
  });
  coordinator.start(session());
  assert.equal(await coordinator.renew(), "replacement");
  assert.equal(visibleDuringCallback, "replacement");
});

test("logout invalidates a pending renewal and a late success cannot restore the user", async () => {
  const pending = deferred<OidcSession>();
  const context = fixture(() => pending.promise);
  context.coordinator.start(session());
  const renewal = context.coordinator.renew();
  await Promise.resolve();
  context.coordinator.clear();
  pending.resolve(session("too-late"));
  assert.equal(await renewal, null);
  assert.equal(context.coordinator.getAccessToken(), null);
  assert.equal(context.coordinator.getSession(), null);
  assert.deepEqual(context.published, []);
  assert.equal(context.failures, 0);
});

test("a late failure from an old session cannot clear a newer user's session", async () => {
  const pending = deferred<OidcSession>();
  const context = fixture(() => pending.promise);
  context.coordinator.start(session());
  const renewal = context.coordinator.renew();
  await Promise.resolve();
  const otherUser = session("other-user-token", "buyer-2");
  context.coordinator.start(otherUser);
  pending.reject(new Error("Old provider request failed"));
  assert.equal(await renewal, null);
  assert.deepEqual(context.coordinator.getSession(), otherUser);
  assert.equal(context.failures, 0);
  assert.equal(await context.coordinator.renewAccessToken("old-token"), null);
  assert.equal(context.renewals, 1);
});

test("a late success from an old session cannot overwrite a newer user's token", async () => {
  const pending = deferred<OidcSession>();
  const context = fixture(() => pending.promise);
  context.coordinator.start(session());
  const renewal = context.coordinator.renew();
  await Promise.resolve();
  context.coordinator.start(session("other-user-token", "buyer-2"));
  pending.resolve(session("late-old-user-token"));
  assert.equal(await renewal, null);
  assert.equal(context.coordinator.getAccessToken(), "other-user-token");
  assert.deepEqual(context.published, []);
  assert.equal(context.failures, 0);
});

test("renewal that changes subject clears the active session once for all callers", async () => {
  const pending = deferred<OidcSession>();
  const context = fixture(() => pending.promise);
  context.coordinator.start(session());
  const calls = [context.coordinator.renew(), context.coordinator.renewAccessToken("old-token")];
  pending.resolve(session("different-user-token", "buyer-2"));
  assert.deepEqual(await Promise.all(calls), [null, null]);
  assert.equal(context.coordinator.getAccessToken(), null);
  assert.equal(context.failures, 1);
  assert.deepEqual(context.published, []);
});

test("failed renewal clears credentials once and further callers stay anonymous", async () => {
  const pending = deferred<OidcSession>();
  const context = fixture(() => pending.promise);
  context.coordinator.start(session());
  const calls = [context.coordinator.renew(), context.coordinator.renewAccessToken("old-token"), context.coordinator.renew()];
  pending.reject(new Error("Provider timeout with sensitive internal response"));
  assert.deepEqual(await Promise.all(calls), [null, null, null]);
  assert.equal(context.failures, 1);
  assert.equal(context.renewals, 1);
  assert.equal(await context.coordinator.renew(), null);
  assert.equal(await context.coordinator.renewAccessToken("old-token"), null);
  assert.equal(context.failures, 1);
});

test("unknown tokens and tokens from a prior interactive login cannot trigger renewal", async () => {
  const context = fixture(async () => session("new-token"));
  assert.equal(await context.coordinator.renewAccessToken("unknown"), null);
  context.coordinator.start(session());
  assert.equal(await context.coordinator.renewAccessToken("other-session-token"), null);
  context.coordinator.start(session("new-login-token"));
  assert.equal(await context.coordinator.renewAccessToken("old-token"), null);
  assert.equal(context.coordinator.getAccessToken(), "new-login-token");
  assert.equal(context.renewals, 0);
});

test("session input and snapshots cannot mutate the coordinator's active identity", () => {
  const context = fixture(async () => session("new-token"));
  const original = session();
  context.coordinator.start(original);
  original.accessToken = "mutated-input";
  const snapshot = context.coordinator.getSession();
  assert.ok(snapshot);
  snapshot.accessToken = "mutated-snapshot";
  snapshot.subject = "other-user";
  assert.equal(context.coordinator.getAccessToken(), "old-token");
  assert.equal(context.coordinator.getSession()?.subject, "buyer-1");
});

test("expired, nonfinite or empty renewed tokens are rejected instead of being published", async () => {
  for (const next of [
    { ...session("new-token"), expiresAt: Date.now() / 1000 - 1 },
    { ...session("new-token"), expiresAt: NaN },
    { ...session("new-token"), expiresAt: Infinity },
    session(""),
  ]) {
    const context = fixture(async () => next);
    context.coordinator.start(session());
    assert.equal(await context.coordinator.renew(), null);
    assert.equal(context.coordinator.getSession(), null);
    assert.equal(context.failures, 1);
    assert.deepEqual(context.published, []);
  }
});

test("renewal delay respects two-minute tokens, short lifetimes, expired tokens and browser timer bounds", () => {
  const nowMs = 1_000_000;
  assert.equal(renewalDelay(nowMs / 1000 + 120, nowMs), 60_000);
  assert.equal(renewalDelay(nowMs / 1000 + 30, nowMs), 15_000);
  assert.equal(renewalDelay(nowMs / 1000 + 1, nowMs), 1_000);
  assert.equal(renewalDelay(nowMs / 1000, nowMs), 1_000);
  assert.equal(renewalDelay(nowMs / 1000 - 120, nowMs), 1_000);
  assert.equal(renewalDelay(Number.MAX_SAFE_INTEGER, nowMs), 2_147_483_647);
  assert.equal(renewalDelay(NaN, nowMs), 1_000);
  assert.equal(renewalDelay(Infinity, nowMs), 1_000);
});
