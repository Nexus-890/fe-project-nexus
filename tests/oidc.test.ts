import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { InMemoryWebStorage, UserManager, type INavigator, type UserManagerSettings } from "oidc-client-ts";
import { createOidcClient, safeReturnTo } from "../features/oidc";
import type { SessionRequest } from "../types/authRequestType";
import type { SessionResponse } from "../types/authResponseType";

test("return destinations preserve shop paths and reject external/auth destinations", () => {
  assert.equal(safeReturnTo("/products/laptop?variant=blue#details"), "/products/laptop?variant=blue#details");
  for (const value of [
    undefined, null, {}, "https://evil.example", "//evil.example", "/\\evil.example",
    "/%2f%2fevil.example", "/%252f%252fevil.example", "/path\n//evil.example",
    "/sign-in?returnTo=/products", "/sign-up", "/login", "/register", "/auth/callback",
    "/%61uth/callback", "/foo/../sign-in", "/%2e%2e/sign-in", "/%zz",
  ]) assert.equal(safeReturnTo(value), "/", `Rejected ${String(value)}`);
});

test("adapter creation and clearing an unused session do not touch browser APIs", async () => {
  const client = createOidcClient({ getBrowser: () => { throw new Error("Browser touched during SSR"); } });
  await client.clearSession();
});

// Gateway giả: exchangeCode/refreshSession/endSession thay cho các endpoint /auth/session, /auth/refresh, /auth/logout.
// Trình duyệt không còn nói chuyện với token endpoint của Keycloak, nên harness không cần server HTTP nữa.
async function protocolHarness() {
  const storage = new InMemoryWebStorage();
  storage.setItem("unrelated-setting", "keep");
  const redirects: URL[] = [];
  const grants: SessionRequest[] = [];
  let endSessions = 0;
  let nonceOverride: string | undefined;
  let claimsOverride: Record<string, unknown> = {};
  let failNextLogout = false;
  let endSessionFails = false;
  let hasCookieSession = false;
  let settings: UserManagerSettings;
  let manager: UserManager;
  const token = "test-access-token-never-persisted";
  const idToken = () => [
    Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url"),
    Buffer.from(JSON.stringify({
      iss: settings.authority,
      aud: settings.client_id,
      sub: "buyer-id",
      exp: Math.floor(Date.now() / 1000) + 3600,
      nonce: nonceOverride ?? redirects[0]?.searchParams.get("nonce"),
      ...claimsOverride,
    })).toString("base64url"),
    "test-signature",
  ].join(".");
  let lastIssued = "";
  let refreshes = 0;
  let accessTokenSuffix = "";
  let expiresIn = 3600;
  let refreshError: unknown;
  let pendingRefresh: { started(): void; wait: Promise<void> } | null = null;
  const tokens = (): SessionResponse => {
    lastIssued = idToken();
    return { accessToken: token + accessTokenSuffix, idToken: lastIssued, expiresIn };
  };
  const navigator: INavigator = {
    async prepare() {
      return {
        async navigate({ url }) {
          const destination = new URL(url);
          redirects.push(destination);
          if (destination.pathname === "/logout" && failNextLogout) {
            failNextLogout = false;
            throw new Error("Navigation failed");
          }
          return { url };
        },
        close() {},
      };
    },
    async callback() {},
  };
  const provider = "http://keycloak.test";
  const client = createOidcClient({
    getBrowser: () => ({
      origin: "http://localhost:3000",
      sessionStorage: storage,
      randomUUID: () => globalThis.crypto.randomUUID(),
    }),
    createManager(config) {
      settings = config;
      manager = new UserManager({ ...config, metadata: {
        issuer: config.authority,
        authorization_endpoint: `${provider}/authorize`,
        token_endpoint: `${provider}/token`,
        end_session_endpoint: `${provider}/logout`,
      } }, navigator);
      return manager;
    },
    exchangeCode: async (grant) => {
      grants.push(grant);
      hasCookieSession = true;
      return tokens();
    },
    refreshSession: async () => {
      refreshes += 1;
      const pending = pendingRefresh;
      pendingRefresh = null;
      if (pending) { pending.started(); await pending.wait; }
      if (refreshError) throw refreshError;
      // gateway trả 204 khi không có cookie
      if (!hasCookieSession) return null;
      return tokens();
    },
    endSession: async () => {
      endSessions += 1;
      hasCookieSession = false;
      if (endSessionFails) throw new Error("Gateway unreachable");
    },
  });
  const callback = (state?: string) => `http://localhost:3000/auth/callback?code=test-code&state=${state ?? redirects[0]?.searchParams.get("state")}`;
  return {
    client, storage, redirects, grants, callback, token,
    idToken,
    lastIssued: () => lastIssued,
    endSessions: () => endSessions,
    refreshes: () => refreshes,
    settings: () => settings,
    manager: () => manager,
    setNonce: (value: string) => { nonceOverride = value; },
    setClaims: (value: Record<string, unknown>) => { claimsOverride = value; },
    failLogout: () => { failNextLogout = true; },
    failEndSession: () => { endSessionFails = true; },
    setCookieSession: (value: boolean) => { hasCookieSession = value; },
    setAccessTokenSuffix: (value: string) => { accessTokenSuffix = value; },
    setExpiresIn: (value: number) => { expiresIn = value; },
    failRefresh: (error: unknown) => { refreshError = error; },
    pauseRefresh() {
      let release!: () => void;
      let started!: () => void;
      const entered = new Promise<void>((resolve) => { started = resolve; });
      pendingRefresh = { started, wait: new Promise<void>((resolve) => { release = resolve; }) };
      return { entered, release };
    },
    async close() {
      await client.clearSession();
    },
  };
}

