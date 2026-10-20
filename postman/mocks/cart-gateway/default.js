/* Postman loads local mock handlers as CommonJS. */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Local Sprint 1 cart stand-in. Cart paths and DTOs follow the FE task's draft
 * contract; no Cart controller exists in the checked-out commerce service.
 * The CLI is signed out, so a published owner mock could not be searched.
 * Optional display metadata supports the cart reference without checkout data.
 */
const http = require("node:http");

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
const token = "local-cart-fixture-token";
const productId = "91300001-1111-4111-8111-111111111111";
const skuId = "91300002-1111-4111-8111-111111111111";
const productName = "Wireless Headphones Silver";
const product = {
  id: productId,
  name: productName,
  slug: `wireless-headphones-silver-${productId}`,
  minPrice: "1500000.00",
  categoryId: "91300003-1111-4111-8111-111111111111",
  sellerId: "91300004-1111-4111-8111-111111111111",
  status: "ACTIVE",
  description: "Silver wireless headphones for the cart acceptance scenario.",
  auctionEnable: false,
  skus: [{
    id: skuId, productId, skuCode: "CART-HEADPHONES-SILVER", color: "Silver",
    size: null, price: "1500000.00", status: "ACTIVE",
  }],
  images: [],
};

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
};
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
  res.writeHead(status, corsHeaders);
  res.end(JSON.stringify(value));
}

function cartItem(quantity = 1) {
  return {
    id: "91300005-1111-4111-8111-111111111111", skuId, productId, productName,
    quantity, unitPrice: "1500000.00", lineTotal: (1500000 * quantity).toFixed(2),
    sellerId: product.sellerId, sellerName: "Nexus Audio Store", color: "Silver", size: null,
  };
}

function cart(items = []) {
  return {
    id: "91300006-1111-4111-8111-111111111111", status: "ACTIVE", items,
    subtotal: items.reduce((sum, item) => sum + Number(item.lineTotal), 0).toFixed(2),
    currency: "VND", updatedAt: "2026-10-20T08:00:00Z",
  };
}

const pause = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));
const cartPath = "/v1/carts/me";

const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  if (req.method === "OPTIONS") return json(res, {});
  if (path === "/health") return json(res, { ready: true });

  if (path === "/__test/reset" && req.method === "POST") {
    await pendingHistoryWrite;
    await pm.state.set(stateKey("cart"), cart(req.body?.seeded ? [cartItem(req.body?.quantity || 1)] : []));
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

  await recordRequest({ method: req.method, path, body: req.body ?? null, authenticated: req.headers.authorization === `Bearer ${token}` });
  const controls = await pm.state.get(stateKey("controls")) || {};

  // Simulation strips routeKey /api; callers still use /api/v1/... paths.
  // @endpoint POST /v1/auth/login
  if (path === "/v1/auth/login" && req.method === "POST") {
    if (req.body?.email !== user.email || req.body?.password !== "cart-password") {
      return json(res, { title: "Unauthorized", status: 401, detail: "Invalid credentials" }, 401);
    }
    return json(res, { accessToken: token, expiresIn: 3600, tokenType: "Bearer" });
  }
  if ((path === "/v1/users/me" || path.startsWith(cartPath)) && req.headers.authorization !== `Bearer ${token}`) {
    return json(res, { title: "Unauthorized", status: 401 }, 401);
  }
  // @endpoint GET /v1/users/me
  if (path === "/v1/users/me" && req.method === "GET") return json(res, user);
  if (path === "/v1/categories/tree") {
    return json(res, [{ id: product.categoryId, name: "Electronics", slug: "electronics", parentId: null, level: 1, children: [] }]);
  }
  if (path === "/v1/products") return json(res, { content: [product], page: 0, size: 20, totalElements: 1 });
  if (path === `/v1/products/${productId}`) return json(res, product);

  // @endpoint GET /v1/carts/me
  if (path === cartPath && req.method === "GET") {
    if (controls.getDelayMs) await pause(controls.getDelayMs);
    if (controls.getStatus) return json(res, { title: "Cart unavailable", status: controls.getStatus, detail: "Unable to load your cart." }, controls.getStatus);
    return json(res, await pm.state.get(stateKey("cart")) || cart());
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
    const next = cart([cartItem((existing?.quantity || 0) + req.body.quantity)]);
    await pm.state.set(stateKey("cart"), next);
    return json(res, next);
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
    const next = req.method === "DELETE" ? cart() : cart([cartItem(req.body.quantity)]);
    await pm.state.set(stateKey("cart"), next);
    if (req.method === "DELETE") {
      res.writeHead(204, corsHeaders);
      return res.end();
    }
    return json(res, next);
  }
  return json(res, { title: "Endpoint not modelled", detail: `${req.method} ${path}` }, 501);
});

server.listen(process.env.PORT || 3913);
