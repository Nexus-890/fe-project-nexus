/* Local API contract fixture; /api routing prefix is removed by the simulation. */
const http = require("node:http");
const { createHash } = require("node:crypto");
const initial = () => ({
  meRequests: 0, bearerRequests: 0, passwordLeaks: 0, loginRequests: 0, registrations: 0,
  sessionExchanges: 0, sessionRefreshes: 0, sessionLogouts: 0, csrfRejected: 0, cookieLeaks: 0,
});
// 3103 runs the OIDC suite; 3102 runs the catalog suite, whose fixture forwards /api/v1/auth/* here.
const appOrigins = new Set(["http://127.0.0.1:3102", "http://127.0.0.1:3103"]);
const keycloak = "http://127.0.0.1:3913/keycloak/realms/nexus/protocol/openid-connect";
// Stands in for the api-gateway SessionController (#252). Secure is left off because the app runs on plain http here;
// the gateway sets it by default (SESSION_COOKIE_SECURE).
const cookie = (value, maxAge) => `nexus_rt=${value}; Path=/api/v1/auth; Max-Age=${maxAge}; HttpOnly; SameSite=Lax`;
const sessionCookie = (req) => (req.headers.cookie || "").split(/;\s*/)
  .find((part) => part.startsWith("nexus_rt="))?.slice("nexus_rt=".length) || "";
