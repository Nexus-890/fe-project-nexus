/* Postman loads local mock handlers as CommonJS. */
/**
 * Cart HTTP stand-in based on origin/develop's CartController, CartResponse,
 * CartItemResponse and common-core ApiResponse. Cart prices are JSON numbers;
 * responses contain no catalog metadata or precomputed totals.
 * This local fixture uses the repository's backend sources; no published mock is used.
 */
const http = require("node:http");
const { createHash } = require("node:crypto");

const user = {
  id: "91300000-1111-4111-8111-111111111111",
  email: "cart.buyer@example.com",
  phone: "+84911111111",
  fullName: "Cart Buyer",
  gender: null,
  address: null,
  dateOfBirth: null,
  roles: ["BUYER"],
  status: "ACTIVE",
  createdAt: "2026-10-01T08:00:00Z",
};
const productId = "91300001-1111-4111-8111-111111111111";
const skuId = "91300002-1111-4111-8111-111111111111";
const secondProductId = "91300007-1111-4111-8111-111111111111";
const secondSkuId = "91300008-1111-4111-8111-111111111111";
const productName = "Wireless Headphones Silver";
const product = {
  id: productId,
  name: productName,
  slug: `wireless-headphones-silver-${productId}`,
  minPrice: 1500000,
  categoryId: "91300003-1111-4111-8111-111111111111",
  sellerId: "91300004-1111-4111-8111-111111111111",
  status: "ACTIVE",
  description: "Silver wireless headphones for the cart acceptance scenario.",
  auctionEnable: false,
  skus: [{
    id: skuId, productId, skuCode: "CART-HEADPHONES-SILVER", color: "Silver",
    size: null, price: 1500000, status: "ACTIVE",
  }],
  images: [],
};

const appOrigin = "http://127.0.0.1:3104";
const corsHeaders = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const stateKey = (name) => `cart-gateway:${name}`;
let pendingHistoryWrite = Promise.resolve();

// Browser shell requests arrive together; serialize read/modify/write so the
// evidence log cannot lose an entry when two pm.state calls interleave.
function recordRequest(entry) {
  const write = pendingHistoryWrite.then(async () => {
    const requests = await pm.state.get(stateKey("requests")) || [];
    requests.push(entry);
    await pm.state.set(stateKey("requests"), requests);
  });
  pendingHistoryWrite = write.catch(() => {});
  return write;
}

function json(res, value, status = 200) {
  if (status >= 400) {
    const code = value.code || ({ 400: "VALIDATION_FAILED", 401: "UNAUTHENTICATED", 403: "FORBIDDEN", 404: "NOT_FOUND", 503: "SERVICE_UNAVAILABLE" }[status] || "INTERNAL_ERROR");
    const problemType = ({ VALIDATION_FAILED: "validation-error", UNAUTHENTICATED: "unauthorized" }[code] || code.toLowerCase().replaceAll("_", "-"));
    const type = value.type || `urn:problem:${problemType}`;
    value = { type, code, status, ...value };
  }
  res.writeHead(status, { ...corsHeaders, ...(status >= 400 ? { "Content-Type": "application/problem+json" } : {}) });
  res.end(JSON.stringify(value));
}

function cartItem(quantity = 1, secondary = false) {
  return {
    id: secondary ? "91300009-1111-4111-8111-111111111111" : "91300005-1111-4111-8111-111111111111",
    skuId: secondary ? secondSkuId : skuId,
    productId: secondary ? secondProductId : productId,
    quantity, unitPrice: secondary ? 500000.5 : 1500000,
  };
}

function cart(items = []) {
  return {
    id: "91300006-1111-4111-8111-111111111111", userId: user.id, status: "ACTIVE", items,
  };
}

function cartResponse(res, value, status = 200, page) {
  return json(res, { code: 0, message: "response success", data: value, ...(page ? { page } : {}) }, status);
}

