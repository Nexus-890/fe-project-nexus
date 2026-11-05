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
  const tokens = (): SessionResponse => {
    lastIssued = idToken();
    return { accessToken: token, idToken: lastIssued, expiresIn: 3600 };
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

    const result = await harness.client.completeSignIn(harness.callback());
    assert.deepEqual(result, { accessToken: harness.token, returnTo: "/products/laptop?variant=blue#details" });
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
    const restored = await harness.client.restore();
    const issued = harness.lastIssued();
    assert.deepEqual(restored, { accessToken: harness.token, returnTo: "/" });
    assert.equal(harness.storage.length, 1, "restoring a session writes nothing to web storage");
    await harness.client.signOut();
    assert.equal(harness.redirects[0].searchParams.get("id_token_hint"), issued);
  } finally { await harness.close(); }
});

test("concurrent restores share one gateway refresh so the rotated token is used once", async () => {
  const harness = await protocolHarness();
  try {
    harness.setCookieSession(true);
    const [first, second] = await Promise.all([harness.client.restore(), harness.client.restore()]);
    assert.deepEqual(first, second);
    assert.equal(harness.refreshes(), 1);
    await harness.client.restore();
    assert.equal(harness.refreshes(), 2, "a later restore calls the gateway again");
  } finally { await harness.close(); }
});

test("restore fails without a cookie session and rejects an invalid identity token", async () => {
  const harness = await protocolHarness();
  try {
    await assert.rejects(harness.client.restore(), /no session to restore/);
    harness.setCookieSession(true);
    harness.setClaims({ aud: "another-client" });
    await assert.rejects(harness.client.restore(), /invalid sign-in response/);
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
