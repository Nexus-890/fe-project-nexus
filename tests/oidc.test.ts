import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import { InMemoryWebStorage, UserManager, type INavigator, type UserManagerSettings } from "oidc-client-ts";
import { createOidcClient, safeReturnTo } from "../features/oidc";

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

async function protocolHarness() {
  const storage = new InMemoryWebStorage();
  storage.setItem("unrelated-setting", "keep");
  const redirects: URL[] = [];
  const exchanges: URLSearchParams[] = [];
  let nonceOverride: string | undefined;
  let claimsOverride: Record<string, unknown> = {};
  let failNextLogout = false;
  let silentError: string | undefined;
  let tokenError: string | undefined;
  let tokenExpiresIn = 3600;
  let accessTokenSuffix = "";
  const silentCallbacks: string[] = [];
  const silentTransactions: string[][] = [];
  let pendingTokenResponse: { started(): void; wait: Promise<void> } | null = null;
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
      nonce: nonceOverride ?? redirects.filter((url) => url.pathname === "/authorize").at(-1)?.searchParams.get("nonce"),
      ...claimsOverride,
    })).toString("base64url"),
    "test-signature",
  ].join(".");
  const server = createServer(async (req, res) => {
    if (req.url !== "/token" || req.method !== "POST") {
      res.writeHead(501).end();
      return;
    }
    let body = "";
    for await (const chunk of req) body += String(chunk);
    exchanges.push(new URLSearchParams(body));
    const pending = pendingTokenResponse;
    pendingTokenResponse = null;
    if (pending) { pending.started(); await pending.wait; }
    if (tokenError) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: tokenError }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      access_token: token + accessTokenSuffix,
      refresh_token: "test-refresh-token-never-persisted",
      id_token: idToken(),
      token_type: "Bearer",
      expires_in: tokenExpiresIn,
      scope: "openid profile email",
    }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const provider = `http://127.0.0.1:${address.port}`;
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
  const iframeNavigator: INavigator = {
    async prepare() {
      return {
        async navigate({ url }) {
          const request = new URL(url);
          redirects.push(request);
          silentTransactions.push(Array.from({ length: storage.length }, (_, index) => storage.getItem(storage.key(index)!)));
          const callback = new URL(request.searchParams.get("redirect_uri")!);
          callback.searchParams.set("state", request.searchParams.get("state")!);
          callback.searchParams.set(silentError ? "error" : "code", silentError ?? "silent-code");
          return { url: callback.href };
        },
        close() {},
      };
    },
    async callback(url) { silentCallbacks.push(url); },
  };
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
      } }, navigator, undefined, iframeNavigator);
      return manager;
    },
  });
  const callback = (state?: string) => `http://localhost:3000/auth/callback?code=test-code&state=${state ?? redirects[0]?.searchParams.get("state")}`;
  return {
    client, storage, redirects, exchanges, callback, token, silentCallbacks, silentTransactions,
    settings: () => settings,
    manager: () => manager,
    setNonce: (value: string) => { nonceOverride = value; },
    setClaims: (value: Record<string, unknown>) => { claimsOverride = value; },
    failLogout: () => { failNextLogout = true; },
    setSilentError: (value?: string) => { silentError = value; },
    setTokenError: (value?: string) => { tokenError = value; },
    setAccessTokenSuffix: (value: string) => { accessTokenSuffix = value; },
    setTokenExpiresIn: (value: number) => { tokenExpiresIn = value; },
    pauseTokenResponse() {
      let release!: () => void;
      let started!: () => void;
      const entered = new Promise<void>((resolve) => { started = resolve; });
      pendingTokenResponse = { started, wait: new Promise<void>((resolve) => { release = resolve; }) };
      return { entered, release };
    },
    async close() {
      await client.clearSession();
      server.close();
      server.closeAllConnections();
      await once(server, "close");
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
    assert.deepEqual(result, { accessToken: harness.token, returnTo: "/products/laptop?variant=blue#details", subject: "buyer-id", expiresAt: (await harness.manager().getUser())!.expires_at });
    assert.equal(harness.exchanges.length, 1);
    const exchange = harness.exchanges[0];
    assert.equal(exchange.get("grant_type"), "authorization_code");
    assert.equal(exchange.get("code"), "test-code");
    assert.equal(exchange.get("client_id"), "nexus-web");
    assert.equal(exchange.get("redirect_uri"), "http://localhost:3000/auth/callback");
    assert.equal(exchange.has("client_secret"), false);
    assert.equal(exchange.has("password"), false);
    const verifier = exchange.get("code_verifier");
    assert.ok(verifier);
    assert.equal(createHash("sha256").update(verifier).digest("base64url"), authorization.searchParams.get("code_challenge"));
    assert.equal((await harness.manager().getUser())?.access_token, harness.token);
    assert.equal(harness.storage.length, 1, "Completed transaction is removed and no token is persisted");
    assert.equal(harness.storage.getItem("unrelated-setting"), "keep");

    await assert.rejects(harness.client.completeSignIn(harness.callback()), /No matching state/);
    assert.equal(harness.exchanges.length, 1, "Replayed callback never reaches token endpoint");
  } finally { await harness.close(); }
});

