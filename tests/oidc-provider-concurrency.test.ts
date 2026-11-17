import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

type FixtureRequest = { method: string; url: string; body?: string; headers: Record<string, string> };
type FixtureResponse = { setHeader: (name: string, value: string) => void; writeHead: (status: number, headers?: Record<string, string>) => void; end: (body?: string) => void };
type FixtureHandler = (request: FixtureRequest, response: FixtureResponse) => Promise<unknown>;
type TokenResponse = { access_token: string; refresh_token: string; error?: string };

test("simulated provider preserves concurrent independent refresh rotations and rejects reused tokens", async () => {
  const source = readFileSync(path.resolve("postman/mocks/oidc-keycloak/default.js"), "utf8");
  const require = createRequire(path.join(process.cwd(), "package.json"));
  const values = new Map<string, unknown>();
  let handle!: FixtureHandler;
  runInNewContext(source, {
    require: (name: string) => name === "node:http" ? { createServer: (handler: FixtureHandler) => { handle = handler; return { listen: () => undefined }; } } : require(name),
    pm: {
      environment: { get: (name: string) => name === "fixtureAppOrigin" ? "http://127.0.0.1:3110" : undefined },
      state: {
        // Model the asynchronous, independent snapshots returned by real pm.state.
        get: async (key: string) => { const snapshot = structuredClone(values.get(key)); await setImmediate(); return snapshot; },
        set: async (key: string, value: unknown) => { const snapshot = structuredClone(value); await setImmediate(); values.set(key, snapshot); },
      },
    }, process: { env: {} }, Buffer, URL, URLSearchParams,
  });
  const call = async (method: string, url: string, body?: string) => {
    let status = 200; let responseBody = "";
    const headers: Record<string, string> = {};
    await handle({ method, url, body, headers: {} }, {
      setHeader: (name, value) => { headers[name.toLowerCase()] = value; },
      writeHead: (code, fields = {}) => { status = code; for (const [name, value] of Object.entries(fields)) headers[name.toLowerCase()] = value; },
      end: (value = "") => { responseBody = value; },
    });
    return { status, headers, body: (responseBody ? JSON.parse(responseBody) : {}) as TokenResponse };
  };
  const login = async (role: "SELLER" | "BUYER", subject: string) => {
    assert.equal((await call("GET", `/test/control?roles=${role}&subject=${subject}`)).status, 200);
    const verifier = "concurrent-session-fixture-verifier";
    const redirectUri = "http://127.0.0.1:3110/auth/callback";
    const params = new URLSearchParams({ client_id: "nexus-web", redirect_uri: redirectUri, response_type: "code", code_challenge_method: "S256",
      code_challenge: createHash("sha256").update(verifier).digest("base64url"), state: "test-state", scope: "openid profile email", nonce: "test-nonce" });
    const authorization = await call("POST", `/realms/nexus/protocol/openid-connect/auth?${params}`, "password=fixture-password");
    assert.equal(authorization.status, 302);
    const code = new URL(authorization.headers.location).searchParams.get("code"); assert.ok(code);
    const tokens = await call("POST", "/realms/nexus/protocol/openid-connect/token", new URLSearchParams({ client_id: "nexus-web", grant_type: "authorization_code", code,
      code_verifier: verifier, redirect_uri: redirectUri }).toString());
    assert.equal(tokens.status, 200);
    return tokens.body;
  };
  const refresh = (token: string) => call("POST", "/realms/nexus/protocol/openid-connect/token", new URLSearchParams({ client_id: "nexus-web", grant_type: "refresh_token", refresh_token: token }).toString());
  const seller = await login("SELLER", "68000000-0000-4000-8000-000000000002");
  const buyer = await login("BUYER", "68000000-0000-4000-8000-000000000003");
  const rotated = await Promise.all([refresh(seller.refresh_token), refresh(buyer.refresh_token)]);
  assert.deepEqual(rotated.map((result) => result.status), [200, 200]);
  const again = await Promise.all(rotated.map((result) => refresh(result.body.refresh_token)));
  assert.deepEqual(again.map((result) => result.status), [200, 200], "both independently rotated sessions must survive the following full page load");
  const identities = again.map((result) => JSON.parse(Buffer.from(result.body.access_token.split(".")[1], "base64url").toString()) as { sub: string; roles: string[] });
  assert.deepEqual(identities.map((identity) => identity.roles), [["SELLER"], ["BUYER"]], "later role controls must not change a previously signed-in session");
  assert.deepEqual(identities.map((identity) => identity.sub), ["68000000-0000-4000-8000-000000000002", "68000000-0000-4000-8000-000000000003"]);
  for (const old of [seller.refresh_token, buyer.refresh_token, ...rotated.map((result) => result.body.refresh_token)]) {
    const replay = await refresh(old); assert.equal(replay.status, 400); assert.equal(replay.body.error, "invalid_grant");
  }
});
