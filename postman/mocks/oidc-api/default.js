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
});
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

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", process.env.NEXUS_OIDC_APP_ORIGIN || "http://127.0.0.1:3103");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Guest-Token, Idempotency-Key");
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