test("code redirect and exchange use S256/state/nonce and keep tokens only in memory", async () => {
  const harness = await protocolHarness();
  try {
    await harness.client.signIn("/products/laptop?variant=blue#details");
    const authorization = harness.redirects[0];
    assert.equal(authorization.searchParams.get("response_type"), "code");
    assert.equal(authorization.searchParams.get("code_challenge_method"), "S256");
    assert.equal(authorization.searchParams.get("client_id"), "nexus-web");
    assert.equal(authorization.searchParams.get("redirect_uri"), "http://localhost:3000/auth/callback");
    assert.ok(authorization.searchParams.get("nonce"));
    assert.ok(authorization.searchParams.get("state"));
    assert.equal(authorization.searchParams.has("password"), false);
    assert.equal(harness.settings().automaticSilentRenew, false);
    assert.equal(harness.settings().monitorSession, false);
    assert.equal(harness.settings().loadUserInfo, false);

    const before = Date.now() / 1000;
    const result = await harness.client.completeSignIn(harness.callback());
    const { expiresAt, ...rest } = result;
    assert.deepEqual(rest, { accessToken: harness.token, returnTo: "/products/laptop?variant=blue#details", subject: "buyer-id" });
    assert.ok(expiresAt >= before + 3600 && expiresAt <= Date.now() / 1000 + 3600, "lifetime comes from expiresIn");
    // Mã và verifier đi thẳng tới gateway, trình duyệt không nhận refresh token nào
    assert.equal(harness.grants.length, 1);
    const grant = harness.grants[0];
    assert.equal(grant.code, "test-code");
    assert.equal(grant.redirectUri, "http://localhost:3000/auth/callback");
    assert.equal(createHash("sha256").update(grant.codeVerifier).digest("base64url"), authorization.searchParams.get("code_challenge"));
    assert.equal(await harness.manager().getUser(), null, "the library keeps no user: tokens live only in the provider");
    assert.equal(harness.storage.length, 1, "Completed transaction is removed and no token is persisted");
    assert.equal(harness.storage.getItem("unrelated-setting"), "keep");

    await assert.rejects(harness.client.completeSignIn(harness.callback()), /No matching state/);
    assert.equal(harness.grants.length, 1, "Replayed callback never reaches the gateway");
  } finally { await harness.close(); }
});

test("callback rejects unknown state before exchanging any code", async () => {
  const harness = await protocolHarness();
  try {
    await harness.client.signIn("/products/laptop");
    await assert.rejects(harness.client.completeSignIn(harness.callback("attacker-state")), /No matching state/);
    assert.equal(harness.grants.length, 0);
    assert.equal(await harness.manager().getUser(), null);
  } finally { await harness.close(); }
});

test("callback without a code or with a provider error is rejected before the gateway is called", async () => {
  const harness = await protocolHarness();
  try {
    await harness.client.signIn();
    const state = harness.redirects[0].searchParams.get("state");
    await assert.rejects(harness.client.completeSignIn(`http://localhost:3000/auth/callback?state=${state}`), /No matching state/);
    await assert.rejects(
      harness.client.completeSignIn(`http://localhost:3000/auth/callback?error=access_denied&state=${state}`),
      /access_denied/,
    );
    assert.equal(harness.grants.length, 0);
  } finally { await harness.close(); }
});

