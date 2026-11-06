/* Local Keycloak protocol stand-in. The browser only opens the login page and
 * end-session redirect; the gateway stand-in (oidc-api) sends the code+PKCE
 * exchange, rotating refresh grants and back-channel logout. They do not prove
 * live provider integration (see oidc.context.yaml).
 */
const http = require("node:http");
const { createHash, generateKeyPairSync, randomUUID, sign } = require("node:crypto");
const origin = `http://127.0.0.1:${process.env.NEXUS_TEST_PROVIDER_PORT ?? process.env.NEXUS_OIDC_SIM_PORT ?? 3913}/keycloak`;
const issuer = `${origin}/realms/nexus`;
const protocol = `${issuer}/protocol/openid-connect`;
const appOrigins = new Set([
  "http://127.0.0.1:3102", "http://127.0.0.1:3103", "http://127.0.0.1:3104",
  process.env.NEXUS_TEST_APP_PORT ? `http://127.0.0.1:${process.env.NEXUS_TEST_APP_PORT}` : null,
  process.env.NEXUS_OIDC_APP_ORIGIN,
].filter(Boolean));
const callbacks = new Set([...appOrigins].map((appOrigin) => `${appOrigin}/auth/callback`));
const subject = "68000000-0000-4000-8000-000000000003";
const cookieName = "fixture-keycloak-session";
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...keys.publicKey.export({ format: "jwk" }), kid: "fixture-key", use: "sig", alg: "RS256" };
const initialEvidence = () => ({
  authorizations: 0, passwordSubmissions: 0, tokenRequests: 0, codeExchanges: 0,
  refreshRequests: 0, refreshRejected: 0, revocations: 0,
  pkceVerified: 0, logouts: 0, sessions: 0, issuedTokens: 0, issuedLifetimes: [],
});
let evidence = initialEvidence();
let mode = "success";
let lifetime = 3600;
let virtualTime = null;
const now = () => virtualTime === null ? Date.now() : virtualTime;

