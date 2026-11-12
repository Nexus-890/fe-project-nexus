/* Stateful HTTP dependencies for the real frontend's back-office demo.
 * The test-only payment callback models missing #156; it is never production code.
 */
const http = require("node:http");
const { randomUUID, createHash } = require("node:crypto");
const origin = "http://127.0.0.1:3920";
const seller = "68000000-0000-4000-8000-000000000002";
const category = "69000000-0000-4000-8000-000000000103";
const warehouse = "69000000-0000-4000-8000-000000000001";
let products = [], balances = {}, carts = {}, orders = [], groups = {}, evidence = [], rejectPublish = false, profileRole = null;
const envelope = (data) => ({ code: 0, message: "response success", data });
function json(res, body, status = 200) { res.writeHead(status, { "Content-Type": status >= 400 ? "application/problem+json" : "application/json", "Cache-Control": "no-store" }); res.end(status === 204 ? undefined : JSON.stringify(body)); }
const ok = (res, data, status = 200) => json(res, envelope(data), status);
const problem = (res, status, detail) => json(res, { type: "urn:problem:backoffice-fixture", title: status === 403 ? "Forbidden" : "Request rejected", status, code: status === 409 ? "CATALOG_STATUS_CHANGE_INVALID" : status === 403 ? "FORBIDDEN" : "INVALID_PARAMETER", detail }, status);
function list(res, data, url) { const page = Number(url.searchParams.get("page") || 0), size = Number(url.searchParams.get("size") || 10); return json(res, { ...envelope(data.slice(page * size, (page + 1) * size)), page: { number: page, size, totalElements: data.length, totalPages: Math.ceil(data.length / size) } }); }
const bodyOf = (req) => typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
const findSku = (id) => products.flatMap((product) => product.skus).find((sku) => sku.id === id);
const validParcel = (parcel) => parcel !== null && typeof parcel === "object" &&
  [["weightGrams", 50000], ["lengthCm", 200], ["widthCm", 200], ["heightCm", 200]]
    .every(([field, max]) => Number.isInteger(parcel[field]) && parcel[field] >= 1 && parcel[field] <= max);
