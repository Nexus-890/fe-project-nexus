/* Local API fixture; the simulation removes the /api route prefix.
 * Authenticated cart payloads follow CartResponse.java. Guest/merge endpoints
 * model the proposed FE handoff contract, not an implemented backend guarantee.
 */
const http = require("node:http");
const { createHash, randomUUID } = require("node:crypto");
const productId = "00000004-1111-4111-8111-111111111111";
const skuId = "00000003-1111-4111-8111-111111111111";
const initial = () => ({
  meRequests: 0, bearerRequests: 0, passwordLeaks: 0, loginRequests: 0, registrations: 0,
  guestCreationRequests: 0, guestCreations: 0, guestReads: 0, guestAdds: 0,
  guestBearerLeaks: 0, cartReads: 0, cartAdds: 0, mergeRequests: 0, mergesApplied: 0,
  mergeKeys: [], mergePaths: [], protectedRequests: 0, protectedRetries: 0, protectedCalls: [],
  sessionExchanges: 0, sessionRefreshes: 0, sessionLogouts: 0, csrfRejected: 0, cookieLeaks: 0,
});
// 3103 runs the OIDC suite; 3102 runs the catalog suite, whose fixture forwards /api/v1/auth/* here.
const appOrigins = new Set(["http://127.0.0.1:3102", "http://127.0.0.1:3103", process.env.NEXUS_OIDC_APP_ORIGIN].filter(Boolean));
const keycloak = `http://127.0.0.1:${process.env.NEXUS_OIDC_SIM_PORT || "3913"}/keycloak/realms/nexus/protocol/openid-connect`;
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
const user = {
  id: "68000000-0000-4000-8000-000000000003", email: "buyer@nexus.local", phone: "0901234567",
  fullName: "Fixture Buyer", gender: "OTHER", address: "Ho Chi Minh City", dateOfBirth: "2000-01-01",
  roles: ["BUYER"], status: "ACTIVE", createdAt: "2026-11-03T00:00:00Z",
};
const product = {
  id: productId, name: "Guest cart fixture tablet", slug: `fixture-tablet-${productId}`,
  categoryId: "00000010-1111-4111-8111-111111111111", sellerId: "00000080-1111-4111-8111-111111111111",
  status: "ACTIVE", description: "Product used by the real browser cart flow.",
  auctionEnable: false, minPrice: 150000,
  skus: [{ id: skuId, productId, skuCode: "TABLET-FIXTURE", color: "Silver", size: "64GB", price: 150000, status: "ACTIVE" }],
  images: [],
};
const emptyCart = (id, userId = null) => ({ id, userId, status: "ACTIVE", items: [] });
function add(cart, input) {
  const existing = cart.items.find((item) => item.skuId === input.skuId);
  if (existing) existing.quantity += input.quantity;
  else cart.items.push({ id: randomUUID(), productId, skuId: input.skuId, quantity: input.quantity, unitPrice: 150000 });
}
function seededCart() {
  const cart = emptyCart("68000000-0000-4000-8000-000000000020", user.id);
  add(cart, { skuId, quantity: 3 });
  return cart;
}
let evidence = initial();
let mode = "success";
let guests = {};
let merged = {};
let buyerCart = seededCart();
let protectedAttempts = {};

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
const total = (cart) => cart.items.reduce((count, item) => count + item.quantity, 0);
function signedIn(res, tokens) {
  res.setHeader("Set-Cookie", cookie(tokens.refresh_token, tokens.refresh_expires_in));
  return json(res, success({ accessToken: tokens.access_token, idToken: tokens.id_token, expiresIn: tokens.expires_in }));
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", appOrigins.has(req.headers.origin) ? req.headers.origin : "http://127.0.0.1:3103");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Guest-Token, Idempotency-Key, X-Requested-With");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return json(res, {});
  const url = new URL(req.url, "http://127.0.0.1:3913");
  if (url.pathname === "/test/reset") {
    evidence = initial();
    mode = url.searchParams.get("mode") || "success";
    guests = {};
    merged = {};
    buyerCart = seededCart();
    protectedAttempts = {};
    return json(res, {});
  }
  if (url.pathname === "/test/control") {
    if (url.searchParams.has("mode")) mode = url.searchParams.get("mode");
    return json(res, { mode });
  }
  if (url.pathname === "/test/evidence") return json(res, { ...evidence, buyerQuantity: total(buyerCart) });
  const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
  if (url.pathname !== "/v1/auth/register" && /password/i.test(body)) evidence.passwordLeaks += 1;
  if (url.pathname === "/v1/auth/login") evidence.loginRequests += 1;
  // The cookie path must keep the refresh token away from every other API call.
  if (!url.pathname.startsWith("/v1/auth/") && sessionCookie(req)) evidence.cookieLeaks += 1;
  if (["/v1/auth/session", "/v1/auth/refresh", "/v1/auth/logout"].includes(url.pathname) && req.method === "POST") {
    if (req.headers["x-requested-with"] !== "nexus-web" || !appOrigins.has(req.headers.origin)) {
      evidence.csrfRejected += 1;
      return problem(res, 403, "FORBIDDEN", "Forbidden", "This request is not allowed from this page");
    }
    if (url.pathname === "/v1/auth/session") {
      evidence.sessionExchanges += 1;
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
      const response = await keycloakPost("token", { grant_type: "refresh_token", refresh_token: refreshToken });
      if (!response.ok) {
        res.setHeader("Set-Cookie", cookie("", 0));
        return problem(res, 401, "UNAUTHENTICATED", "Unauthorized", "The session has ended");
      }
      return signedIn(res, await response.json());
    }
    evidence.sessionLogouts += 1;
    if (sessionCookie(req)) await keycloakPost("logout", { refresh_token: sessionCookie(req) });
    res.writeHead(204, { "Set-Cookie": cookie("", 0), "Cache-Control": "no-store" });
    return res.end();
  }
  const authorization = req.headers.authorization || "";
  const validBearer = async () => {
    const expectedHash = await pm.state.get("oidc-keycloak:access-token-hash");
    const expiry = await pm.state.get("oidc-keycloak:access-token-expiry");
    const time = await pm.state.get("oidc-keycloak:clock-time") ?? Date.now();
    return Boolean(authorization.startsWith("Bearer ") && expectedHash
      && createHash("sha256").update(authorization.slice(7)).digest("hex") === expectedHash
      && typeof expiry === "number" && expiry > Math.floor(time / 1000));
  };
  if (url.pathname === "/v1/test/protected") {
    const key = url.searchParams.get("key") || "request";
    const attempt = (protectedAttempts[key] || 0) + 1;
    protectedAttempts[key] = attempt;
    evidence.protectedRequests += 1;
    if (attempt > 1) evidence.protectedRetries += 1;
    const bearer = await validBearer();
    const reject = !bearer || mode === "protected-401-always"
      || (mode === "protected-401-once" && attempt === 1);
    evidence.protectedCalls.push({ key, attempt, status: reject ? 401 : 200, bearer });
    // One first response deliberately arrives after the successful renewal.
    // The client must reuse the newer token rather than renew a second time.
    if (reject && attempt === 1 && mode === "protected-401-once") {
      await new Promise((resolve) => setTimeout(resolve, key === "c" ? 350 : 30));
    }
    return reject
      ? problem(res, 401, "UNAUTHENTICATED", "Unauthorized", "A valid access token is required to access this resource")
      : json(res, success({ accepted: true, key }));
  }
  if (url.pathname === "/v1/users/me") {
    evidence.meRequests += 1;
    const bearer = await validBearer();
    if (bearer) evidence.bearerRequests += 1;
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
  if (url.pathname.startsWith("/v1/carts/")) {
    const input = typeof req.body === "object" && req.body ? req.body : JSON.parse(body);
    const validItem = () => input.skuId === skuId && Number.isSafeInteger(input.quantity) && input.quantity > 0;
    if (url.pathname.startsWith("/v1/carts/guest")) {
      if (authorization) {
        evidence.guestBearerLeaks += 1;
        return problem(res, 400, "VALIDATION_FAILED", "Validation Failed", "Guest requests must not carry an account token");
      }
      if (url.pathname === "/v1/carts/guest" && req.method === "POST") {
        evidence.guestCreationRequests += 1;
        if (mode === "guest-disabled") return problem(res, 403, "FORBIDDEN", "Forbidden", "Guest carts are disabled");
        const token = `guest-${randomUUID()}`;
        const cart = emptyCart(randomUUID());
        guests[token] = cart;
        evidence.guestCreations += 1;
        return json(res, success({ guestToken: token, cart }), 201);
      }
      const cart = guests[req.headers["x-guest-token"]];
      if (!cart) return problem(res, 404, "CART_NOT_FOUND", "Not Found", "Guest cart not found");
      if (url.pathname === "/v1/carts/guest" && req.method === "GET") {
        evidence.guestReads += 1;
        return json(res, success(cart));
      }
      if (url.pathname === "/v1/carts/guest/items" && req.method === "POST") {
        if (mode === "guest-disabled") return problem(res, 403, "FORBIDDEN", "Forbidden", "Guest carts are disabled");
        if (!validItem()) return problem(res, 400, "VALIDATION_FAILED", "Validation Failed", "Invalid cart item");
        add(cart, input);
        evidence.guestAdds += 1;
        return json(res, success(cart), 201);
      }
    }
    if (!await validBearer()) return problem(res, 401, "UNAUTHENTICATED", "Unauthorized", "A valid access token is required to access this resource");
    if (url.pathname === "/v1/carts/me" && req.method === "GET") {
      evidence.cartReads += 1;
      return json(res, success(buyerCart));
    }
    if (url.pathname === "/v1/carts/me/items" && req.method === "POST") {
      if (!validItem()) return problem(res, 400, "VALIDATION_FAILED", "Validation Failed", "Invalid cart item");
      add(buyerCart, input);
      evidence.cartAdds += 1;
      return json(res, success(buyerCart), 201);
    }
    if (url.pathname === "/v1/carts/me/merge" && req.method === "POST") {
      evidence.mergeRequests += 1;
      const token = req.headers["x-guest-token"];
      const key = req.headers["idempotency-key"];
      if (!token || typeof key !== "string" || !key) return problem(res, 400, "VALIDATION_FAILED", "Validation Failed", "Guest token and idempotency key are required");
      evidence.mergeKeys.push(key);
      evidence.mergePaths.push(url.pathname);
      if (mode === "merge-503-once" && evidence.mergeRequests === 1) return problem(res, 503, "SERVICE_UNAVAILABLE", "Service Unavailable", "Cart merge temporarily unavailable");
      if (merged[key]) {
        if (merged[key].token !== token) return problem(res, 409, "IDEMPOTENCY_CONFLICT", "Conflict", "Merge key belongs to another guest cart");
        return json(res, success(merged[key].cart));
      }
      const guest = guests[token];
      if (!guest) return problem(res, 404, "CART_NOT_FOUND", "Not Found", "Guest cart not found");
      for (const item of guest.items) add(buyerCart, item);
      merged[key] = { token, cart: JSON.parse(JSON.stringify(buyerCart)) };
      delete guests[token];
      evidence.mergesApplied += 1;
      // Models an atomic server commit whose successful response was lost.
      if (mode === "merge-committed-503-once" && evidence.mergeRequests === 1) return problem(res, 503, "SERVICE_UNAVAILABLE", "Service Unavailable", "Cart merge response unavailable");
      return json(res, success(buyerCart));
    }
  }
  await pm.state.set("oidc-api:evidence", evidence);
  if (url.pathname === "/v1/categories/tree") return json(res, success([]));
  if (url.pathname === "/v1/products") return json(res, success([], { number: 0, size: 12, totalElements: 0, totalPages: 0 }));
  if (url.pathname === `/v1/products/${productId}/skus/${skuId}`) return json(res, success(product.skus[0]));
  if (url.pathname === `/v1/products/${productId}`) return json(res, success(product));
  return problem(res, 501, "NOT_IMPLEMENTED", "Not Implemented", "Fixture endpoint not implemented");
});
server.listen(process.env.PORT);