test("callback rejects an expired transaction before exchanging any code", async () => {
  const harness = await protocolHarness();
  try {
    await harness.client.signIn("/products/laptop");
    const stateId = harness.redirects[0].searchParams.get("state");
    assert.ok(stateId);
    const key = `nexus.oidc.state.${stateId}`;
    const state = JSON.parse(harness.storage.getItem(key));
    state.created = Math.floor(Date.now() / 1000) - 601;
    harness.storage.setItem(key, JSON.stringify(state));
    await assert.rejects(harness.client.completeSignIn(harness.callback()), /No matching state/);
    assert.equal(harness.grants.length, 0);
    assert.equal(await harness.manager().getUser(), null);
    assert.equal(harness.storage.length, 1);
    assert.equal(harness.storage.getItem("unrelated-setting"), "keep");
  } finally { await harness.close(); }
});

test("nonce mismatch rejects the response and leaves no authenticated user", async () => {
  const harness = await protocolHarness();
  try {
    await harness.client.signIn();
    harness.setNonce("another-sign-in");
    await assert.rejects(harness.client.completeSignIn(harness.callback()), /nonce/);
    assert.equal(harness.grants.length, 1);
    assert.equal(await harness.manager().getUser(), null);
    assert.equal(harness.storage.length, 1);
  } finally { await harness.close(); }
});

test("unexpected issuer/audience and expired identity tokens cannot establish a session", async () => {
  for (const claims of [
    { iss: "https://another-provider.example/realms/nexus" },
    { aud: "another-client" },
    { aud: ["nexus-web", "another-client"], azp: "another-client" },
    { exp: Math.floor(Date.now() / 1000) - 60 },
  ]) {
    const harness = await protocolHarness();
    try {
      await harness.client.signIn();
      harness.setClaims(claims);
      await assert.rejects(harness.client.completeSignIn(harness.callback()), /invalid sign-in response/);
      assert.equal(await harness.manager().getUser(), null);
      assert.equal(harness.storage.length, 1);
    } finally { await harness.close(); }
  }
});

test("a gateway refusal of the code rejects the sign-in and the transaction cannot be replayed", async () => {
  const harness = await protocolHarness();
  try {
    await harness.client.signIn();
    const refusing = createOidcClient({
      getBrowser: () => ({ origin: "http://localhost:3000", sessionStorage: harness.storage, randomUUID: () => globalThis.crypto.randomUUID() }),
      createManager: () => harness.manager(),
      exchangeCode: async () => { throw { kind: "http", status: 401, title: "Unauthorized" }; },
    });
    await assert.rejects(refusing.completeSignIn(harness.callback()), (error: { status?: number }) => error.status === 401);
    await assert.rejects(refusing.completeSignIn(harness.callback()), /No matching state/);
    assert.equal(harness.storage.length, 1);
  } finally { await harness.close(); }
});

test("restore returns the access token from the cookie session and keeps the ID-token hint for sign-out", async () => {
  const harness = await protocolHarness();
  try {
    harness.setCookieSession(true);
    const restored = await harness.client.restoreSession();
    const issued = harness.lastIssued();
    assert.ok(restored);
    assert.equal(restored.accessToken, harness.token);
    assert.equal(restored.returnTo, "/");
    assert.equal(restored.subject, "buyer-id");
    assert.ok(restored.expiresAt > Date.now() / 1000);
    assert.equal(harness.storage.length, 1, "restoring a session writes nothing to web storage");
    await harness.client.signOut();
    assert.equal(harness.redirects[0].searchParams.get("id_token_hint"), issued);
  } finally { await harness.close(); }
});

test("concurrent restores share one gateway refresh so the rotated token is used once", async () => {
  const harness = await protocolHarness();
  try {
    harness.setCookieSession(true);
    const [first, second] = await Promise.all([harness.client.restoreSession(), harness.client.restoreSession()]);
    assert.equal(first?.accessToken, second?.accessToken);
    assert.equal(harness.refreshes(), 1);
    await harness.client.restoreSession();
    assert.equal(harness.refreshes(), 2, "a later restore calls the gateway again");
  } finally { await harness.close(); }
});

