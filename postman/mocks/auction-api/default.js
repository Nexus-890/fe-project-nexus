/* Test-only HTTP dependencies. State/history follow the #168/#169 draft;
 * SSE names are provisional until the backend #253 contract is delivered. */
const http = require("node:http");
const { createHash, randomUUID } = require("node:crypto");
const origin = "http://127.0.0.1:3928";
const appOrigin = "http://127.0.0.1:3118";
const auctionId = "00000051-1111-4111-8111-111111111111";
const productId = "00000002-1111-4111-8111-111111111111";
const skuId = "00000003-1111-4111-8111-111111111111";
const buyerId = "68000000-0000-4000-8000-000000000003";
const sellerId = "00000061-1111-4111-8111-111111111111";
const orderId = "00000081-1111-4111-8111-111111111111";
const title = "Rolex Submariner Watch — Two-Tone, Box & Papers";
const imageUrl = `${origin}/api/test/watch.svg`;
const page = (number, size, totalElements) => ({ number, size, totalElements, totalPages: Math.ceil(totalElements / size) });
const success = (data, metadata) => ({ code: 0, message: "response success", data, ...(metadata ? { page: metadata } : {}) });
const streams = new Set();
const initialEvidence = () => ({ requests: [], bidRequests: [], bidWrites: 0, sseConnections: 0, sseEvents: 0, offerRequests: [], offerOrders: 0 });
let evidence = initialEvidence();
let mode = "normal";
let detail;
let bids;
let frozenBids = null;
let own;
let attempts = {};
let listMode = false;
let listings = [];
let mineRows = [];
let offers = [];
const offerId = "00000091-1111-4111-8111-111111111111";
const listId = (index) => `000000${String(51 + index).padStart(2, "0")}-1111-4111-8111-111111111111`;
function seedLists() {
  const names = [title, "Rolex Datejust 36mm, Jubilee Bracelet", "Nike Air Jordan 1 Red And Black, US 10", "Annibale Colombo Sofa — Italian Leather", "Kawasaki Z800 (2019), 8,200 km", "Apple Watch Series 4 Gold, 40mm", "Longines Master Collection, Automatic", "Annibale Colombo Bed — Queen, Walnut", "Vintage camera", "Classic turntable", "Scheduled Omega watch", "Scheduled leather briefcase", "Won collector watch", "Lost collector watch"];
  listings = names.map((name, index) => ({
    ...detail, id: listId(index), title: name, imageUrl: `${imageUrl}?item=${index}`,
    startingPrice: index === 0 ? 6000 : 100, currentPrice: [9850, 8420, 212, 1640, 6150, 186, 1050, 1210][index] ?? 500,
    bidCount: index >= 10 && index < 12 ? 0 : 12 + index,
    startAt: new Date(Date.now() + (index >= 10 && index < 12 ? 3600000 : -3600000)).toISOString(),
    endAt: new Date(Date.now() + (index >= 12 ? -60000 : 252000 + index * 3600000)).toISOString(),
    status: index < 10 ? "ACTIVE" : index < 12 ? "SCHEDULED" : "WON",
    orderId: index === 12 ? orderId : null,
    paymentDueAt: index === 12 ? new Date(Date.now() + 86400000).toISOString() : null,
  }));
  mineRows = listings.filter((row) => row.status !== "SCHEDULED").map((row, index) => ({
    auctionId: row.id, title: row.title, amount: row.currentPrice - (index % 2 ? 120 : 0),
    placedAt: new Date(Date.now() - 60000 * index).toISOString(), auctionStatus: row.status,
    leading: row.status === "ACTIVE" && index % 2 === 0, won: row.id === listId(12),
  }));
}
function createSellerOffer() {
  if (offers.length) return;
  // Only explicit test seller action creates a row. A timeout by itself creates no offer.
  offers = [{ id: offerId, auctionId, title, imageUrl, currency: "VND", amount: 4800000,
    status: "OFFERED", offeredAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString(),
    orderId: null, paymentDueAt: null }];
}
function reset() {
  const now = Date.now();
  detail = {
    id: auctionId, productId, skuId, sellerId, title, imageUrl,
    startingPrice: 6000, bidIncrement: 50, currentPrice: 9850, bidCount: 18, currency: "USD",
    startAt: new Date(now - 3600000).toISOString(), endAt: new Date(now + 252000).toISOString(),
    originalEndAt: new Date(now - 348000).toISOString(), extensionCount: 2, status: "ACTIVE",
    finalPrice: null, paymentDueAt: null, orderId: null, cancelledBy: null, cancelledReason: null,
  };
  bids = [9850, 9800, 9700, 9500, 9300, 9000].map((amount, index) => ({
    amount, bidderName: ["j***n", "m***h", "j***n", "t***a", "m***h", "k***2"][index],
    placedAt: new Date(now - [12000, 41000, 120000, 360000, 840000, 3600000][index]).toISOString(),
  }));
  own = { auctionId, title, amount: 9850, placedAt: bids[0].placedAt, auctionStatus: "ACTIVE", leading: true, won: false };
  attempts = {};
  frozenBids = null;
  listMode = false;
  listings = [];
  mineRows = [];
  offers = [];
}
reset();
function state() {
  return {
    auctionId, currentPrice: detail.currentPrice, bidCount: detail.bidCount, bidIncrement: detail.bidIncrement,
    leaderBidderName: bids[0]?.bidderName ?? null, endAt: detail.endAt,
    status: detail.status, serverTime: new Date().toISOString(),
  };
}
function json(res, body, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(status === 204 ? undefined : JSON.stringify(body));
}
function problem(res, status, code, message, extensions = {}) {
  res.writeHead(status, { "Content-Type": "application/problem+json", "Cache-Control": "no-store" });
  res.end(JSON.stringify({ type: "urn:problem:domain-error", title: message, status, code, detail: message, ...extensions }));
}
async function validBearer(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  if (!token) return false;
  const tokens = await pm.state.get("oidc-keycloak:access-tokens") || {};
  return Boolean(tokens[createHash("sha256").update(token).digest("hex")]);
}
function publish() {
  const payload = `id: ${detail.bidCount}\nevent: auction-state\ndata: ${JSON.stringify(state())}\n\n`;
  for (const response of streams) {
    if (!response.destroyed) { response.write(payload); evidence.sseEvents += 1; }
  }
}
const watch = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="480" viewBox="0 0 600 480"><rect width="600" height="480" fill="black"/><defs><linearGradient id="s"><stop stop-color="#555"/><stop offset=".4" stop-color="#c6c8c6"/><stop offset=".6" stop-color="#777"/><stop offset="1" stop-color="#444"/></linearGradient><linearGradient id="g"><stop stop-color="#6e603c"/><stop offset=".5" stop-color="#d7c78c"/><stop offset="1" stop-color="#78683f"/></linearGradient></defs><rect x="249" y="38" width="102" height="404" rx="19" fill="url(#s)"/><rect x="277" y="38" width="46" height="404" rx="7" fill="url(#g)"/><g stroke="#323232" stroke-width="4">${Array.from({ length: 17 }, (_, i) => `<path d="M251 ${48 + i * 23}h98"/>`).join("")}</g><circle cx="300" cy="240" r="113" fill="url(#s)"/><circle cx="300" cy="240" r="102" fill="#262721" stroke="#b5a879" stroke-width="5"/><circle cx="300" cy="240" r="85" fill="#171916" stroke="#c0bda7" stroke-width="2"/><g fill="#f3f0d8">${Array.from({ length: 12 }, (_, i) => `<circle cx="${300 + Math.sin(i * Math.PI / 6) * 71}" cy="${240 - Math.cos(i * Math.PI / 6) * 71}" r="${i % 3 === 0 ? 5 : 7}"/>`).join("")}</g><g stroke="#dcd8bd" stroke-width="5" stroke-linecap="round"><path d="M300 240l-29-39M300 240l46-7"/></g><circle cx="300" cy="240" r="6" fill="#cec4a1"/><text x="300" y="208" fill="#d6d4c0" font-family="serif" text-anchor="middle" font-size="12">ROLEX</text><text x="300" y="270" fill="#d6d4c0" font-family="sans-serif" text-anchor="middle" font-size="8">SUBMARINER</text><rect x="341" y="231" width="25" height="18" fill="#e0decc"/><text x="354" y="244" fill="#252823" font-size="13" text-anchor="middle">28</text><rect x="412" y="226" width="9" height="28" rx="3" fill="url(#g)"/></svg>`;
http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", appOrigin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key, X-Requested-With, Last-Event-ID");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return json(res, {}, 204);
  const url = new URL(req.url, origin);
  const path = url.pathname;
  if (path === "/health") return json(res, { ready: true });
  if (path === "/test/reset") {
    mode = url.searchParams.get("mode") || "normal";
    streams.forEach((stream) => stream.end()); streams.clear();
    evidence = initialEvidence();
    reset();
    await pm.state.set("auction-api:attempts", {});
    return json(res, {});
  }
  if (path === "/test/evidence") return json(res, evidence);
  if (path === "/test/control") {
    const changes = typeof req.body === "object" && req.body ? req.body : {};
    if (changes.mode) mode = changes.mode;
    if (changes.listMode === true) { listMode = true; seedLists(); }
    if (changes.sellerOffers === true) createSellerOffer();
    if (typeof changes.offerRemainingMs === "number" && offers[0]) {
      offers[0].expiresAt = new Date(Date.now() + changes.offerRemainingMs).toISOString();
      offers[0].offeredAt = new Date(Date.parse(offers[0].expiresAt) - 86400000).toISOString();
    }
    if (changes.offerStatus && offers[0]) offers[0].status = changes.offerStatus;
    if (changes.disconnect) { streams.forEach((stream) => stream.end()); streams.clear(); }
    if (changes.freezeHistory === true) frozenBids = structuredClone(bids);
    if (changes.freezeHistory === false) frozenBids = null;
    if (typeof changes.price === "number") {
      detail.currentPrice = changes.price; detail.bidCount += 1;
      bids.unshift({ amount: changes.price, bidderName: "m***h", placedAt: new Date().toISOString() });
      own.leading = false;
    }
    if (typeof changes.remainingMs === "number") detail.endAt = new Date(Date.now() + changes.remainingMs).toISOString();
    if (changes.extend) {
      detail.endAt = new Date(Date.parse(detail.endAt) + 300000).toISOString(); detail.extensionCount += 1;
    }
    if (changes.status) {
      detail.status = changes.status;
      own.auctionStatus = changes.status;
      if (changes.status === "WON") {
        own.won = true; detail.finalPrice = detail.currentPrice;
        detail.paymentDueAt = new Date(Date.now() + 86400000).toISOString(); detail.orderId = orderId;
      }
    }
    if (changes.publish) publish();
    if (Number.isInteger(changes.publishCount)) {
      for (let index = 0; index < Math.min(100, changes.publishCount); index += 1) publish();
    }
    return json(res, success(detail));
  }
  if (path === "/test/watch.svg") { res.writeHead(200, { "Content-Type": "image/svg+xml" }); return res.end(watch); }
  if (path.startsWith("/v1/auth/")) {
    const response = await fetch(`${origin}/session${path}`, {
      method: req.method,
      headers: Object.fromEntries(["content-type", "origin", "cookie", "x-requested-with"].filter((name) => req.headers[name]).map((name) => [name, req.headers[name]])),
      ...(req.method === "POST" ? { body: typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}) } : {}),
    });
    for (const cookie of response.headers.getSetCookie()) res.appendHeader("Set-Cookie", cookie);
    res.writeHead(response.status, { "Content-Type": response.headers.get("Content-Type") || "application/json", "Cache-Control": "no-store" });
    return res.end(await response.text());
  }
  const authenticated = await validBearer(req);
  evidence.requests.push({ method: req.method, path, query: url.search, authorized: authenticated, bearer: Boolean(req.headers.authorization), at: Date.now() });
  if (path === "/v1/categories/tree") return json(res, success([]));
  if (["/v1/notifications", "/v1/notifications/unread-count"].includes(path)) return json(res, path.endsWith("unread-count") ? success({ count: 0 }) : success([], page(0, 10, 0)));
  if (path === "/v1/carts/me") return json(res, success({ id: "auction-cart", userId: buyerId, status: "ACTIVE", items: [] }));
  if (path === "/v1/users/me") return json(res, success({ id: buyerId, email: "buyer@nexus.local", fullName: "Fixture Buyer", phone: "0901234567", gender: "OTHER", address: "Ho Chi Minh City", dateOfBirth: "2000-01-01", roles: ["BUYER"], status: "ACTIVE", createdAt: "2026-11-13T00:00:00Z" }));
  if (path === "/v1/auctions" && req.method === "GET") {
    if (mode === "list-unavailable") return problem(res, 503, "AUCTION_UNAVAILABLE", "Auctions are temporarily unavailable.");
    const status = url.searchParams.get("status") || "ACTIVE";
    const number = Number(url.searchParams.get("page")) || 0;
    const size = Number(url.searchParams.get("size")) || 8;
    const rows = (listMode ? listings : [detail]).filter((row) => row.status === status);
    return json(res, success(rows.slice(number * size, (number + 1) * size), page(number, size, rows.length)));
  }
  if (path === "/v1/auctions/offers/mine" && req.method === "GET") {
    if (!authenticated) return problem(res, 401, "UNAUTHENTICATED", "Sign in to view your offers.");
    if (mode === "offers-unavailable") return problem(res, 404, "NOT_FOUND", "Offers are not available yet.");
    const number = Number(url.searchParams.get("page")) || 0;
    const size = Number(url.searchParams.get("size")) || 10;
    for (const offer of offers) if (offer.status === "OFFERED" && Date.parse(offer.expiresAt) <= Date.now()) offer.status = "EXPIRED";
    return json(res, success(offers.slice(number * size, (number + 1) * size), page(number, size, offers.length)));
  }
  if (path === `/v1/auctions/${auctionId}/offers/${offerId}/accept` || path === `/v1/auctions/${auctionId}/offers/${offerId}/decline`) {
    if (!authenticated) return problem(res, 401, "UNAUTHENTICATED", "Sign in to respond to the offer.");
    if (req.method !== "POST") return problem(res, 405, "METHOD_NOT_ALLOWED", "Use POST.");
    const action = path.endsWith("/accept") ? "accept" : "decline";
    evidence.offerRequests.push({ action, authorized: authenticated, at: Date.now() });
    const offer = offers[0];
    if (!offer) return problem(res, 404, "OFFER_NOT_FOUND", "There is no seller offer.");
    if (offer.status === "ACCEPTED" && action === "accept") return json(res, success(offer));
    if (offer.status !== "OFFERED" || Date.parse(offer.expiresAt) <= Date.now()) return problem(res, 409, "OFFER_EXPIRED", "This offer is no longer available.");
    if (mode === "offer-slow") await new Promise((resolve) => setTimeout(resolve, 800));
    if (action === "accept") {
      offer.status = "ACCEPTED"; offer.orderId = orderId;
      offer.paymentDueAt = new Date(Date.now() + 86400000).toISOString(); evidence.offerOrders += 1;
    } else offer.status = "DECLINED";
    if (mode === "offer-lost-response") return problem(res, 503, "OFFER_UNAVAILABLE", "The offer response was interrupted.");
    return json(res, success(offer));
  }
  if (path === `/v1/products/${productId}`) return json(res, success({
    id: productId, name: title, slug: `rolex-submariner-${productId}`, categoryId: "00000010-1111-4111-8111-111111111111", sellerId, status: "ACTIVE", auctionEnable: true,
    description: "Pre-owned — excellent, serviced 2025. Submariner Date, 41 mm, two-tone. Box & papers: 2022 warranty card. Ships from District 1, Ho Chi Minh City.", minPrice: 6000, maxPrice: 6000,
    skus: [{ id: skuId, productId, skuCode: "ROLEX-SUBMARINER", color: "Two-tone", size: "41 mm", price: 6000, status: "ACTIVE" }],
    images: [0, 1, 2, 3].map((index) => ({ id: `watch-image-${index}`, imageUrl: `${imageUrl}?view=${index}`, sortOrder: index })),
  }));
  if (path === "/v1/bids/mine") {
    if (!authenticated) return problem(res, 401, "UNAUTHENTICATED", "Sign in to view your bids.");
    const number = Number(url.searchParams.get("page")) || 0;
    const size = Number(url.searchParams.get("size")) || 100;
    const rows = listMode ? mineRows : [own];
    return json(res, success(rows.slice(number * size, (number + 1) * size), page(number, size, rows.length)));
  }
  if (listMode && req.method === "GET" && listings.some((row) => path === `/v1/auctions/${row.id}`)) return json(res, success(listings.find((row) => path === `/v1/auctions/${row.id}`)));
  if (path === `/v1/auctions/${auctionId}` && req.method === "GET") return json(res, success(detail));
  if (path === `/v1/auctions/${auctionId}/state`) {
    if (mode === "missing-read") return problem(res, 404, "NOT_FOUND", "Auction state endpoint is not available.");
    if (mode === "unavailable") return problem(res, 503, "AUCTION_UNAVAILABLE", "Auction updates are temporarily unavailable.");
    if (mode === "rate-limited") return problem(res, 429, "RATE_LIMITED", "Auction updates are temporarily rate limited.");
    return json(res, success(state()));
  }
  if (path === `/v1/auctions/${auctionId}/events`) {
    evidence.sseConnections += 1;
    if (mode !== "stream") return problem(res, 503, "SSE_UNAVAILABLE", "Live updates unavailable; polling remains available.");
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.write(": connected\n\n");
    streams.add(res);
    res.once("close", () => streams.delete(res));
    return;
  }
  if (path === `/v1/auctions/${auctionId}/bids` && req.method === "GET") {
    if (mode === "missing-read") return problem(res, 404, "NOT_FOUND", "Bid history endpoint is not available.");
    if (mode === "rate-limited") return problem(res, 429, "RATE_LIMITED", "Bid history is temporarily rate limited.");
    const number = Number(url.searchParams.get("page")) || 0;
    const size = Number(url.searchParams.get("size")) || 10;
    const rows = frozenBids ?? bids;
    return json(res, success(rows.slice(number * size, (number + 1) * size), page(number, size, rows.length)));
  }
  if (path === `/v1/auctions/${auctionId}/bids` && req.method === "POST") {
    const key = req.headers["idempotency-key"];
    const amount = req.body?.amount;
    evidence.bidRequests.push({ key, amount, authorized: authenticated, at: Date.now() });
    if (!authenticated) return problem(res, 401, "UNAUTHENTICATED", "Sign in to place a bid.");
    if (!key) return problem(res, 400, "AUCTION_IDEMPOTENCY_KEY_REQUIRED", "An Idempotency-Key is required.");
    if (attempts[key]) return json(res, success(attempts[key]));
    if (detail.status !== "ACTIVE") return problem(res, 409, "AUCTION_NOT_ACTIVE", "This auction has ended.");
    if (mode === "low") return problem(res, 400, "AUCTION_BID_TOO_LOW", "The bid is below the minimum.", { minimum: detail.currentPrice + 100 });
    if (typeof amount !== "number" || !Number.isFinite(amount)) return problem(res, 400, "VALIDATION_FAILED", "Bid amount must be a JSON number.");
    const minimum = detail.currentPrice + detail.bidIncrement;
    if (amount < minimum) return problem(res, 400, "AUCTION_BID_TOO_LOW", "The bid is below the minimum.", { minimum });
    detail.currentPrice = amount; detail.bidCount += 1;
    if (Date.parse(detail.endAt) - Date.now() <= 300000) { detail.endAt = new Date(Date.parse(detail.endAt) + 300000).toISOString(); detail.extensionCount += 1; }
    bids.unshift({ amount, bidderName: "j***n", placedAt: new Date().toISOString() });
    own = { auctionId, title, amount, placedAt: bids[0].placedAt, auctionStatus: detail.status, leading: true, won: false };
    const result = { bidId: randomUUID(), currentPrice: amount, leaderBidderId: buyerId };
    attempts[key] = result;
    await pm.state.set("auction-api:attempts", attempts);
    evidence.bidWrites += 1;
    if (mode === "lost-response") { mode = "normal"; return problem(res, 503, "AUCTION_UNAVAILABLE", "The bid response was lost. Retry this bid safely."); }
    publish();
    return json(res, success(result), 201);
  }
  return problem(res, 501, "FIXTURE_UNMODELED", `Unmodeled dependency call: ${req.method} ${path}`);
}).listen(process.env.PORT || 4500, "127.0.0.1");
