import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import { InMemoryWebStorage, UserManager, type INavigator, type UserManagerSettings } from "oidc-client-ts";
import { createOidcClient, safeReturnTo } from "../features/auth/oidc";

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
  const server = createServer(async (req, res) => {
    if (req.url !== "/token" || req.method !== "POST") {
      res.writeHead(501).end();
      return;
    }
    let body = "";
    for await (const chunk of req) body += String(chunk);
    exchanges.push(new URLSearchParams(body));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      access_token: token,
      refresh_token: "test-refresh-token-never-persisted",
      id_token: idToken(),
      token_type: "Bearer",
      expires_in: 3600,
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
  });
  const callback = (state?: string) => `http://localhost:3000/auth/callback?code=test-code&state=${state ?? redirects[0]?.searchParams.get("state")}`;
  return {
    client, storage, redirects, exchanges, callback, token,
    settings: () => settings,
    manager: () => manager,
    setNonce: (value: string) => { nonceOverride = value; },
    setClaims: (value: Record<string, unknown>) => { claimsOverride = value; },
    failLogout: () => { failNextLogout = true; },
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
    assert.deepEqual(result, { accessToken: harness.token, returnTo: "/products/laptop?variant=blue#details" });
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
