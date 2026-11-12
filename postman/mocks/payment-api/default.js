/* Local contract fixture for payment UI acceptance; never a bank integration. */
const http = require("node:http");
const { createHash } = require("node:crypto");
const groupId = "a1000000-0000-4000-8000-000000000001";
const buyerId = "68000000-0000-4000-8000-000000000003";
const shops = [{ sellerId: "shop-one", amount: 200000, subtotal: 180000, shippingFee: 20000 }, { sellerId: "shop-two", amount: 150000, subtotal: 150000, shippingFee: 0 }];
const initial = () => ({ paymentRequests: [], authenticatedPayments: 0, qrRequests: 0, groupRequests: [], authenticatedGroups: 0, orderPatches: [], orderListRequests: 0 });
const initialOrders = () => shops.map((shop, index) => ({
  orderId: `a2000000-0000-4000-8000-00000000000${index + 1}`,
  orderNumber: `NX-20261104-000${index + 1}`, userId: buyerId,
  sellerId: `a3000000-0000-4000-8000-00000000000${index + 1}`,
  orderType: "STANDARD", status: "PENDING", createdAt: "2026-11-04T00:00:00Z",
  totalAmount: shop.amount, subtotal: shop.subtotal, shippingFee: shop.shippingFee, discountAmount: 0, taxAmount: 0, items: [],
}));
// Requests run concurrently; serialize evidence writes to avoid losing a poll
// when the header cart/profile request completes at the same time.
let evidenceQueue = Promise.resolve();
function recordEvidence(update) {
  evidenceQueue = evidenceQueue.then(async () => {
    const current = await pm.state.get("payment-api:evidence") || initial();
    update(current);
    await pm.state.set("payment-api:evidence", current);
  });
  return evidenceQueue;
}
const success = (data) => ({ code: 0, message: "response success", data });
function json(res, body, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}
function problem(res, status, code, detail) {
  res.writeHead(status, { "Content-Type": "application/problem+json", "Cache-Control": "no-store" });
  res.end(JSON.stringify({ type: `urn:problem:${code.toLowerCase().replaceAll("_", "-")}`, title: "Payment unavailable", status, code, detail }));
}
async function validBearer(req) {
  const expected = await pm.state.get("oidc-keycloak:access-token-hash");
  const authorization = req.headers.authorization || "";
  return expected && authorization.startsWith("Bearer ")
    && createHash("sha256").update(authorization.slice(7)).digest("hex") === expected;
}
// A deterministic QR-shaped image isolates image loading and layout from the
// external QR provider. Scannability is not a claim of this fixture.
function qrSvg() {
  let cells = "";
  const finder = (x, y) => `<path d="M${x} ${y}h7v7h-7z"/><path fill="white" d="M${x + 1} ${y + 1}h5v5h-5z"/><path d="M${x + 2} ${y + 2}h3v3h-3z"/>`;
  for (let y = 0; y < 33; y += 1) for (let x = 0; x < 33; x += 1) {
    if ((x < 8 && y < 8) || (x > 24 && y < 8) || (x < 8 && y > 24)) continue;
    if ((x * 7 + y * 11 + x * y) % 5 < 2) cells += `<path d="M${x} ${y}h1v1h-1z"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="328" height="328" viewBox="-4 -4 41 41"><path fill="white" d="M-4 -4h41v41h-41z"/><g fill="black">${cells}${finder(0, 0)}${finder(26, 0)}${finder(0, 26)}</g></svg>`;
}
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:3104");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  if (req.method === "OPTIONS") return json(res, {}, 204);
  const url = new URL(req.url, "http://127.0.0.1:3914");
  // Reuse the current gateway session stand-in, including its HttpOnly cookie.
  if (url.pathname.startsWith("/v1/auth/")) {
    const response = await fetch(
      `http://127.0.0.1:3914/session${url.pathname}${url.search}`,
      {
        method: req.method,
        headers: Object.fromEntries(["content-type", "origin", "cookie", "x-requested-with"]
          .filter((name) => req.headers[name]).map((name) => [name, req.headers[name]])),
        ...(req.method === "POST" ? { body: typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}) } : {}),
      },
    );
    for (const cookie of response.headers.getSetCookie()) res.appendHeader("Set-Cookie", cookie);
    res.writeHead(response.status, {
      "Content-Type": response.headers.get("Content-Type") || "application/json",
      "Cache-Control": "no-store",
    });
    return res.end(await response.text());
  }
  if (url.pathname === "/health") return json(res, { ready: true });
  if (url.pathname === "/test/reset") {
    await pm.state.set("payment-api:evidence", initial());
    await pm.state.set("payment-api:sessions", {});
    await pm.state.set("payment-api:orders", initialOrders());
    await pm.state.set("payment-api:order-mode", "success");
    await pm.state.set("payment-api:order-delay", 0);
    await pm.state.set("payment-api:mode", url.searchParams.get("mode") || "success");
    await pm.state.set("payment-api:session-misses", 0);
    return json(res, {});
  }
  if (url.pathname === "/test/mode") {
    await pm.state.set("payment-api:mode", url.searchParams.get("mode") || "success");
    await pm.state.set("payment-api:session-misses", 0);
    return json(res, {});
  }
  if (url.pathname === "/test/order-mode") {
    await pm.state.set("payment-api:order-mode", url.searchParams.get("mode") || "success");
    await pm.state.set("payment-api:order-delay", Math.min(5000, Math.max(0, Number(url.searchParams.get("delay")) || 0)));
    return json(res, {});
  }
  const evidence = await pm.state.get("payment-api:evidence") || initial();
  if (url.pathname === "/test/evidence") return json(res, { ...evidence, shops });
  if (url.pathname === "/test/qr.svg") {
    await recordEvidence((current) => { current.qrRequests += 1; });
    res.writeHead(200, { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" });
    return res.end(qrSvg());
  }
  if (url.pathname === "/v1/categories/tree") return json(res, success([]));
  if (req.method === "GET" && ["/v1/notifications", "/v1/notifications/unread-count"].includes(url.pathname)) {
    if (!await validBearer(req)) return problem(res, 401, "UNAUTHENTICATED", "A valid access token is required.");
    return json(res, url.pathname.endsWith("unread-count")
      ? success({ count: 0 })
      : { ...success([]), page: { number: 0, size: 10, totalElements: 0, totalPages: 0 } });
  }
  if (url.pathname === "/v1/users/me") {
    if (!await validBearer(req)) return problem(res, 401, "UNAUTHENTICATED", "A valid access token is required.");
    return json(res, success({
      id: buyerId, email: "buyer@nexus.local", fullName: "Fixture Buyer", phone: "0901234567",
      gender: "OTHER", address: "Ho Chi Minh City", dateOfBirth: "2000-01-01", roles: ["BUYER"],
      status: "ACTIVE", createdAt: "2026-11-04T00:00:00Z",
    }));
  }
  if (url.pathname === "/v1/carts/me" && req.method === "GET") {
    if (!await validBearer(req)) return problem(res, 401, "UNAUTHENTICATED", "A valid access token is required.");
    return json(res, success({ id: "payment-header-cart", userId: buyerId, status: "ACTIVE", items: [] }));
  }
  const groupMatch = /^\/v1\/orders\/groups\/([^/]+)$/.exec(url.pathname);
  if (groupMatch && req.method === "GET") {
    const authenticated = Boolean(await validBearer(req));
    await recordEvidence((current) => {
      current.groupRequests.push({ method: req.method, groupId: groupMatch[1], at: Date.now() });
      if (authenticated) current.authenticatedGroups += 1;
    });
    if (!authenticated) return problem(res, 401, "UNAUTHENTICATED", "A valid access token is required.");
    if (groupMatch[1] !== groupId) return problem(res, 404, "COMMERCE_ORDER_NOT_FOUND", "Order group not found.");
    const mode = await pm.state.get("payment-api:order-mode") || "success";
    if (mode === "unavailable") return problem(res, 503, "COMMERCE_UNAVAILABLE", "Order status is temporarily unavailable.");
    const orders = await pm.state.get("payment-api:orders") || initialOrders();
    const data = {
      orderGroupId: groupId, status: "PENDING", totalAmount: 350000, currency: "VND",
      dueAt: new Date(Date.now() + 600000).toISOString(),
      orders: mode === "empty" ? [] : mode === "mixed" ? orders.map((order, index) => ({ ...order, status: index ? "CANCELED" : "PAID" })) : orders,
    };
    const delay = await pm.state.get("payment-api:order-delay") || 0;
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    return json(res, success(data));
  }
  const statusMatch = /^\/v1\/orders\/([^/]+)\/status$/.exec(url.pathname);
  if (statusMatch && req.method === "PATCH") {
    // A local test-only admin identity exercises the HTTP trigger. It does not
    // prove real Keycloak ADMIN authorization; buyer tokens remain rejected.
    if (req.headers.authorization !== "Bearer fixture-admin")
      return problem(res, 403, "FORBIDDEN", "Only an administrator can change order status.");
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const orders = await pm.state.get("payment-api:orders") || initialOrders();
    const order = orders.find((entry) => entry.orderId === statusMatch[1]);
    if (!order) return problem(res, 404, "COMMERCE_ORDER_NOT_FOUND", "Order not found.");
    if (!["PAID", "CANCELED"].includes(body?.status) || order.status !== "PENDING")
      return problem(res, 409, "COMMERCE_INVALID_ORDER_STATUS_TRANSITION", "The order status transition is not allowed.");
    order.status = body.status;
    await pm.state.set("payment-api:orders", orders);
    await recordEvidence((current) => { current.orderPatches.push({ orderId: order.orderId, status: order.status }); });
    return json(res, success(order));
  }
  if (url.pathname === "/v1/orders" && req.method === "GET") {
    if (!await validBearer(req)) return problem(res, 401, "UNAUTHENTICATED", "A valid access token is required.");
    await recordEvidence((current) => { current.orderListRequests += 1; });
    const orders = await pm.state.get("payment-api:orders") || initialOrders();
    return json(res, { ...success(orders), page: { number: 0, size: 10, totalElements: orders.length, totalPages: 1 } });
  }
  if (url.pathname === "/v1/payments" && req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const authenticated = await validBearer(req);
    await recordEvidence((current) => {
      current.paymentRequests.push({ method: req.method, body });
      if (authenticated) current.authenticatedPayments += 1;
    });
    if (!authenticated) return problem(res, 401, "UNAUTHENTICATED", "A valid access token is required.");
    if (Object.keys(body || {}).length !== 1 || !body?.orderGroupId)
      return problem(res, 400, "VALIDATION_FAILED", "Only orderGroupId is accepted.");
    if (body.orderGroupId !== groupId)
      return problem(res, 404, "PAYMENT_SESSION_NOT_FOUND", "Payment instructions are not ready for this group.");
    const mode = await pm.state.get("payment-api:mode") || "success";
    if (mode === "session-pending" || mode === "session-missing") {
      const misses = await pm.state.get("payment-api:session-misses") || 0;
      if (mode === "session-missing" || misses < 2) {
        await pm.state.set("payment-api:session-misses", misses + 1);
        return problem(res, 404, "PAYMENT_SESSION_NOT_FOUND", "Payment instructions are not ready for this group.");
      }
    }
    if (mode === "unavailable") return problem(res, 503, "PAYMENT_PROVIDER_UNAVAILABLE", "Bank transfer instructions are temporarily unavailable.");
    if (mode === "expired") return problem(res, 409, "PAYMENT_SESSION_NOT_PAYABLE", "This payment session has expired.");
    const sessions = await pm.state.get("payment-api:sessions") || {};
    const now = Date.now();
    if (!sessions[groupId]) {
      sessions[groupId] = {
        sessionId: "ec2a083f-868b-4d3e-9dda-1904a9c7bbdd",
        qrImageUrl: "http://127.0.0.1:3914/api/test/qr.svg",
        bankAccount: "0000000002", amount: shops.reduce((total, shop) => total + shop.amount, 0),
        memoCode: "NX20261104001", transferContent: "SEVQR NX20261104001",
        expiresAt: new Date(now + (mode === "short" ? 2500 : 600000)).toISOString(),
      };
      await pm.state.set("payment-api:sessions", sessions);
    }
    const data = { ...sessions[groupId], serverNow: new Date(now).toISOString() };
    if (mode === "missing-server-time") delete data.serverNow;
    return json(res, success(data), 201);
  }
  return problem(res, 501, "FIXTURE_NOT_IMPLEMENTED", "The local fixture does not model this endpoint.");
});
server.listen(process.env.PORT);
