/* Stateful HTTP dependencies for the real frontend's back-office demo.
 * The test-only payment callback models missing #156; it is never production code.
 */
const http = require("node:http");
const { randomUUID, createHash } = require("node:crypto");
const origin = `http://127.0.0.1:${process.env.NEXUS_TEST_PROVIDER_PORT || 3920}`;
const appOrigin = `http://127.0.0.1:${process.env.NEXUS_TEST_APP_PORT || 3110}`;
const seller = "68000000-0000-4000-8000-000000000002";
const category = "69000000-0000-4000-8000-000000000103";
const warehouse = "69000000-0000-4000-8000-000000000001";
let products = [], balances = {}, carts = {}, orders = [], groups = {}, evidence = [], rejectPublish = false, profileRole = null, auctions = [], auctionBids = {}, auctionCreatedAt = {}, orderedProducts = new Set();
const transitions = { DRAFT: ["ACTIVE"], ACTIVE: ["INACTIVE"], INACTIVE: ["ACTIVE"] };
const envelope = (data) => ({ code: 0, message: "response success", data });
function json(res, body, status = 200) { res.writeHead(status, { "Content-Type": status >= 400 ? "application/problem+json" : "application/json", "Cache-Control": "no-store" }); res.end(status === 204 ? undefined : JSON.stringify(body)); }
const ok = (res, data, status = 200) => json(res, envelope(data), status);
const problem = (res, status, detail, code = status === 409 ? "CATALOG_STATUS_CHANGE_INVALID" : status === 403 ? "FORBIDDEN" : "INVALID_PARAMETER") => json(res, { type: "urn:problem:backoffice-fixture", title: status === 403 ? "Forbidden" : "Request rejected", status, code, detail }, status);
function list(res, data, url) { const page = Number(url.searchParams.get("page") || 0), size = Number(url.searchParams.get("size") || 10); return json(res, { ...envelope(data.slice(page * size, (page + 1) * size)), page: { number: page, size, totalElements: data.length, totalPages: Math.ceil(data.length / size) } }); }
const bodyOf = (req) => typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
const findSku = (id) => products.flatMap((product) => product.skus).find((sku) => sku.id === id);
const duplicateVariant = (product, body, skuId = null) => product.skus.some((sku) => sku.id !== skuId && sku.color === body.color && sku.size === body.size);
const duplicateSku = (res) => problem(res, 409, "Duplicate SKU code or variant", "CATALOG_SKU_DUPLICATE");
const validParcel = (parcel) => parcel !== null && typeof parcel === "object" &&
  [["weightGrams", 50000], ["lengthCm", 200], ["widthCm", 200], ["heightCm", 200]]
    .every(([field, max]) => Number.isInteger(parcel[field]) && parcel[field] >= 1 && parcel[field] <= max);
const withPrice = (product) => ({ ...product, minPrice: product.skus.length ? Math.min(...product.skus.map((sku) => sku.price)) : null, maxPrice: product.skus.length ? Math.max(...product.skus.map((sku) => sku.price)) : null });
const publicSku = (sku) => Object.fromEntries(Object.entries(sku).filter(([key]) => key !== "costPrice"));
const publicProduct = (product) => withPrice({ ...product, skus: product.skus.map(publicSku) });
const getCart = (id) => carts[id] ||= { id: randomUUID(), userId: id, status: "ACTIVE", items: [] };
const fixtureOptions = { ok, problem, list, bodyOf, randomUUID, seller, origin, findProduct: (id) => products.find((product) => product.id === id), getOfferAuctionStatus: () => offerFixture.auctionStatus,
  getBankAccounts: () => sellerAccountsFixture.accounts, onVerified: (account) => payoutFixture.releaseHeld(account) };