test("restore without a cookie session is anonymous, and an invalid identity token is rejected", async () => {
  const harness = await protocolHarness();
  try {
    assert.equal(await harness.client.restoreSession(), null);
    harness.setCookieSession(true);
    harness.setClaims({ aud: "another-client" });
    await assert.rejects(harness.client.restoreSession(), /invalid sign-in response/);
  } finally { await harness.close(); }
});

test("renewal goes through the gateway cookie and returns the new token and lifetime", async () => {
  const harness = await protocolHarness();
  try {
    await harness.client.signIn();
    await harness.client.completeSignIn(harness.callback());
    harness.setAccessTokenSuffix("-renewed");
    harness.setExpiresIn(120);
    const renewed = await harness.client.renewSession();
    assert.equal(renewed.accessToken, `${harness.token}-renewed`);
    assert.equal(renewed.subject, "buyer-id");
    assert.ok(renewed.expiresAt >= Date.now() / 1000 + 119 && renewed.expiresAt <= Date.now() / 1000 + 120);
    assert.equal(harness.refreshes(), 1);
    assert.equal(harness.redirects.length, 1, "renewal needs no Keycloak navigation or iframe");
    assert.equal(harness.storage.length, 1, "renewal writes nothing to web storage");
  } finally { await harness.close(); }
});

test("a timer renewal and a restore running together share one gateway refresh", async () => {
  const harness = await protocolHarness();
  try {
    harness.setCookieSession(true);
    await harness.client.restoreSession();
    const [renewed, restored] = await Promise.all([harness.client.renewSession(), harness.client.restoreSession()]);
    assert.equal(renewed.accessToken, restored?.accessToken);
    assert.equal(harness.refreshes(), 2);
  } finally { await harness.close(); }
});

test("renewal is refused without a cookie, for another user, or with invalid claims", async () => {
  for (const mode of ["no-cookie", "changed-subject", "invalid-claims"] as const) {
    const harness = await protocolHarness();
    try {
      await harness.client.signIn();
      await harness.client.completeSignIn(harness.callback());
      if (mode === "no-cookie") harness.setCookieSession(false);
      if (mode === "changed-subject") harness.setClaims({ sub: "another-user" });
      if (mode === "invalid-claims") harness.setClaims({ iss: "https://another-provider.example/realms/nexus" });
      await assert.rejects(harness.client.renewSession(), /could not be renewed|user changed|invalid sign-in response/);
    } finally { await harness.close(); }
  }
});

test("a gateway outage during renewal surfaces the API error so the caller can keep the session", async () => {
  const harness = await protocolHarness();
  try {
    await harness.client.signIn();
    await harness.client.completeSignIn(harness.callback());
    harness.failRefresh({ kind: "http", status: 503, title: "Service Unavailable" });
    await assert.rejects(harness.client.renewSession(), (error: { status?: number }) => error.status === 503);
  } finally { await harness.close(); }
});

test("sign-out and explicit clear prevent a later renewal from reaching the gateway", async () => {
  const harness = await protocolHarness();
  try {
    await harness.client.signIn();
    await harness.client.completeSignIn(harness.callback());
    await harness.client.signOut();
    await assert.rejects(harness.client.renewSession(), /no active session/);
    await harness.client.clearSession();
    await assert.rejects(harness.client.renewSession(), /no active session/);
    assert.equal(harness.refreshes(), 0);
  } finally { await harness.close(); }
});

test("a renewal response arriving after sign-out cannot bring the session back", async () => {
  const harness = await protocolHarness();
  try {
    await harness.client.signIn();
    await harness.client.completeSignIn(harness.callback());
    const response = harness.pauseRefresh();
    const renewed = harness.client.renewSession();
    await response.entered;
    const signedOut = harness.client.signOut();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(harness.endSessions(), 0, "logout waits until the refresh has written its cookie");
    harness.setCookieSession(true);
    response.release();
    await assert.rejects(renewed, /superseded/);
    await signedOut;
    assert.equal(harness.endSessions(), 1, "logout then clears the cookie the refresh wrote");
    await assert.rejects(harness.client.renewSession(), /no active session/);
  } finally { await harness.close(); }
});

// Tab khác đang giữ khóa phiên: refresh của nó phải xong (đặt cookie cũ) trước khi tab này đặt cookie mới.
function holdSessionLockInAnotherTab() {
  let release!: () => void;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => { entered = resolve; });
  const held = navigator.locks.request("nexus-session-refresh", () => {
    entered();
    return new Promise<void>((resolve) => { release = resolve; });
  });
  return { started, release: () => { release(); return held; } };
}