test("callback rejects unknown state before exchanging any code", async () => {
  const harness = await protocolHarness();
  try {
    await harness.client.signIn("/products/laptop");
    await assert.rejects(harness.client.completeSignIn(harness.callback("attacker-state")), /No matching state/);
    assert.equal(harness.exchanges.length, 0);
    assert.equal(await harness.manager().getUser(), null);
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
    assert.equal(harness.exchanges.length, 0);
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
    assert.equal(harness.exchanges.length, 1);
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

test("logout identifies the Keycloak session, clears tokens and preserves unrelated storage", async () => {
  const harness = await protocolHarness();
  try {
    await harness.client.signIn();
    await harness.client.completeSignIn(harness.callback());
    const user = await harness.manager().getUser();
    assert.ok(user?.id_token);
    await harness.client.signOut();
    const logout = harness.redirects[1];
    assert.equal(logout.pathname, "/logout");
    assert.equal(logout.searchParams.get("id_token_hint"), user.id_token);
    assert.equal(logout.searchParams.get("client_id"), "nexus-web");
    assert.equal(logout.searchParams.get("post_logout_redirect_uri"), "http://localhost:3000/");
    assert.equal(await harness.manager().getUser(), null);
    assert.equal(harness.storage.getItem("unrelated-setting"), "keep");
    assert.equal(harness.storage.length, 1);
  } finally { await harness.close(); }
});

test("failed logout retains only its in-memory ID-token hint so the user can retry", async () => {
  const harness = await protocolHarness();
  try {
    await harness.client.signIn();
    await harness.client.completeSignIn(harness.callback());
    const user = await harness.manager().getUser();
    assert.ok(user?.id_token);
    harness.failLogout();
    await assert.rejects(harness.client.signOut(), /Navigation failed/);
    assert.equal(await harness.manager().getUser(), null);
    await harness.client.signOut();
    assert.equal(harness.redirects[2].searchParams.get("id_token_hint"), user.id_token);
    assert.equal(harness.storage.length, 1);
  } finally { await harness.close(); }
});

test("restoration uses prompt=none code+PKCE in an iframe and keeps the complete OIDC user in memory", async () => {
  const harness = await protocolHarness();
  try {
    const session = await harness.client.restoreSession();
    assert.ok(session);
    assert.equal(session.accessToken, harness.token);
    assert.equal(session.subject, "buyer-id");
    assert.equal(session.returnTo, "/");
    assert.ok(session.expiresAt > Date.now() / 1000);
    const authorization = harness.redirects[0];
    assert.equal(authorization.searchParams.get("prompt"), "none");
    assert.equal(authorization.searchParams.get("redirect_uri"), "http://localhost:3000/auth/silent");
    assert.equal(authorization.searchParams.get("code_challenge_method"), "S256");
    assert.ok(authorization.searchParams.get("nonce"));
    assert.equal(authorization.searchParams.has("id_token_hint"), false);
    assert.equal(harness.settings().automaticSilentRenew, false);
    assert.equal(harness.settings().validateSubOnSilentRenew, true);
    assert.equal(harness.settings().includeIdTokenInSilentRenew, false);
    assert.equal(harness.settings().iframeNotifyParentOrigin, "http://localhost:3000");
    assert.equal(harness.settings().iframeScriptOrigin, "http://localhost:3000");
    assert.equal(harness.settings().silentRequestTimeoutInSeconds, 15);
    assert.equal(harness.exchanges[0].get("grant_type"), "authorization_code");
    assert.equal(harness.exchanges[0].get("redirect_uri"), "http://localhost:3000/auth/silent");
    const storedUser = await harness.manager().getUser();
    assert.equal(storedUser?.refresh_token, "test-refresh-token-never-persisted");
    assert.equal(harness.storage.length, 1, "Only unrelated setting remains in browser storage");
    assert.equal(harness.storage.getItem("unrelated-setting"), "keep");
  } finally { await harness.close(); }
});

test("absent SSO and interaction-required responses restore anonymously without exchanging a code", async () => {
  for (const error of ["login_required", "interaction_required", "consent_required", "account_selection_required"]) {
    const harness = await protocolHarness();
    try {
      harness.setSilentError(error);
      assert.equal(await harness.client.restoreSession(), null);
      assert.equal(harness.exchanges.length, 0);
      assert.equal(await harness.manager().getUser(), null);
      assert.equal(harness.storage.length, 1);
    } finally { await harness.close(); }
  }
});

test("unexpected restore failures reject rather than establishing a session", async () => {
  const harness = await protocolHarness();
  try {
    harness.setSilentError("server_error");
    await assert.rejects(harness.client.restoreSession(), /server_error/);
    assert.equal(await harness.manager().getUser(), null);
    assert.equal(harness.exchanges.length, 0);
    assert.equal(harness.storage.length, 1);
  } finally { await harness.close(); }
});

test("renewal uses only Keycloak's in-memory refresh token and returns the updated lifetime", async () => {
  const harness = await protocolHarness();
  try {
    await harness.client.signIn();
    await harness.client.completeSignIn(harness.callback());
    harness.setAccessTokenSuffix("-renewed");
    harness.setTokenExpiresIn(120);
    const renewed = await harness.client.renewSession();
    assert.equal(renewed.accessToken, `${harness.token}-renewed`);
    assert.equal(renewed.subject, "buyer-id");
    assert.ok(renewed.expiresAt >= Math.floor(Date.now() / 1000) + 119);
    assert.ok(renewed.expiresAt <= Math.floor(Date.now() / 1000) + 120);
    assert.equal(harness.redirects.length, 1, "Refresh grant requires no additional authorization navigation");
    assert.equal(harness.exchanges.length, 2);
    const request = harness.exchanges[1];
    assert.equal(request.get("grant_type"), "refresh_token");
    assert.equal(request.get("refresh_token"), "test-refresh-token-never-persisted");
    assert.equal(request.get("client_id"), "nexus-web");
    assert.equal(request.has("client_secret"), false);
    assert.equal(request.has("password"), false);
    assert.equal(harness.storage.length, 1);
  } finally { await harness.close(); }
});

test("a session without a refresh token renews silently without putting an ID token in persisted state", async () => {
  const harness = await protocolHarness();
  try {
    await harness.client.signIn();
    await harness.client.completeSignIn(harness.callback());
    const user = await harness.manager().getUser();
    assert.ok(user);
    user.refresh_token = undefined;
    await harness.manager().storeUser(user);
    harness.setAccessTokenSuffix("-iframe-renewed");
    const session = await harness.client.renewSession();
    assert.equal(session.accessToken, `${harness.token}-iframe-renewed`);
    const authorization = harness.redirects[1];
    assert.equal(authorization.searchParams.get("prompt"), "none");
    assert.equal(authorization.searchParams.has("id_token_hint"), false);
    assert.equal(harness.exchanges[1].get("grant_type"), "authorization_code");
    const persisted = harness.silentTransactions.flat().join("\n");
    assert.ok(persisted.includes("code_verifier"));
    assert.equal(persisted.includes(harness.token), false);
    assert.equal(persisted.includes("test-refresh-token-never-persisted"), false);
    assert.equal(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\./.test(persisted), false);
    assert.equal(harness.storage.length, 1);
  } finally { await harness.close(); }
});

test("invalid renewal claims or a rejected refresh clear the in-memory OIDC user", async () => {
  for (const mode of ["invalid_grant", "changed-subject", "expired-token"] as const) {
    const harness = await protocolHarness();
    try {
      await harness.client.signIn();
      await harness.client.completeSignIn(harness.callback());
      if (mode === "invalid_grant") harness.setTokenError("invalid_grant");
      if (mode === "changed-subject") harness.setClaims({ sub: "another-user" });
      if (mode === "expired-token") harness.setTokenExpiresIn(0);
      await assert.rejects(harness.client.renewSession());
      assert.equal(await harness.manager().getUser(), null);
      assert.equal(harness.storage.length, 1);
      const exchangeCount = harness.exchanges.length;
      await assert.rejects(harness.client.renewSession(), /no active session/);
      assert.equal(harness.exchanges.length, exchangeCount);
    } finally { await harness.close(); }
  }
});

test("sign-out and explicit clear prevent a later renew from silently signing back in", async () => {
  const harness = await protocolHarness();
  try {
    await harness.client.signIn();
    await harness.client.completeSignIn(harness.callback());
    await harness.client.signOut();
    await assert.rejects(harness.client.renewSession(), /no active session/);
    assert.equal(harness.redirects.length, 2);
    assert.equal(harness.exchanges.length, 1);
    await harness.client.clearSession();
    await assert.rejects(harness.client.renewSession(), /no active session/);
  } finally { await harness.close(); }
});

test("a renewal response arriving after sign-out cannot restore the in-memory user", async () => {
  const harness = await protocolHarness();
  try {
    await harness.client.signIn();
    await harness.client.completeSignIn(harness.callback());
    const response = harness.pauseTokenResponse();
    const renewed = harness.client.renewSession();
    await response.entered;
    await harness.client.signOut();
    response.release();
    await assert.rejects(renewed, /canceled/);
    assert.equal(await harness.manager().getUser(), null);
    await assert.rejects(harness.client.renewSession(), /no active session/);
    assert.equal(harness.storage.length, 1);
  } finally { await harness.close(); }
});

test("silent callback only relays the response URL without exchanging a code or persisting tokens", async () => {
  const harness = await protocolHarness();
  try {
    const url = "http://localhost:3000/auth/silent?code=silent-code&state=pending";
    await harness.client.completeSilentSignIn(url);
    assert.deepEqual(harness.silentCallbacks, [url]);
    assert.equal(harness.exchanges.length, 0);
    assert.equal(await harness.manager().getUser(), null);
    assert.equal(harness.storage.length, 1);
  } finally { await harness.close(); }
});

test("clearing a callback during stale-state cleanup cancels it before code exchange", async () => {
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
    assert.equal(harness.exchanges.length, 0);
    assert.equal(await manager.getUser(), null);
  } finally { await harness.close(); }
});