const withPrice = (product) => ({ ...product, minPrice: product.skus.length ? Math.min(...product.skus.map((sku) => sku.price)) : null, maxPrice: product.skus.length ? Math.max(...product.skus.map((sku) => sku.price)) : null });
const getCart = (id) => carts[id] ||= { id: randomUUID(), userId: id, status: "ACTIVE", items: [] };
async function session(req, res, url) {
  const upstream = await fetch(`${origin}/session${url.pathname}`, { method: req.method, headers: { "Content-Type": "application/json", Origin: req.headers.origin || "http://127.0.0.1:3110", "X-Requested-With": req.headers["x-requested-with"] || "", ...(req.headers.cookie ? { Cookie: req.headers.cookie } : {}) }, ...(req.method === "POST" ? { body: typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}) } : {}) });
  res.statusCode = upstream.status;
  for (const [name, value] of upstream.headers) if (!["content-length", "transfer-encoding", "content-encoding", "set-cookie"].includes(name)) res.setHeader(name, value);
  const cookies = upstream.headers.getSetCookie(); if (cookies.length) res.setHeader("Set-Cookie", cookies);
  res.end(Buffer.from(await upstream.arrayBuffer()));
}
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:3110"); res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Requested-With, Idempotency-Key"); res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return json(res, {});
  const url = new URL(req.url, origin), path = url.pathname;
  if (path === "/health") return json(res, { ready: true });
  if (path.startsWith("/v1/auth/")) return session(req, res, url);
  if (path === "/test/reset") { products = []; balances = {}; carts = {}; orders = []; groups = {}; evidence = []; rejectPublish = false; profileRole = null; return json(res, {}); }
  if (path === "/test/control") { const body = bodyOf(req); rejectPublish = body.rejectPublish ?? rejectPublish; profileRole = body.profileRole ?? null; return json(res, {}); }
  // Explicit test setup for a legacy persisted SKU that predates parcel metadata.
  if (path === "/test/legacy-product" && req.method === "POST") {
    const id = randomUUID(), skuId = randomUUID();
    const product = {
      id, sellerId: seller, name: "Legacy parcel product", slug: `demo-${id}`, categoryId: category,
      status: "DRAFT", description: "Legacy SKU needs real parcel measurements.", auctionEnable: false,
      images: [{ id: randomUUID(), imageUrl: `${origin}/api/test/image.svg`, sortOrder: 0 }],
      skus: [{ id: skuId, productId: id, skuCode: `SKU-${id.replaceAll("-", "")}-01`,
        color: "Black", size: "Standard", price: 150000, status: "ACTIVE", shippingParcel: null }],
    };
    products.push(product);
    return ok(res, withPrice(product), 201);
  }
  if (path === "/test/evidence") return json(res, { requests: evidence, products: products.map(withPrice), balances, orders, groups });
  if (path === "/test/payment-confirmed") { const { groupId } = bodyOf(req); const group = groups[groupId]; if (!group) return problem(res, 404, "No simulated order group"); group.status = "PAID"; group.orders.forEach((order) => { order.status = "PAID"; }); evidence.push({ method: "TEST", path, status: 200, environment: "simulation only; models undelivered payment consumer" }); return ok(res, group); }
  if (path === "/test/image.svg") { res.writeHead(200, { "Content-Type": "image/svg+xml" }); return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="orange"/></svg>'); }
  let claims = null;
  const token = /^Bearer (.+)$/.exec(req.headers.authorization || "")?.[1];
  if (token) { try { const hash = createHash("sha256").update(token).digest("hex"); const allowed = await pm.state.get("oidc-keycloak:access-tokens") || {}; if (allowed[hash]) claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url")); } catch {} }
  const roles = claims?.roles || [], has = (role) => roles.includes(role);
  const operation = { method: req.method, path: `/api${path}`, role: roles.join(","), query: Object.fromEntries(url.searchParams) };
  if (req.method === "POST" && /^\/v1\/products\/[^/]+\/skus$/.test(path) || req.method === "PUT" && /^\/v1\/skus\/[^/]+$/.test(path)) operation.body = bodyOf(req);
  evidence.push(operation);
  if (path === "/v1/users/me") { if (!claims) return problem(res, 401, "Sign in first"); const actualRole = roles.includes("SELLER") ? "Seller" : has("ADMIN") ? "Admin" : has("SUPPORT_STAFF") ? "Support" : "Buyer"; return ok(res, { id: claims.sub, email: `${actualRole.toLowerCase()}@nexus.local`, phone: "0901234567", fullName: `Demo ${actualRole}`, gender: "OTHER", address: "1 Demo Street", dateOfBirth: "2000-01-01", roles: profileRole || roles, status: "ACTIVE", createdAt: "2026-11-01T00:00:00Z" }); }
  if (path === "/v1/categories/tree") return list(res, [{ id: category, name: "Electronics", slug: "electronics", parentId: null, level: 1, children: [] }], url);
  if (path === "/v1/products/mine") { if (!has("SELLER")) return problem(res, 403, "Seller role required"); return list(res, products.filter((product) => product.sellerId === claims.sub).map(withPrice), url); }
  if (/^\/v1\/products\/mine\//.test(path)) { const product = products.find((item) => item.id === path.split("/").at(-1)); if (!has("SELLER") || product?.sellerId !== claims.sub) return problem(res, 403, "Product owner required"); return product ? ok(res, withPrice(product)) : problem(res, 404, "Product missing"); }
  if (path === "/v1/products" && req.method === "GET") return list(res, products.filter((product) => product.status === "ACTIVE").map(withPrice), url);
  if (path === "/v1/products" && req.method === "POST") { if (!has("SELLER")) return problem(res, 403, "Seller role required"); const body = bodyOf(req), id = randomUUID(); const product = { ...body, id, sellerId: claims.sub, slug: `demo-${id}`, status: "DRAFT", images: [], skus: [] }; products.push(product); return ok(res, withPrice(product), 201); }
  const productMatch = /^\/v1\/products\/([^/]+)(.*)$/.exec(path);
  if (productMatch) {
    const product = products.find((item) => item.id === productMatch[1]), suffix = productMatch[2]; if (!product) return problem(res, 404, "Product missing");
    if (req.method === "GET" && !suffix) return product.status === "ACTIVE" ? ok(res, withPrice(product)) : problem(res, 404, "Active products only");
    if (req.method === "GET" && suffix === "/skus") return list(res, product.skus, url);
    if (!has("SELLER") || product.sellerId !== claims.sub) return problem(res, 403, "Product owner required");
    if (req.method === "POST" && suffix === "/skus") {
      const body = bodyOf(req);
      if (body.shippingParcel != null && !validParcel(body.shippingParcel)) return problem(res, 400, "Invalid parcel measurements");
      const skuCode = `SKU-${product.id.replaceAll("-", "")}-${String(product.skus.length + 1).padStart(2, "0")}`;
      const sku = { color: body.color, size: body.size, price: body.price, shippingParcel: body.shippingParcel == null ? null : { ...body.shippingParcel }, skuCode, id: randomUUID(), productId: product.id, status: "ACTIVE" };
      product.skus.push(sku); return ok(res, sku, 201);
    }
    if (req.method === "POST" && suffix === "/images") { if (!String(req.headers["content-type"]).startsWith("multipart/form-data; boundary=")) return problem(res, 400, "Multipart boundary missing"); const image = { id: randomUUID(), imageUrl: `${origin}/api/test/image.svg`, sortOrder: product.images.length }; product.images.push(image); return ok(res, image, 201); }
    if (req.method === "PATCH" && suffix === "/status") { if (rejectPublish) return problem(res, 409, "Fixture: rejected status change"); product.status = bodyOf(req).status; return ok(res, withPrice(product)); }
    if (req.method === "PUT" && !suffix) { Object.assign(product, bodyOf(req)); return ok(res, withPrice(product)); }
    if (req.method === "DELETE" && suffix.startsWith("/images/")) { product.images = product.images.filter((image) => image.id !== suffix.split("/").at(-1)); return json(res, null, 204); }
  }
  if (/^\/v1\/skus\/[^/]+$/.test(path) && req.method === "PUT") {
    const sku = findSku(path.split("/").at(-1));
    if (!sku) return problem(res, 404, "SKU missing");
    if (!has("SELLER") || products.find((product) => product.id === sku.productId)?.sellerId !== claims.sub) return problem(res, 403, "Product owner required");
    const body = bodyOf(req);
    if (body.shippingParcel != null && !validParcel(body.shippingParcel)) return problem(res, 400, "Invalid parcel measurements");
    Object.assign(sku, { color: body.color, size: body.size, price: body.price });
    // Catalog preserves existing metadata when an older client omits/nulls the parcel.
    if (body.shippingParcel != null) sku.shippingParcel = { ...body.shippingParcel };
    return ok(res, sku);
  }
  if (path === "/v1/inventory/intake") { if (!has("ADMIN")) return problem(res, 403, "Admin role required"); const body = bodyOf(req); if (!findSku(body.skuId) || !Number.isInteger(body.quantity) || body.quantity < 1) return problem(res, 400, "Valid SKU and positive quantity required"); const balance = balances[body.skuId] ||= { skuId: body.skuId, warehouseId: warehouse, total: 0, available: 0, reserved: 0, unavailable: 0 }; balance.total += body.quantity; balance.available += body.quantity; return ok(res, balance, 201); }
  if (path === "/v1/inventory/balances") { if (!has("ADMIN") && !has("SELLER")) return problem(res, 403, "Stock role required"); return list(res, Object.values(balances).filter((balance) => !url.searchParams.has("skuId") || balance.skuId === url.searchParams.get("skuId")), url); }
  if (path === "/v1/inventory") return list(res, (url.searchParams.get("skuIds") || "").split(",").filter(Boolean).map((skuId) => ({ skuId, available: balances[skuId]?.available || 0 })), url);
  if (path.startsWith("/v1/inventory/")) { const skuId = path.split("/").at(-1); return ok(res, { skuId, available: balances[skuId]?.available || 0 }); }
  if (path.startsWith("/v1/notifications")) { if (!claims) return problem(res, 401, "Sign in first"); return path.endsWith("unread-count") ? ok(res, { count: 0 }) : list(res, [], url); }
  if (path.startsWith("/v1/carts/me")) { if (!has("BUYER")) return problem(res, 403, "Buyer cart required"); const cart = getCart(claims.sub); if (path.endsWith("/items") && req.method === "POST") { const body = bodyOf(req), sku = findSku(body.skuId); if (!sku) return problem(res, 404, "SKU missing"); cart.items.push({ id: randomUUID(), productId: sku.productId, skuId: sku.id, quantity: body.quantity, unitPrice: sku.price }); return ok(res, cart, 201); } return ok(res, cart); }
  if (path.startsWith("/v1/shipping/")) return list(res, [{ code: path.endsWith("provinces") ? "202" : "20308", name: path.endsWith("provinces") ? "Ho Chi Minh City" : "Ward 4" }], url);
  if (path === "/v1/checkout/preview") { const cart = getCart(claims.sub); const items = cart.items.map((item) => ({ itemId: item.id, productId: item.productId, skuId: item.skuId, quantity: item.quantity, unitPrice: item.unitPrice, lineTotal: item.unitPrice * item.quantity })); const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0); return ok(res, { items, subtotal, shippingFee: 10000, taxAmount: 0, discountAmount: 0, total: subtotal + 10000, issues: [] }); }
  if (path === "/v1/orders" && req.method === "POST") { if (!has("BUYER")) return problem(res, 403, "Buyer required"); const cart = getCart(claims.sub), address = bodyOf(req).shippingAddress; const id = randomUUID(), orderId = randomUUID(); const items = cart.items.map((item) => { const sku = findSku(item.skuId), product = products.find((p) => p.id === item.productId); return { orderItemId: randomUUID(), productId: product.id, skuId: sku.id, productName: product.name, skuCode: sku.skuCode, imageUrl: product.images[0]?.imageUrl || null, quantity: item.quantity, unitPrice: sku.price, totalPrice: sku.price * item.quantity }; }); const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 10000); const order = { orderId, orderNumber: "NX-BACKOFFICE-DEMO", userId: claims.sub, sellerId: seller, orderType: "STANDARD", status: "PENDING", createdAt: new Date().toISOString(), totalAmount, items, recipientName: address.recipientName, phoneNumber: address.phoneNumber, orderGroupId: id }; orders.push(order); groups[id] = { orderGroupId: id, status: "PENDING", totalAmount, currency: "VND", dueAt: new Date(Date.now() + 3600000).toISOString(), orders: [order] }; cart.items = []; return ok(res, groups[id], 201); }
  if (path === "/v1/orders/sales") { if (!has("SELLER")) return problem(res, 403, "Seller required"); return list(res, orders.filter((order) => order.sellerId === claims.sub && (!url.searchParams.has("status") || order.status === url.searchParams.get("status"))), url); }
  if (path.startsWith("/v1/orders/groups/")) return ok(res, groups[path.split("/").at(-1)]);
  if (path === "/v1/orders") return list(res, orders.filter((order) => order.userId === claims.sub), url);
  if (path === "/v1/payments") { const group = groups[bodyOf(req).orderGroupId]; return ok(res, { sessionId: randomUUID(), qrImageUrl: `${origin}/api/test/image.svg`, bankAccount: "SIMULATION ONLY", amount: group.totalAmount, memoCode: "SIMULATION", transferContent: "SIMULATION ONLY - no bank transfer", expiresAt: group.dueAt, serverNow: new Date().toISOString() }, 201); }
  return problem(res, 501, "Endpoint is not modelled by this back-office demo");
});
server.listen(process.env.PORT || 3920);