function json(res, body, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}
function redirect(res, location) {
  res.writeHead(302, { Location: location, "Cache-Control": "no-store" });
  res.end();
}
function jwt(claims) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", kid: "fixture-key", typ: "JWT" })}.${encode(claims)}`;
  return `${unsigned}.${sign("RSA-SHA256", Buffer.from(unsigned), keys.privateKey).toString("base64url")}`;
}
function fields(req) {
  return typeof req.body === "string" ? new URLSearchParams(req.body) : new URLSearchParams(req.body || {});
}
async function authorize(params, session, res) {
  const destination = new URL(params.get("redirect_uri"));
  destination.searchParams.set("state", mode === "bad-state" ? "tampered-state" : params.get("state"));
  destination.searchParams.set("iss", issuer);
  if (mode === "denied") {
    destination.searchParams.set("error", "access_denied");
  } else {
    const code = randomUUID();
    const codes = await pm.state.get("oidc-keycloak:codes") || {};
    codes[code] = {
      challenge: params.get("code_challenge"), nonce: params.get("nonce"),
      redirectUri: params.get("redirect_uri"), sessionId: session.id,
    };
    await pm.state.set("oidc-keycloak:codes", codes);
    destination.searchParams.set("code", code);
  }
  return redirect(res, destination.href);
}
async function issueToken(res, session, nonce) {
  const issuedAt = Math.floor(now() / 1000);
  const claims = {
    iss: issuer, sub: subject, iat: issuedAt, exp: issuedAt + lifetime,
    auth_time: session.authTime, sid: session.id,
  };
  const accessToken = jwt({
    ...claims, jti: randomUUID(), aud: "nexus-services", roles: ["BUYER"], privileges: ["PROFILE.VIEW"],
  });
  const refreshToken = `fixture-refresh-${randomUUID()}`;
  const refresh = await pm.state.get("oidc-keycloak:refresh-tokens") || {};
  refresh[refreshToken] = { sessionId: session.id, nonce };
  await pm.state.set("oidc-keycloak:refresh-tokens", refresh);
  const accessTokenHash = createHash("sha256").update(accessToken).digest("hex");
  // Refresh rotation does not revoke an earlier access JWT before its own expiry.
  const accessTokens = await pm.state.get("oidc-keycloak:access-tokens") || {};
  accessTokens[accessTokenHash] = claims.exp;
  await pm.state.set("oidc-keycloak:access-tokens", accessTokens);
  await pm.state.set("oidc-keycloak:access-token-hash", accessTokenHash);
  await pm.state.set("oidc-keycloak:access-token-expiry", claims.exp);
  evidence.issuedTokens += 1;
  evidence.issuedLifetimes.push(lifetime);
  return json(res, {
    access_token: accessToken, refresh_token: refreshToken, refresh_expires_in: 1800,
    token_type: "Bearer", expires_in: lifetime, scope: "openid profile email",
    id_token: jwt({ ...claims, aud: "nexus-web", nonce, email: "buyer@nexus.local", name: "Fixture Buyer" }),
  });
}
const server = http.createServer(async (req, res) => {
  if (appOrigins.has(req.headers.origin)) res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return json(res, {});
  const url = new URL(req.url, origin);
  if (url.pathname === "/health") return json(res, { ready: true });
  if (url.pathname === "/test/reset") {
    evidence = initialEvidence();
    mode = url.searchParams.get("mode") || "success";
    lifetime = 3600;
    virtualTime = null;
    for (const key of ["codes", "sessions", "refresh-tokens", "access-tokens"]) await pm.state.set(`oidc-keycloak:${key}`, {});
    for (const key of ["access-token-hash", "access-token-expiry", "clock-time"]) await pm.state.set(`oidc-keycloak:${key}`, null);
    return json(res, {});
  }
  if (url.pathname === "/test/control") {
    if (url.searchParams.has("mode")) mode = url.searchParams.get("mode");
    if (url.searchParams.has("ttl")) {
      const value = Number(url.searchParams.get("ttl"));
      if (!Number.isSafeInteger(value) || value < 30 || value > 3600) return json(res, { error: "invalid_ttl" }, 400);
      lifetime = value;
    }
    return json(res, { mode, lifetime });
  }
  if (url.pathname === "/test/clock") {
    const time = Number(url.searchParams.get("time"));
    if (!Number.isSafeInteger(time) || time < 1) return json(res, { error: "invalid_time" }, 400);
    virtualTime = time;
    await pm.state.set("oidc-keycloak:clock-time", time);
    return json(res, { now: time });
  }
  if (url.pathname === "/test/evidence") return json(res, { ...evidence, now: now(), lifetime });
  if (url.pathname === "/realms/nexus/.well-known/openid-configuration") {
    return json(res, {
      issuer, authorization_endpoint: `${protocol}/auth`, token_endpoint: `${protocol}/token`,
      end_session_endpoint: `${protocol}/logout`, jwks_uri: `${protocol}/certs`,
      response_types_supported: ["code"], subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"], code_challenge_methods_supported: ["S256"],
      grant_types_supported: ["authorization_code", "refresh_token"],
    });
  }
  if (url.pathname === "/realms/nexus/protocol/openid-connect/certs") return json(res, { keys: [jwk] });
  if (url.pathname === "/realms/nexus/protocol/openid-connect/auth") {
    const params = url.searchParams;
    if (params.get("client_id") !== "nexus-web" || !callbacks.has(params.get("redirect_uri"))
        || params.get("response_type") !== "code" || params.get("code_challenge_method") !== "S256"
        || !params.get("code_challenge") || !params.get("state") || !params.get("scope")?.split(" ").includes("openid")) {
      return json(res, { error: "invalid_request" }, 400);
    }
    if (req.method === "GET") {
      evidence.authorizations += 1;
      res.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store" });
      return res.end(`<!doctype html><html lang="en"><head><title>Fixture Keycloak</title></head><body>
        <main><h1>Keycloak sign in</h1><form method="post">
        <label>Email <input name="username" type="email" autocomplete="username" required></label>
        <label>Password <input name="password" type="password" autocomplete="current-password" required></label>
        <button type="submit">Sign in at Keycloak</button></form></main></body></html>`);
    }
    if (req.method === "POST") {
      if (!fields(req).get("password")) return json(res, { error: "invalid_credentials" }, 400);
      evidence.passwordSubmissions += 1;
      const sessions = await pm.state.get("oidc-keycloak:sessions") || {};
      const session = { id: randomUUID(), authTime: Math.floor(now() / 1000), expiresAt: now() + 3600_000 };
      if (mode !== "denied") {
        sessions[session.id] = session;
        await pm.state.set("oidc-keycloak:sessions", sessions);
        evidence.sessions = Object.keys(sessions).length;
        res.setHeader("Set-Cookie", `${cookieName}=${session.id}; Path=/keycloak; HttpOnly; SameSite=Lax`);
      }
      return authorize(params, session, res);
    }
  }
  if (url.pathname === "/realms/nexus/protocol/openid-connect/token" && req.method === "POST") {
    evidence.tokenRequests += 1;
    const form = fields(req);
    if (form.get("client_id") !== "nexus-web") return json(res, { error: "invalid_client" }, 400);
    if (form.get("grant_type") === "refresh_token") {
      evidence.refreshRequests += 1;
      // Matches the realm: revokeRefreshToken=true, refreshTokenMaxReuse=0. A used token is gone.
      const refreshTokens = await pm.state.get("oidc-keycloak:refresh-tokens") || {};
      const refresh = refreshTokens[form.get("refresh_token")];
      delete refreshTokens[form.get("refresh_token")];
      await pm.state.set("oidc-keycloak:refresh-tokens", refreshTokens);
      const sessions = await pm.state.get("oidc-keycloak:sessions") || {};
      const session = refresh ? sessions[refresh.sessionId] : null;
      if (!session || session.expiresAt <= now() || mode === "renew-error") {
        evidence.refreshRejected += 1;
        return json(res, { error: "invalid_grant", error_description: "Token is not active" }, 400);
      }
      return issueToken(res, session, refresh.nonce);
    }
    evidence.codeExchanges += 1;
    const codes = await pm.state.get("oidc-keycloak:codes") || {};
    const code = codes[form.get("code")];
    delete codes[form.get("code")];
    await pm.state.set("oidc-keycloak:codes", codes);
    const challenge = createHash("sha256").update(form.get("code_verifier") || "").digest("base64url");
    if (!code || challenge !== code.challenge || form.get("grant_type") !== "authorization_code"
        || form.get("redirect_uri") !== code.redirectUri) return json(res, { error: "invalid_grant" }, 400);
    evidence.pkceVerified += 1;
    if (mode === "token-error") return json(res, { error: "invalid_grant", error_description: "Fixture exchange rejected" }, 400);
    const sessions = await pm.state.get("oidc-keycloak:sessions") || {};
    const session = sessions[code.sessionId];
    if (!session || session.expiresAt <= now()) return json(res, { error: "invalid_grant" }, 400);
    return issueToken(res, session, code.nonce);
  }
  if (url.pathname === "/realms/nexus/protocol/openid-connect/logout" && req.method === "POST") {
    // Back-channel logout the gateway sends with the refresh token from its cookie.
    const refreshTokens = await pm.state.get("oidc-keycloak:refresh-tokens") || {};
    const refresh = refreshTokens[fields(req).get("refresh_token")];
    if (refresh) {
      evidence.revocations += 1;
      for (const [token, entry] of Object.entries(refreshTokens))
        if (entry.sessionId === refresh.sessionId) delete refreshTokens[token];
      await pm.state.set("oidc-keycloak:refresh-tokens", refreshTokens);
      const sessions = await pm.state.get("oidc-keycloak:sessions") || {};
      delete sessions[refresh.sessionId];
      await pm.state.set("oidc-keycloak:sessions", sessions);
      evidence.sessions = Object.keys(sessions).length;
    }
    res.writeHead(204, { "Cache-Control": "no-store" });
    return res.end();
  }
  if (url.pathname === "/realms/nexus/protocol/openid-connect/logout") {
    if (!url.searchParams.get("id_token_hint")) return json(res, { error: "id_token_hint_required" }, 400);
    const target = new URL(url.searchParams.get("post_logout_redirect_uri") || "http://127.0.0.1:3103/");
    if (!appOrigins.has(target.origin) || target.username || target.password) return json(res, { error: "invalid_redirect_uri" }, 400);
    let sessionId;
    try { sessionId = JSON.parse(Buffer.from(url.searchParams.get("id_token_hint").split(".")[1], "base64url")).sid; }
    catch { return json(res, { error: "invalid_id_token_hint" }, 400); }
    const sessions = await pm.state.get("oidc-keycloak:sessions") || {};
    delete sessions[sessionId];
    await pm.state.set("oidc-keycloak:sessions", sessions);
    evidence.logouts += 1;
    evidence.sessions = Object.keys(sessions).length;
    res.setHeader("Set-Cookie", `${cookieName}=; Path=/keycloak; HttpOnly; SameSite=Lax; Max-Age=0`);
    if (url.searchParams.has("state")) target.searchParams.set("state", url.searchParams.get("state"));
    return redirect(res, target.href);
  }
  return json(res, { error: "Fixture endpoint not implemented", path: url.pathname }, 501);
});
server.listen(process.env.PORT);