async function keycloakPost(path, form) {
  return fetch(`${keycloak}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: "nexus-web", ...form }),
  });
}
function signedIn(res, tokens) {
  res.setHeader("Set-Cookie", cookie(tokens.refresh_token, tokens.refresh_expires_in));
  return json(res, success({ accessToken: tokens.access_token, idToken: tokens.id_token, expiresIn: tokens.expires_in }));
}
const user = {
  id: "68000000-0000-4000-8000-000000000003", email: "buyer@nexus.local", phone: "0901234567",
  fullName: "Fixture Buyer", gender: "OTHER", address: "Ho Chi Minh City", dateOfBirth: "2000-01-01",
  roles: ["BUYER"], status: "ACTIVE", createdAt: "2026-11-03T00:00:00Z",
};
function json(res, body, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}
const success = (data, page) => ({ code: 0, message: "response success", data, ...(page ? { page } : {}) });
function problem(res, status, code, title, detail, errors) {
  res.writeHead(status, { "Content-Type": "application/problem+json", "Cache-Control": "no-store" });
  const problemType = { VALIDATION_FAILED: "validation-error", UNAUTHENTICATED: "unauthorized" }[code]
    || code.toLowerCase().replaceAll("_", "-");
  res.end(JSON.stringify({
    type: `urn:problem:${problemType}`,
    title, status, code, detail, ...(errors ? { errors } : {}),
  }));
}
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", appOrigins.has(req.headers.origin) ? req.headers.origin : "http://127.0.0.1:3103");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return json(res, {});
  const url = new URL(req.url, "http://127.0.0.1:3913");
  if (url.pathname === "/test/reset") {
    await pm.state.set("oidc-api:evidence", initial());
    await pm.state.set("oidc-api:mode", url.searchParams.get("mode") || "success");
    return json(res, {});
  }
  const evidence = await pm.state.get("oidc-api:evidence") || initial();
  if (url.pathname === "/test/evidence") return json(res, evidence);
  const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
  if (url.pathname !== "/v1/auth/register" && /password/i.test(body)) evidence.passwordLeaks += 1;
  if (url.pathname === "/v1/auth/login") evidence.loginRequests += 1;
  // The cookie path must keep the refresh token away from every other API call.
  if (!url.pathname.startsWith("/v1/auth/") && sessionCookie(req)) evidence.cookieLeaks += 1;
  if (["/v1/auth/session", "/v1/auth/refresh", "/v1/auth/logout"].includes(url.pathname) && req.method === "POST") {
    if (req.headers["x-requested-with"] !== "nexus-web" || !appOrigins.has(req.headers.origin)) {
      evidence.csrfRejected += 1;
      await pm.state.set("oidc-api:evidence", evidence);
      return problem(res, 403, "FORBIDDEN", "Forbidden", "This request is not allowed from this page");
    }
    if (url.pathname === "/v1/auth/session") {
      evidence.sessionExchanges += 1;
      await pm.state.set("oidc-api:evidence", evidence);
      const grant = typeof req.body === "object" && req.body ? req.body : JSON.parse(body);
      const response = await keycloakPost("token", {
        grant_type: "authorization_code", code: grant.code || "",
        code_verifier: grant.codeVerifier || "", redirect_uri: grant.redirectUri || "",
      });
      if (!response.ok) return problem(res, 401, "UNAUTHENTICATED", "Unauthorized", "The sign-in code was rejected");
      return signedIn(res, await response.json());
    }
    if (url.pathname === "/v1/auth/refresh") {
      const refreshToken = sessionCookie(req);
      if (!refreshToken) {
        // Anonymous visitor: nothing to refresh. 204, so the page load logs no error.
        res.writeHead(204, { "Cache-Control": "no-store" });
        return res.end();
      }
      evidence.sessionRefreshes += 1;
      await pm.state.set("oidc-api:evidence", evidence);
      const response = await keycloakPost("token", { grant_type: "refresh_token", refresh_token: refreshToken });
      if (!response.ok) {
        res.setHeader("Set-Cookie", cookie("", 0));
        return problem(res, 401, "UNAUTHENTICATED", "Unauthorized", "The session has ended");
      }
      return signedIn(res, await response.json());
    }
    evidence.sessionLogouts += 1;
    await pm.state.set("oidc-api:evidence", evidence);
    if (sessionCookie(req)) await keycloakPost("logout", { refresh_token: sessionCookie(req) });
    res.writeHead(204, { "Set-Cookie": cookie("", 0), "Cache-Control": "no-store" });
    return res.end();
  }
  if (url.pathname === "/v1/users/me") {
    evidence.meRequests += 1;
    const authorization = req.headers.authorization || "";
    const expectedHash = await pm.state.get("oidc-keycloak:access-token-hash");
    const bearer = authorization.startsWith("Bearer ") && expectedHash
      && createHash("sha256").update(authorization.slice(7)).digest("hex") === expectedHash;
    if (bearer) evidence.bearerRequests += 1;
    await pm.state.set("oidc-api:evidence", evidence);
    const mode = await pm.state.get("oidc-api:mode") || "success";
    if (mode === "profile-503-once" && evidence.meRequests === 1) {
      return problem(res, 503, "SERVICE_UNAVAILABLE", "Service Unavailable", "Profile temporarily unavailable");
    }
    if (mode === "profile-401" || !bearer) {
      return problem(res, 401, "UNAUTHENTICATED", "Unauthorized", "A valid access token is required to access this resource");
    }
    if (mode === "profile-missing-data-once" && evidence.meRequests === 1) {
      return json(res, { code: 0, message: "response success" });
    }
    if (mode === "profile-invalid-user-once" && evidence.meRequests === 1) {
      return json(res, success({ ...user, roles: "BUYER" }));
    }
    return json(res, success(user));
  }
  if (url.pathname === "/v1/auth/register" && req.method === "POST") {
    const fields = typeof req.body === "object" && req.body ? req.body : JSON.parse(body);
    const errors = ["email", "password"].filter((field) => !fields[field]).map((field) => ({
      field, code: "VALIDATION_NOT_BLANK", detail: "cannot be blank!",
    }));
    if (errors.length) return problem(res, 400, "VALIDATION_FAILED", "Validation Failed", "The request data is invalid", errors);
    evidence.registrations += 1;
    await pm.state.set("oidc-api:evidence", evidence);
    return json(res, success({ ...user, email: fields.email, fullName: fields.fullName }), 201);
  }
  await pm.state.set("oidc-api:evidence", evidence);
  if (url.pathname === "/v1/categories/tree") return json(res, success([]));
  if (url.pathname === "/v1/products") return json(res, success([], { number: 0, size: 12, totalElements: 0, totalPages: 0 }));
  return json(res, { title: "Fixture endpoint not implemented", status: 501 }, 501);
});
server.listen(process.env.PORT);
