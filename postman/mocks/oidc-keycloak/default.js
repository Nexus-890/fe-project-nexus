/* Local protocol fixture based on realm-nexus.json and OIDC discovery/code flow.
 * It does not represent production Keycloak verification (see oidc.context.yaml).
 * Passwords are accepted only on this provider's HTML form and never retained.
 */
const http = require("node:http");
const { createHash, generateKeyPairSync, randomUUID, sign } = require("node:crypto");
const origin = `http://127.0.0.1:${process.env.NEXUS_TEST_PROVIDER_PORT ?? 3913}/keycloak`;
const issuer = `${origin}/realms/nexus`;
const protocol = `${issuer}/protocol/openid-connect`;
const appOrigins = new Set(process.env.NEXUS_TEST_APP_PORT
  ? [`http://127.0.0.1:${process.env.NEXUS_TEST_APP_PORT}`]
  : ["http://127.0.0.1:3102", "http://127.0.0.1:3103"]);
const callbacks = new Set([...appOrigins].map((appOrigin) => `${appOrigin}/auth/callback`));
const subject = "68000000-0000-4000-8000-000000000003";
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...keys.publicKey.export({ format: "jwk" }), kid: "fixture-key", use: "sig", alg: "RS256" };
const initialEvidence = () => ({ authorizations: 0, passwordSubmissions: 0, tokenRequests: 0, pkceVerified: 0, logouts: 0, sessions: 0 });

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

const server = http.createServer(async (req, res) => {
  if (appOrigins.has(req.headers.origin)) res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return json(res, {});
  const url = new URL(req.url, origin);
  const evidence = await pm.state.get("oidc-keycloak:evidence") || initialEvidence();
  const save = () => pm.state.set("oidc-keycloak:evidence", evidence);

  if (url.pathname === "/health") return json(res, { ready: true });
  if (url.pathname === "/test/reset") {
    await pm.state.set("oidc-keycloak:evidence", initialEvidence());
    await pm.state.set("oidc-keycloak:codes", {});
    await pm.state.set("oidc-keycloak:access-token-hash", null);
    await pm.state.set("oidc-keycloak:mode", url.searchParams.get("mode") || "success");
    return json(res, {});
  }
  if (url.pathname === "/test/evidence") return json(res, evidence);
  if (url.pathname === "/realms/nexus/.well-known/openid-configuration") {
    return json(res, {
      issuer, authorization_endpoint: `${protocol}/auth`, token_endpoint: `${protocol}/token`,
      end_session_endpoint: `${protocol}/logout`, jwks_uri: `${protocol}/certs`,
      response_types_supported: ["code"], subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"], code_challenge_methods_supported: ["S256"],
    });
  }
  if (url.pathname === "/realms/nexus/protocol/openid-connect/certs") return json(res, { keys: [jwk] });
  const mode = await pm.state.get("oidc-keycloak:mode") || "success";
  if (url.pathname === "/realms/nexus/protocol/openid-connect/auth") {
    const params = url.searchParams;
    if (params.get("client_id") !== "nexus-web" || !callbacks.has(params.get("redirect_uri"))
        || params.get("response_type") !== "code" || params.get("code_challenge_method") !== "S256"
        || !params.get("code_challenge") || !params.get("state") || !params.get("scope")?.split(" ").includes("openid")) {
      return json(res, { error: "invalid_request" }, 400);
    }
    if (req.method === "GET") {
      evidence.authorizations += 1;
      await save();
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
      const destination = new URL(params.get("redirect_uri"));
      destination.searchParams.set("state", mode === "bad-state" ? "tampered-state" : params.get("state"));
      destination.searchParams.set("iss", issuer);
      if (mode === "denied") {
        destination.searchParams.set("error", "access_denied");
      } else {
        const code = randomUUID();
        const codes = await pm.state.get("oidc-keycloak:codes") || {};
        codes[code] = { challenge: params.get("code_challenge"), nonce: params.get("nonce"), redirectUri: params.get("redirect_uri") };
        await pm.state.set("oidc-keycloak:codes", codes);
        destination.searchParams.set("code", code);
        evidence.sessions += 1;
      }
      await save();
      return redirect(res, destination.href);
    }
  }
  if (url.pathname === "/realms/nexus/protocol/openid-connect/token" && req.method === "POST") {
    evidence.tokenRequests += 1;
    const form = fields(req);
    const codes = await pm.state.get("oidc-keycloak:codes") || {};
    const code = codes[form.get("code")];
    delete codes[form.get("code")];
    await pm.state.set("oidc-keycloak:codes", codes);
    const challenge = createHash("sha256").update(form.get("code_verifier") || "").digest("base64url");
    if (!code || challenge !== code.challenge || form.get("client_id") !== "nexus-web"
        || form.get("grant_type") !== "authorization_code" || form.get("redirect_uri") !== code.redirectUri) {
      await save();
      return json(res, { error: "invalid_grant" }, 400);
    }
    evidence.pkceVerified += 1;
    await save();
    if (mode === "token-error") return json(res, { error: "invalid_grant", error_description: "Fixture exchange rejected" }, 400);
    const now = Math.floor(Date.now() / 1000);
    const claims = { iss: issuer, sub: subject, iat: now, exp: now + 3600, auth_time: now, sid: "fixture-session" };
    const accessToken = jwt({ ...claims, aud: "nexus-services", roles: ["BUYER"], privileges: ["PROFILE.VIEW"] });
    await pm.state.set("oidc-keycloak:access-token-hash", createHash("sha256").update(accessToken).digest("hex"));
    return json(res, {
      access_token: accessToken, token_type: "Bearer", expires_in: 3600, scope: "openid profile email",
      id_token: jwt({ ...claims, aud: "nexus-web", nonce: code.nonce, email: "buyer@nexus.local", name: "Fixture Buyer" }),
    });
  }
  if (url.pathname === "/realms/nexus/protocol/openid-connect/logout") {
    if (!url.searchParams.get("id_token_hint")) return json(res, { error: "id_token_hint_required" }, 400);
    let target;
    try {
      target = new URL(url.searchParams.get("post_logout_redirect_uri") || "http://127.0.0.1:3103/");
    } catch {
      return json(res, { error: "invalid_redirect_uri" }, 400);
    }
    if (!appOrigins.has(target.origin) || target.username || target.password) return json(res, { error: "invalid_redirect_uri" }, 400);
    evidence.logouts += 1;
    evidence.sessions = 0;
    await save();
    if (url.searchParams.has("state")) target.searchParams.set("state", url.searchParams.get("state"));
    return redirect(res, target.href);
  }
  return json(res, { error: "Fixture endpoint not implemented", path: url.pathname }, 501);
});
server.listen(process.env.PORT);