test("a sign-in waits for another tab's refresh before the gateway sets the new account's cookie", async () => {
  const harness = await protocolHarness();
  try {
    await harness.client.signIn();
    const otherTab = holdSessionLockInAnotherTab();
    await otherTab.started;
    const signedIn = harness.client.completeSignIn(harness.callback());
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(harness.grants.length, 0, "the code exchange waits for the other tab");
    await otherTab.release();
    assert.equal((await signedIn).subject, "buyer-id");
    assert.equal(harness.grants.length, 1);
  } finally { await harness.close(); }
});

test("a sign-in canceled while waiting for another tab never exchanges its code", async () => {
  const harness = await protocolHarness();
  try {
    await harness.client.signIn();
    const otherTab = holdSessionLockInAnotherTab();
    await otherTab.started;
    const signedIn = harness.client.completeSignIn(harness.callback());
    const canceled = assert.rejects(signedIn, /canceled/);
    await new Promise((resolve) => setTimeout(resolve, 20));
    await harness.client.clearSession();
    await otherTab.release();
    await canceled;
    assert.equal(harness.grants.length, 0);
  } finally { await harness.close(); }
});

test("a sign-out waits for another tab's refresh so the cleared cookie is not written back", async () => {
  const harness = await protocolHarness();
  try {
    await harness.client.signIn();
    await harness.client.completeSignIn(harness.callback());
    const otherTab = holdSessionLockInAnotherTab();
    await otherTab.started;
    const signedOut = harness.client.signOut();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(harness.endSessions(), 0, "logout waits for the other tab");
    await otherTab.release();
    await signedOut;
    assert.equal(harness.endSessions(), 1);
    assert.equal(harness.redirects[1].pathname, "/logout");
  } finally { await harness.close(); }
});

test("clearing a callback during stale-state cleanup cancels it before the gateway exchange", async () => {
  const harness = await protocolHarness();
  try {
    await harness.client.signIn();
    const manager = harness.manager();
    const clearStaleState = manager.clearStaleState.bind(manager);
    let first = true;
    let entered!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const completed = new Promise<void>((resolve) => { release = resolve; });
    manager.clearStaleState = async () => {
      if (first) {
        first = false;
        entered();
        await completed;
      }
      await clearStaleState();
    };
    const callback = harness.client.completeSignIn(harness.callback());
    await started;
    await harness.client.clearSession();
    const canceled = assert.rejects(callback, /canceled/);
    release();
    await canceled;
    assert.equal(harness.grants.length, 0);
  } finally { await harness.close(); }
});

test("logout identifies the Keycloak session, clears tokens and preserves unrelated storage", async () => {
  const harness = await protocolHarness();
  try {
    await harness.client.signIn();
    await harness.client.completeSignIn(harness.callback());
    await harness.client.signOut();
    const logout = harness.redirects[1];
    assert.equal(logout.pathname, "/logout");
    assert.equal(logout.searchParams.get("id_token_hint"), harness.idToken());
    assert.equal(logout.searchParams.get("client_id"), "nexus-web");
    assert.equal(logout.searchParams.get("post_logout_redirect_uri"), "http://localhost:3000/");
    assert.equal(harness.endSessions(), 1, "the gateway clears the cookie and ends the Keycloak session");
    assert.equal(await harness.manager().getUser(), null);
    assert.equal(harness.storage.getItem("unrelated-setting"), "keep");
    assert.equal(harness.storage.length, 1);
  } finally { await harness.close(); }
});

test("sign-out still redirects to Keycloak when the gateway cannot be reached", async () => {
  const harness = await protocolHarness();
  try {
    await harness.client.signIn();
    await harness.client.completeSignIn(harness.callback());
    harness.failEndSession();
    await harness.client.signOut();
    assert.equal(harness.redirects[1].pathname, "/logout");
  } finally { await harness.close(); }
});

test("failed logout retains only its in-memory ID-token hint so the user can retry", async () => {
  const harness = await protocolHarness();
  try {
    await harness.client.signIn();
    await harness.client.completeSignIn(harness.callback());
    const hint = harness.idToken();
    harness.failLogout();
    await assert.rejects(harness.client.signOut(), /Navigation failed/);
    assert.equal(await harness.manager().getUser(), null);
    await harness.client.signOut();
    assert.equal(harness.redirects[2].searchParams.get("id_token_hint"), hint);
    assert.equal(harness.storage.length, 1);
  } finally { await harness.close(); }
});