// THAY CHO SessionController CỦA GATEWAY (#252): ĐỔI MÃ, LÀM MỚI, ĐĂNG XUẤT QUA COOKIE HttpOnly, CORS CHỈ CHO ORIGIN CỦA APP
const keycloak = "http://127.0.0.1:3913/keycloak/realms/nexus/protocol/openid-connect";
const sessionPaths = new Set(["/v1/auth/session", "/v1/auth/refresh", "/v1/auth/logout"]);
const cookie = (value, maxAge) => `nexus_rt=${value}; Path=/api/v1/auth; Max-Age=${maxAge}; HttpOnly; SameSite=Lax`;
const sessionCookie = (req) => (req.headers.cookie || "").split(/;\s*/)
  .find((part) => part.startsWith("nexus_rt="))?.slice("nexus_rt=".length) || "";

function cors(req, res) {
  res.setHeader("Vary", "Origin");
  if (!req.headers.origin) return true;
  if (req.headers.origin !== appOrigin) return false;
  res.setHeader("Access-Control-Allow-Origin", appOrigin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept, X-Requested-With");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  return true;
}

function keycloakPost(path, form) {
  return fetch(`${keycloak}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: "nexus-web", ...form }),
  });
}

async function session(req, res, path, controls) {
  if (req.headers["x-requested-with"] !== "nexus-web") {
    return json(res, { title: "Forbidden", status: 403, detail: "This request is not allowed from this page" }, 403);
  }
  const signedIn = async (response) => {
    const tokens = await response.json();
    res.setHeader("Set-Cookie", cookie(tokens.refresh_token, tokens.refresh_expires_in));
    return json(res, { code: 0, message: "response success",
      data: { accessToken: tokens.access_token, idToken: tokens.id_token, expiresIn: tokens.expires_in } });
  };
  if (path === "/v1/auth/session") {
    const grant = req.body && typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
    const response = await keycloakPost("token", {
      grant_type: "authorization_code", code: grant.code || "",
      code_verifier: grant.codeVerifier || "", redirect_uri: grant.redirectUri || "",
    });
    if (!response.ok) return json(res, { title: "Unauthorized", status: 401, detail: "The sign-in code was rejected" }, 401);
    return signedIn(response);
  }
  if (path === "/v1/auth/refresh") {
    const refreshToken = sessionCookie(req);
    if (!refreshToken) {
      res.writeHead(204, { "Cache-Control": "no-store" });
      return res.end();
    }
    if (controls.refreshStatus) {
      return json(res, { title: "Service Unavailable", status: controls.refreshStatus, detail: "The sign-in service is not reachable" }, controls.refreshStatus);
    }
    const response = await keycloakPost("token", { grant_type: "refresh_token", refresh_token: refreshToken });
    if (!response.ok) {
      res.setHeader("Set-Cookie", cookie("", 0));
      return json(res, { title: "Unauthorized", status: 401, detail: "The session has ended" }, 401);
    }
    return signedIn(response);
  }
  if (sessionCookie(req)) await keycloakPost("logout", { refresh_token: sessionCookie(req) });
  res.writeHead(204, { "Set-Cookie": cookie("", 0), "Cache-Control": "no-store" });
  return res.end();
}

const pause = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));
const cartPath = "/v1/carts/me";

const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  if (!cors(req, res)) return json(res, { title: "Forbidden", status: 403, detail: "This origin is not allowed" }, 403);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }
  if (path === "/health") return json(res, { ready: true });

  if (path === "/__test/reset" && req.method === "POST") {
    await pendingHistoryWrite;
    const items = req.body?.seeded ? [cartItem(req.body?.quantity || 1)] : [];
    if (req.body?.secondQuantity) items.push(cartItem(req.body.secondQuantity, true));
    await pm.state.set(stateKey("cart"), cart(items));
    await pm.state.set(stateKey("controls"), {});
    await pm.state.set(stateKey("requests"), []);
    return json(res, {});
  }
  if (path === "/__test/control" && req.method === "POST") {
    const controls = await pm.state.get(stateKey("controls")) || {};
    await pm.state.set(stateKey("controls"), { ...controls, ...req.body });
    return json(res, {});
  }
  if (path === "/__test/requests") {
    await pendingHistoryWrite;
    return json(res, await pm.state.get(stateKey("requests")) || []);
  }
  if (path === "/__test/cart") {
    return json(res, await pm.state.get(stateKey("cart")) || cart());
  }

  if (sessionPaths.has(path) && req.method === "POST") {
    return session(req, res, path, await pm.state.get(stateKey("controls")) || {});
  }

  const authorization = req.headers.authorization || "";
  const expectedHash = await pm.state.get("oidc-keycloak:access-token-hash");
  const authenticated = Boolean(authorization.startsWith("Bearer ") && expectedHash
    && createHash("sha256").update(authorization.slice(7)).digest("hex") === expectedHash);
  await recordRequest({ method: req.method, path, body: req.body ?? null, authenticated });
  const controls = await pm.state.get(stateKey("controls")) || {};

  // Simulation strips routeKey /api; callers still use /api/v1/... paths.
  if ((path === "/v1/users/me" || path.startsWith(cartPath)) && !authenticated) {
    return json(res, { title: "Unauthorized", status: 401 }, 401);
  }
  // @endpoint GET /v1/users/me
  if (path === "/v1/users/me" && req.method === "GET") return cartResponse(res, user);
  if (path === "/v1/categories/tree") {
    return cartResponse(res, [{ id: product.categoryId, name: "Electronics", slug: "electronics", parentId: null, level: 1, children: [] }]);
  }
  if (path === "/v1/products") return cartResponse(res, [product], 200, { number: 0, size: 20, totalElements: 1, totalPages: 1 });
  if (path === `/v1/products/${productId}`) return cartResponse(res, product);

  // @endpoint GET /v1/carts/me
  if (path === cartPath && req.method === "GET") {
    if (controls.getDelayMs) await pause(controls.getDelayMs);
    if (controls.getStatus) return json(res, { title: "Cart unavailable", status: controls.getStatus, detail: "Unable to load your cart." }, controls.getStatus);
    return cartResponse(res, await pm.state.get(stateKey("cart")) || cart());
  }

  // @endpoint POST /v1/carts/me/items
  if (path === `${cartPath}/items` && req.method === "POST") {
    if (controls.postDelayMs) await pause(controls.postDelayMs);
    if (controls.postStatus) return json(res, { title: "Unable to add item", status: controls.postStatus }, controls.postStatus);
    if (req.body?.skuId !== skuId) return json(res, { title: "SKU not found", status: 404 }, 404);
    if (!Number.isInteger(req.body.quantity) || req.body.quantity < 1 || Object.keys(req.body).some(key => !["skuId", "quantity"].includes(key))) {
      return json(res, { title: "Validation failed", status: 400, detail: "skuId and positive quantity are required" }, 400);
    }
    const current = await pm.state.get(stateKey("cart")) || cart();
    const existing = current.items.find(item => item.skuId === skuId);
    const next = cart([
      ...current.items.filter(item => item.skuId !== skuId),
      cartItem((existing?.quantity || 0) + req.body.quantity),
    ]);
    await pm.state.set(stateKey("cart"), next);
    return cartResponse(res, next, 201);
  }

  const itemMatch = path.match(/^\/v1\/carts\/me\/items\/([^/]+)$/);
  if (itemMatch && (req.method === "PUT" || req.method === "DELETE")) {
    const current = await pm.state.get(stateKey("cart")) || cart();
    const item = current.items.find(entry => entry.id === decodeURIComponent(itemMatch[1]));
    if (!item) return json(res, { title: "Cart item not found", status: 404 }, 404);
    if (controls.writeDelayMs) await pause(controls.writeDelayMs);
    if (controls.writeStatus) return json(res, { title: "Unable to update cart", status: controls.writeStatus }, controls.writeStatus);
    if (req.method === "PUT" && (!Number.isInteger(req.body?.quantity) || req.body.quantity < 1 || Object.keys(req.body).some(key => key !== "quantity"))) {
      return json(res, { title: "Validation failed", status: 400 }, 400);
    }
    const next = cart(req.method === "DELETE"
      ? current.items.filter(entry => entry.id !== item.id)
      : current.items.map(entry => entry.id === item.id ? { ...entry, quantity: req.body.quantity } : entry));
    await pm.state.set(stateKey("cart"), next);
    if (req.method === "DELETE") {
      res.writeHead(204, corsHeaders);
      return res.end();
    }
    return cartResponse(res, next);
  }
  return json(res, { title: "Endpoint not modelled", detail: `${req.method} ${path}` }, 501);
});

server.listen(process.env.PORT || 3913);