const auctionFixture = require("./auctions.js").createAuctionFixture(fixtureOptions);
const offerFixture = require("./offers.js").createOfferFixture(fixtureOptions);
const sellerAccountsFixture = require("./sellerAccounts.js").createSellerAccountsFixture(fixtureOptions);
const payoutFixture = require("./payouts.js").createPayoutFixture(fixtureOptions);
const promotionsFixture = require("./promotions.js").createPromotionFixture(fixtureOptions);
const sellerFixtures = [promotionsFixture, auctionFixture, offerFixture, sellerAccountsFixture, payoutFixture];
const adminFixture = require("./admin.js").createAdminFixture(fixtureOptions);
const adminCatalogFixture = require("./adminCatalog.js").createAdminCatalogFixture(fixtureOptions);
const auctionStatuses = ["CREATED", "SCHEDULED", "ACTIVE", "ENDED", "WON", "SETTLED", "FAILED", "PAYMENT_TIMEOUT", "CANCELLED"];
const demoId = (prefix, n) => `${prefix}000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function resetAuctions() {
  const at = (hours) => new Date(Date.now() + hours * 3600000).toISOString();
  const rows = [...Array.from({ length: 12 }, (_, index) => [index + 1, "ACTIVE", -2, 2 + index]),
    [13, "SCHEDULED", 48, 72], [14, "CREATED", 96, 120], [15, "ENDED", -30, -6], [16, "SETTLED", -60, -36], [17, "PAYMENT_TIMEOUT", -90, -66], [18, "CANCELLED", -20, 4]];
  const titles = { 1: "Rolex Submariner Watch", 13: "Leica M6 film camera" };
  auctions = rows.map(([n, status, start, end]) => ({
    id: demoId("92", n), productId: demoId("93", n), skuId: demoId("94", n), sellerId: seller, title: titles[n] || `Demo auction ${n}`, imageUrl: null,
    startingPrice: 6000000, bidIncrement: 50000, currentPrice: 6000000, bidCount: 0, currency: "VND", startAt: at(start), endAt: at(end), originalEndAt: at(end), extensionCount: 0, status,
    cancelledBy: status === "CANCELLED" ? "SELLER" : null, cancelledReason: status === "CANCELLED" ? "Item no longer available" : null,
    cancelledActorId: status === "CANCELLED" ? seller : null, cancelledAt: status === "CANCELLED" ? at(-1) : null,
  }));
  auctionBids = { [demoId("92", 1)]: [[6100000, "a***n", -1.5], [6200000, "h***g", -1], [6300000, "m***h", -0.5]].map(([amount, bidderName, hours]) => ({ amount, bidderName, placedAt: at(hours) })) };
  Object.assign(auctions[0], { currentPrice: 6300000, bidCount: 3 });
  auctionCreatedAt = Object.fromEntries(auctions.map((auction, index) => [auction.id, at(-24 - index)]));
}
resetAuctions();
const auctionHistory = (id) => [...(auctionBids[id] || [])].sort((a, b) => b.amount - a.amount || Date.parse(b.placedAt) - Date.parse(a.placedAt));
const auctionState = (auction) => ({ auctionId: auction.id, currentPrice: auction.currentPrice, bidCount: auction.bidCount, bidIncrement: auction.bidIncrement, leaderBidderName: auctionHistory(auction.id)[0]?.bidderName ?? null, endAt: auction.endAt, status: auction.status, serverTime: new Date().toISOString() });
function managedAuctionRoute(req, res, url, id, suffix, claims, has) {
  if (!claims) return problem(res, 401, "Sign in first", "UNAUTHENTICATED");
  if (!has("ADMIN") && !has("SUPPORT_STAFF")) return problem(res, 403, "Admin or Support Staff role required", "FORBIDDEN");
  if (req.method !== "GET") return problem(res, 501, "Auction operation is not modelled by this back-office demo", "NOT_MODELLED");
  if (!id) {
    const status = url.searchParams.get("status");
    if (status !== null && !auctionStatuses.includes(status)) return problem(res, 400, "Invalid auction status", "INVALID_PARAMETER");
    return list(res, auctions.filter((auction) => status === null || auction.status === status)
      .sort((a, b) => Date.parse(auctionCreatedAt[b.id]) - Date.parse(auctionCreatedAt[a.id]) || b.id.localeCompare(a.id)), url);
  }
  const auction = auctions.find((item) => item.id === id);
  if (!auction) return problem(res, 404, "Auction not found", "AUCTION_NOT_FOUND");
  if (!suffix) return ok(res, auction);
  if (suffix === "/state") return ok(res, auctionState(auction));
  if (suffix === "/bids") return list(res, auctionHistory(id), url);
  return problem(res, 501, "Auction operation is not modelled by this back-office demo", "NOT_MODELLED");
}
function auctionRoute(req, res, url, id, suffix, claims, has) {
  if (!id && req.method === "GET") {
    const status = url.searchParams.get("status") || "ACTIVE";
    if (!auctionStatuses.includes(status)) return problem(res, 400, "Invalid auction status", "INVALID_PARAMETER");
    if (status === "CREATED" || status === "CANCELLED") return list(res, [], url);
    return list(res, auctions.filter((auction) => auction.status === status).sort((a, b) => Date.parse(a.endAt) - Date.parse(b.endAt) || a.id.localeCompare(b.id)), url);
  }
  if (req.method === "PUT" && !suffix) {
    if (!claims) return problem(res, 401, "Sign in first", "UNAUTHENTICATED");
    if (!has("ADMIN") && !has("SELLER")) return problem(res, 403, "Seller or Admin role required", "FORBIDDEN");
  }
  const auction = auctions.find((item) => item.id === id);
  if (!auction) return problem(res, 404, "Auction not found", "AUCTION_NOT_FOUND");
  if (req.method === "GET" && !suffix) return ok(res, auction);
  if (req.method === "GET" && suffix === "/state") return ok(res, auctionState(auction));
  if (req.method === "GET" && suffix === "/bids") return list(res, auctionHistory(id), url);
  if (!claims) return problem(res, 401, "Sign in first", "UNAUTHENTICATED");
  const body = bodyOf(req);
  if (req.method === "PUT" && !suffix) {
    if (![body.startingPrice, body.bidIncrement].every((value) => typeof value === "number" && value > 0) || ![body.startAt, body.endAt].every((value) => typeof value === "string" && Number.isFinite(Date.parse(value))))
      return problem(res, 400, "The request data is invalid", "VALIDATION_FAILED");
    if (!has("ADMIN") && auction.sellerId !== claims.sub) return problem(res, 403, "This actor cannot perform the auction action", "AUCTION_FORBIDDEN");
    if (!["CREATED", "SCHEDULED"].includes(auction.status) || Date.now() >= Date.parse(auction.startAt)) return problem(res, 409, "Only an auction that has not started can be configured", "AUCTION_NOT_EDITABLE");
    if (auction.bidCount > 0) return problem(res, 409, "The auction has valid bids", "AUCTION_HAS_BIDS");
    const duration = Date.parse(body.endAt) - Date.parse(body.startAt);
    if (Date.parse(body.startAt) < Date.now() - 5000) return problem(res, 400, "startAt must not be in the past (5 seconds of clock skew allowed)", "AUCTION_START_IN_PAST");
    if (duration <= 0) return problem(res, 400, "endAt must be after startAt", "AUCTION_INVALID_TIME_WINDOW");
    if (duration < 60 * 60000) return problem(res, 400, "Auction duration must be at least 60 minutes", "AUCTION_DURATION_TOO_SHORT");
    if (duration > 168 * 3600000) return problem(res, 400, "Auction duration must be at most 168 hours", "AUCTION_DURATION_TOO_LONG");
    const endAt = new Date(body.endAt).toISOString();
    Object.assign(auction, { startingPrice: body.startingPrice, currentPrice: body.startingPrice, bidIncrement: body.bidIncrement, startAt: new Date(body.startAt).toISOString(), endAt, originalEndAt: endAt });
    return ok(res, auction);
  }
  if (req.method === "POST" && suffix === "/admin-cancel") {
    if (!has("ADMIN")) return problem(res, 403, "Admin role required", "FORBIDDEN");
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!reason || [...reason].length > 255) return problem(res, 400, "The request data is invalid", "VALIDATION_FAILED");
    if (!["CREATED", "SCHEDULED", "ACTIVE", "ENDED", "WON"].includes(auction.status)) return problem(res, 409, "The auction cannot move to this status from its current status", "AUCTION_ILLEGAL_TRANSITION");
    Object.assign(auction, { status: "CANCELLED", cancelledBy: "ADMIN", cancelledReason: reason, cancelledActorId: claims.sub, cancelledAt: new Date().toISOString() });
    return ok(res, auction);
  }
  return problem(res, 501, "Auction operation is not modelled by this back-office demo", "NOT_MODELLED");
}
async function session(req, res, url) {
  const upstream = await fetch(`${origin}/session${url.pathname}`, { method: req.method, headers: { "Content-Type": "application/json", Origin: req.headers.origin || appOrigin, "X-Requested-With": req.headers["x-requested-with"] || "", ...(req.headers.cookie ? { Cookie: req.headers.cookie } : {}) }, ...(req.method === "POST" ? { body: typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}) } : {}) });
  res.statusCode = upstream.status;
  for (const [name, value] of upstream.headers) if (!["content-length", "transfer-encoding", "content-encoding", "set-cookie"].includes(name)) res.setHeader(name, value);
  const cookies = upstream.headers.getSetCookie(); if (cookies.length) res.setHeader("Set-Cookie", cookies);
  res.end(Buffer.from(await upstream.arrayBuffer()));
}
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", appOrigin); res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Requested-With, Idempotency-Key"); res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return json(res, {});
  const url = new URL(req.url, origin), path = url.pathname;
  if (path === "/health") return json(res, { ready: true });
  if (path.startsWith("/v1/auth/")) return session(req, res, url);
  if (path === "/test/reset") { products = []; balances = {}; carts = {}; orders = []; groups = {}; evidence = []; rejectPublish = false; profileRole = null; orderedProducts = new Set(); resetAuctions(); sellerFixtures.forEach((fixture) => fixture.reset()); adminFixture.reset(); return json(res, {}); }
  if (path === "/test/seller-seed" && req.method === "POST") {
    const id = "a2250000-0000-4000-8000-000000000001", skuId = "a2250000-0000-4000-8000-000000000002";
    products = [{ id, sellerId: seller, name: "Studio Wireless Headphones", slug: `demo-${id}`, categoryId: category, status: "ACTIVE", description: "Seller operations fixture", auctionEnable: true,
      images: [{ id: "a2250000-0000-4000-8000-000000000003", imageUrl: `${origin}/api/test/image.svg`, sortOrder: 0 }],
      skus: [{ id: skuId, productId: id, skuCode: "STUDIO-SILVER", color: "Silver", size: "Standard", price: 4800000, status: "ACTIVE", shippingParcel: { weightGrams: 1000, lengthCm: 20, widthCm: 20, heightCm: 10 } }] }];
    balances[skuId] = { skuId, warehouseId: warehouse, total: 20, available: 20, reserved: 0, unavailable: 0 };
    orders = (bodyOf(req).withoutOrders ? [] : ["PAID", "COMPLETED"]).map((status, index) => ({ orderId: `a2250000-0000-4000-8000-00000000001${index}`, orderNumber: `NX-SELLER-${index + 1}`, userId: "68000000-0000-4000-8000-000000000003", sellerId: seller, orderType: "STANDARD", status,
      createdAt: index ? "2026-10-01T00:00:00Z" : "2026-11-14T03:00:00Z", totalAmount: 4800000, recipientName: "Nguyen Thi Lan", phoneNumber: "0901234567",
      items: [{ orderItemId: randomUUID(), productId: id, skuId, productName: "Studio Wireless Headphones", skuCode: "STUDIO-SILVER", imageUrl: null, quantity: 1, unitPrice: 4800000, totalPrice: 4800000 }] }));
    sellerFixtures.forEach((fixture) => fixture.reset());
    return ok(res, { productId: id, skuId });
  }
  if (path === "/test/auction" && req.method === "POST") { const { id, ...changes } = bodyOf(req); const auction = auctions.find((item) => item.id === id); if (!auction) return problem(res, 404, "No simulated auction"); Object.assign(auction, changes); return ok(res, auction); }
  if (path === "/test/control") { const body = bodyOf(req); rejectPublish = body.rejectPublish ?? rejectPublish; profileRole = body.profileRole ?? null; if (body.orderedProductId) orderedProducts.add(body.orderedProductId); if (body.productStatus) products.find((product) => product.id === body.productStatus.id).status = body.productStatus.status; return json(res, {}); }
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
  if (path === "/test/evidence") return json(res, { requests: evidence, products: products.map(withPrice), balances, orders, groups, auctions });
  if (path === "/test/payment-confirmed") { const { groupId } = bodyOf(req); const group = groups[groupId]; if (!group) return problem(res, 404, "No simulated order group"); group.status = "PAID"; group.orders.forEach((order) => { order.status = "PAID"; }); evidence.push({ method: "TEST", path, status: 200, environment: "simulation only; models undelivered payment consumer" }); return ok(res, group); }
  if (path === "/test/image.svg") { res.writeHead(200, { "Content-Type": "image/svg+xml" }); return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="orange"/></svg>'); }
  let claims = null;
  const token = /^Bearer (.+)$/.exec(req.headers.authorization || "")?.[1];
  if (token) { try { const hash = createHash("sha256").update(token).digest("hex"); const allowed = await pm.state.get("oidc-keycloak:access-tokens") || {}; if (allowed[hash]) claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url")); } catch {} }
  const roles = claims?.roles || [], has = (role) => roles.includes(role);
  if (adminCatalogFixture.handle(req, res, url, claims)) return;
  if (adminFixture.handle(req, res, url, claims)) return;
  const operation = { method: req.method, path: `/api${path}`, role: roles.join(","), query: Object.fromEntries(url.searchParams) };
  if (req.method === "POST" && /^\/v1\/products\/[^/]+\/skus$/.test(path) || req.method === "PUT" && /^\/v1\/(?:skus\/[^/]+|products\/[^/]+(?:\/images\/order)?)$/.test(path) || req.method === "POST" && path === "/v1/inventory/intake" || req.method === "PUT" && /^\/v1\/auctions\/[^/]+$/.test(path) || req.method === "POST" && /^\/v1\/auctions\/[^/]+\/admin-cancel$/.test(path)) operation.body = bodyOf(req);
  if ((path.startsWith("/v1/vouchers") || path.startsWith("/v1/promotions")) && req.method !== "GET") operation.body = bodyOf(req);
  evidence.push(operation);
  if (promotionsFixture.handle(req, res, url, claims)) return;
  // Management reads and upstream demo IDs must not enter the seller-only route handler.
  const managedMatch = /^\/v1\/auctions\/manage(?:\/([^/]+))?(\/state|\/bids)?$/.exec(path);
  if (managedMatch) return managedAuctionRoute(req, res, url, managedMatch[1], managedMatch[2] || "", claims, has);
  const upstreamAuction = /^\/v1\/auctions\/([^/]+)(\/state|\/bids|\/admin-cancel)?$/.exec(path);
  if (upstreamAuction && auctions.some((auction) => auction.id === upstreamAuction[1]))
    return auctionRoute(req, res, url, upstreamAuction[1], upstreamAuction[2] || "", claims, has);
  for (const fixture of sellerFixtures) if (fixture.handle(req, res, url, claims)) return;
  if (path === "/v1/users/me") { if (!claims) return problem(res, 401, "Sign in first"); const actualRole = roles.includes("SELLER") ? "Seller" : has("ADMIN") ? "Admin" : has("SUPPORT_STAFF") ? "Support" : "Buyer"; return ok(res, { id: claims.sub, email: `${actualRole.toLowerCase()}@nexus.local`, phone: "0901234567", fullName: `Demo ${actualRole}`, gender: "OTHER", address: "1 Demo Street", dateOfBirth: "2000-01-01", roles: profileRole || roles, status: "ACTIVE", createdAt: "2026-11-01T00:00:00Z" }); }
  if (path === "/v1/categories/tree") return list(res, [{ id: category, name: "Electronics", slug: "electronics", parentId: null, level: 1, children: [] }], url);
  if (path === "/v1/products/mine") { if (!has("SELLER")) return problem(res, 403, "Seller role required"); const status = url.searchParams.get("status"); if (status !== null && !["DRAFT", "INACTIVE", "ACTIVE"].includes(status)) return problem(res, 400, "A valid value is required", "INVALID_PARAMETER"); return list(res, products.filter((product) => product.sellerId === claims.sub && (status === null || product.status === status)).map(withPrice), url); }
  if (/^\/v1\/products\/mine\//.test(path)) { const product = products.find((item) => item.id === path.split("/").at(-1)); if (!has("SELLER") || product?.sellerId !== claims.sub) return problem(res, 403, "Product owner required"); return product ? ok(res, withPrice(product)) : problem(res, 404, "Product missing"); }
  if (path === "/v1/products" && req.method === "GET") return list(res, products.filter((product) => product.status === "ACTIVE").map(publicProduct), url);
  if (path === "/v1/products" && req.method === "POST") { if (!has("SELLER")) return problem(res, 403, "Seller role required"); const body = bodyOf(req), id = randomUUID(); const product = { ...body, id, sellerId: claims.sub, slug: `demo-${id}`, status: "DRAFT", images: [], skus: [] }; products.push(product); return ok(res, withPrice(product), 201); }
  const productMatch = /^\/v1\/products\/([^/]+)(.*)$/.exec(path);
  if (productMatch) {
    const product = products.find((item) => item.id === productMatch[1]), suffix = productMatch[2]; if (!product) return problem(res, 404, "Product missing");
    if (req.method === "GET" && !suffix) return product.status === "ACTIVE" ? ok(res, publicProduct(product)) : problem(res, 404, "Active products only");
    if (req.method === "GET" && suffix === "/skus") return list(res, product.skus.map(publicSku), url);
    if (!has("SELLER") || product.sellerId !== claims.sub) return problem(res, 403, "Product owner required");
    if (req.method === "POST" && suffix === "/skus") {
      const body = bodyOf(req);
      if (body.shippingParcel != null && !validParcel(body.shippingParcel)) return problem(res, 400, "Invalid parcel measurements");
      if (duplicateVariant(product, body)) return duplicateSku(res);
      const skuCode = `SKU-${product.id.replaceAll("-", "")}-${String(product.skus.length + 1).padStart(2, "0")}`;
      const sku = { color: body.color, size: body.size, price: body.price, ...(body.costPrice == null ? {} : { costPrice: body.costPrice }), shippingParcel: body.shippingParcel == null ? null : { ...body.shippingParcel }, skuCode, id: randomUUID(), productId: product.id, status: "ACTIVE" };
      product.skus.push(sku); return ok(res, sku, 201);
    }
    if (req.method === "POST" && suffix === "/images") { if (!String(req.headers["content-type"]).startsWith("multipart/form-data; boundary=")) return problem(res, 400, "Multipart boundary missing"); const imageId = randomUUID(); const image = { id: imageId, imageUrl: `${origin}/api/test/image.svg?image=${imageId}`, sortOrder: product.images.length }; product.images.push(image); return ok(res, image, 201); }
    if (req.method === "PATCH" && suffix === "/status") { if (rejectPublish) return problem(res, 409, "Fixture: rejected status change"); const target = bodyOf(req).status; if (!transitions[product.status]?.includes(target)) return problem(res, 400, "Product status transition is not allowed", "CATALOG_INVALID_PRODUCT_STATUS_TRANSITION"); product.status = target; return ok(res, withPrice(product)); }
    if (req.method === "PUT" && !suffix) { Object.assign(product, bodyOf(req)); return ok(res, withPrice(product)); }
    if (req.method === "DELETE" && !suffix) { if (orderedProducts.has(product.id) || orders.some((order) => order.items.some((item) => item.productId === product.id))) return problem(res, 409, "Cannot delete a product that has orders", "CATALOG_PRODUCT_HAS_ORDERS"); products = products.filter((item) => item.id !== product.id); return json(res, null, 204); }
    if (req.method === "PUT" && suffix === "/images/order") {
      const ids = bodyOf(req).imageIds;
      if (!Array.isArray(ids) || ids.length !== product.images.length || new Set(ids).size !== ids.length || ids.some((id) => !product.images.some((image) => image.id === id))) return problem(res, 400, "imageIds must contain exactly the product's image IDs without duplicates", "CATALOG_IMAGE_ORDER_INVALID");
      product.images = ids.map((id, sortOrder) => ({ ...product.images.find((image) => image.id === id), sortOrder }));
      return json(res, { ...envelope(product.images), page: { number: 0, size: product.images.length, totalElements: product.images.length, totalPages: 1 } });
    }
    if (req.method === "DELETE" && suffix.startsWith("/images/")) { product.images = product.images.filter((image) => image.id !== suffix.split("/").at(-1)); return json(res, null, 204); }
  }
  if (/^\/v1\/skus\/[^/]+$/.test(path) && req.method === "PUT") {
    const sku = findSku(path.split("/").at(-1));
    if (!sku) return problem(res, 404, "SKU missing");
    if (!has("SELLER") || products.find((product) => product.id === sku.productId)?.sellerId !== claims.sub) return problem(res, 403, "Product owner required");
    const body = bodyOf(req);
    if (body.shippingParcel != null && !validParcel(body.shippingParcel)) return problem(res, 400, "Invalid parcel measurements");
    if (duplicateVariant(products.find((product) => product.id === sku.productId), body, sku.id)) return duplicateSku(res);
    Object.assign(sku, { color: body.color, size: body.size, price: body.price });
    if (body.costPrice != null) sku.costPrice = body.costPrice;
    // Catalog preserves existing metadata when an older client omits/nulls the parcel.
    if (body.shippingParcel != null) sku.shippingParcel = { ...body.shippingParcel };
    return ok(res, sku);
  }
  if (path === "/v1/inventory/intake") { const body = bodyOf(req); const owner = products.find((product) => product.skus.some((sku) => sku.id === body.skuId))?.sellerId; if (!has("ADMIN") && !(has("SELLER") && owner === claims.sub && body.warehouseId == null)) return problem(res, 403, "Admin or owning Seller required"); if (!findSku(body.skuId) || !Number.isInteger(body.quantity) || body.quantity < 1) return problem(res, 400, "Valid SKU and positive quantity required"); const balance = balances[body.skuId] ||= { skuId: body.skuId, warehouseId: warehouse, total: 0, available: 0, reserved: 0, unavailable: 0 }; balance.total += body.quantity; balance.available += body.quantity; return ok(res, balance, 201); }
  if (path === "/v1/inventory/balances") { if (!has("ADMIN") && !has("SELLER")) return problem(res, 403, "Stock role required"); return list(res, Object.values(balances).filter((balance) => !url.searchParams.has("skuId") || balance.skuId === url.searchParams.get("skuId")), url); }
  if (path === "/v1/inventory") return list(res, (url.searchParams.get("skuIds") || "").split(",").filter(Boolean).map((skuId) => ({ skuId, available: balances[skuId]?.available || 0 })), url);
  if (path.startsWith("/v1/inventory/")) { const skuId = path.split("/").at(-1); return ok(res, { skuId, available: balances[skuId]?.available || 0 }); }
  const auctionMatch = /^\/v1\/auctions(?:\/([^/]+))?(\/state|\/bids|\/admin-cancel)?$/.exec(path);
  if (auctionMatch) return auctionRoute(req, res, url, auctionMatch[1], auctionMatch[2] || "", claims, has);
  if (path.startsWith("/v1/notifications")) { if (!claims) return problem(res, 401, "Sign in first"); return path.endsWith("unread-count") ? ok(res, { count: 0 }) : list(res, [], url); }
  if (path.startsWith("/v1/carts/me") && path !== "/v1/carts/me/pricing") { if (!has("BUYER")) return problem(res, 403, "Buyer cart required"); const cart = getCart(claims.sub); if (path.endsWith("/items") && req.method === "POST") { const body = bodyOf(req), sku = findSku(body.skuId); if (!sku) return problem(res, 404, "SKU missing"); cart.items.push({ id: randomUUID(), productId: sku.productId, skuId: sku.id, quantity: body.quantity, unitPrice: sku.price }); return ok(res, cart, 201); } return ok(res, cart); }
  if (path.startsWith("/v1/shipping/")) return list(res, [{ code: path.endsWith("provinces") ? "202" : "20308", name: path.endsWith("provinces") ? "Ho Chi Minh City" : "Ward 4" }], url);
  if (path === "/v1/carts/me/pricing") { const subtotal = getCart(claims.sub).items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0); const result = promotionsFixture.quote(claims.sub, subtotal, url.searchParams.getAll("voucherCodes").filter(Boolean)); return ok(res, { subtotal, estimatedShippingFee: null, taxAmount: 0, ...result, total: subtotal - result.discountAmount }); }
  if (path === "/v1/checkout/preview") { const cart = getCart(claims.sub); const items = cart.items.map((item) => ({ itemId: item.id, productId: item.productId, skuId: item.skuId, quantity: item.quantity, unitPrice: item.unitPrice, lineTotal: item.unitPrice * item.quantity })); const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0); const result = promotionsFixture.quote(claims.sub, subtotal, bodyOf(req).voucherCodes); return ok(res, { items, subtotal, shippingFee: 10000, taxAmount: 0, ...result, total: subtotal + 10000 - result.discountAmount, issues: [] }); }
  if (path === "/v1/orders" && req.method === "POST") { if (!has("BUYER")) return problem(res, 403, "Buyer required"); const cart = getCart(claims.sub), address = bodyOf(req).shippingAddress; const id = randomUUID(), orderId = randomUUID(); const items = cart.items.map((item) => { const sku = findSku(item.skuId), product = products.find((p) => p.id === item.productId); return { orderItemId: randomUUID(), productId: product.id, skuId: sku.id, productName: product.name, skuCode: sku.skuCode, imageUrl: product.images[0]?.imageUrl || null, quantity: item.quantity, unitPrice: sku.price, totalPrice: sku.price * item.quantity }; }); const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 10000); const order = { orderId, orderNumber: "NX-BACKOFFICE-DEMO", userId: claims.sub, sellerId: seller, orderType: "STANDARD", status: "PENDING", createdAt: new Date().toISOString(), totalAmount, items, recipientName: address.recipientName, phoneNumber: address.phoneNumber, orderGroupId: id }; promotionsFixture.apply(order, bodyOf(req).voucherCodes, claims.sub); orders.push(order); groups[id] = { orderGroupId: id, status: "PENDING", totalAmount: order.totalAmount, currency: "VND", dueAt: new Date(Date.now() + 3600000).toISOString(), orders: [order] }; cart.items = []; return ok(res, groups[id], 201); }
  if (path === "/v1/orders/sales") { if (!has("SELLER")) return problem(res, 403, "Seller required"); return list(res, orders.filter((order) => order.sellerId === claims.sub && (!url.searchParams.has("status") || order.status === url.searchParams.get("status")) && (!url.searchParams.has("from") || Date.parse(order.createdAt) >= Date.parse(url.searchParams.get("from"))) && (!url.searchParams.has("to") || Date.parse(order.createdAt) <= Date.parse(url.searchParams.get("to")))), url); }
  if (path.startsWith("/v1/orders/groups/")) return ok(res, groups[path.split("/").at(-1)]);
  if (/^\/v1\/orders\/[^/]+$/.test(path) && req.method === "GET") { const row = orders.find((o) => o.orderId === path.split("/").at(-1) && o.userId === claims.sub); return row ? ok(res, { ...row, canCancel: true }) : problem(res, 404, "Order missing"); }
  if (path === "/v1/orders") return list(res, orders.filter((order) => order.userId === claims.sub), url);
  if (path === "/v1/payments") { const group = groups[bodyOf(req).orderGroupId]; return ok(res, { sessionId: randomUUID(), qrImageUrl: `${origin}/api/test/image.svg`, bankAccount: "SIMULATION ONLY", amount: group.totalAmount, memoCode: "SIMULATION", transferContent: "SIMULATION ONLY - no bank transfer", expiresAt: group.dueAt, serverNow: new Date().toISOString() }, 201); }
  return problem(res, 501, "Endpoint is not modelled by this back-office demo");
});
server.listen(process.env.PORT || 3920);
