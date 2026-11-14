/* Stateful stand-in for the delivered auction controller. No business data is written. */
function createAuctionFixture(options) {
  const { ok, problem, list, bodyOf, randomUUID, seller, findProduct } = options;
  const productId = "a2250000-0000-4000-8000-000000000001";
  const timedOutId = "a2250000-0000-4000-8000-000000000099";
  const statuses = ["ACTIVE", "SCHEDULED", "CREATED", "ENDED", "WON", "SETTLED", "FAILED", "PAYMENT_TIMEOUT", "CANCELLED"];
  let rows, clockOffset;
  const clock = () => Date.now() + clockOffset;
  function reset() {
    clockOffset = 0;
    rows = statuses.map((status, index) => {
      const future = ["CREATED", "SCHEDULED"].includes(status);
      const startAt = new Date(clock() + (future ? 86400000 : -3600000)).toISOString();
      const endAt = new Date(Date.parse(startAt) + 7200000).toISOString();
      return { id: status === "PAYMENT_TIMEOUT" ? timedOutId : `a2250000-0000-4000-8000-${String(100 + index).padStart(12, "0")}`,
        productId, skuId: `a2250000-0000-4000-8000-${String(200 + index).padStart(12, "0")}`, sellerId: seller,
        title: status === "PAYMENT_TIMEOUT" ? "Studio auction — unpaid winner" : `Studio auction — ${status.toLowerCase()}`,
        imageUrl: "http://127.0.0.1:3920/api/test/image.svg", startingPrice: 100000, bidIncrement: 10000, currentPrice: index > 2 && status !== "CANCELLED" ? 5000000 : 100000,
        bidCount: index > 2 && status !== "CANCELLED" ? 5 : 0, currency: "VND", startAt, endAt, originalEndAt: endAt, extensionCount: 0, status,
        cancelledBy: status === "CANCELLED" ? "SELLER" : null, cancelledReason: status === "CANCELLED" ? "Item unavailable" : null,
        cancelledActorId: status === "CANCELLED" ? seller : null, cancelledAt: status === "CANCELLED" ? new Date(clock()).toISOString() : null };
    });
    for (let index = 0; index < 3; index++) rows.push({ ...rows[3], id: randomUUID(), title: `Past studio auction ${index + 1}` });
  }
  reset();
  function refresh() {
    for (const row of rows) {
      if (row.status === "SCHEDULED" && Date.parse(row.startAt) <= clock()) row.status = "ACTIVE";
      if (row.status === "ACTIVE" && Date.parse(row.endAt) <= clock()) row.status = row.bidCount ? "WON" : "FAILED";
      if (row.id === timedOutId && options.getOfferAuctionStatus) row.status = options.getOfferAuctionStatus();
    }
  }
  const respond = (res, data, status) => { ok(res, data, status); return true; };
  const reject = (res, status, detail) => { problem(res, status, detail); return true; };
  function validWindow(body) {
    return typeof body.startingPrice === "number" && body.startingPrice > 0 && typeof body.bidIncrement === "number" && body.bidIncrement > 0 &&
      Number.isFinite(Date.parse(body.startAt)) && Date.parse(body.startAt) >= clock() - 5000 &&
      Date.parse(body.endAt) - Date.parse(body.startAt) >= 3 * 60000 && Date.parse(body.endAt) - Date.parse(body.startAt) <= 168 * 3600000;
  }
  function handle(req, res, url, claims) {
    const path = url.pathname;
    if (path === "/test/auctions/evidence") { refresh(); return respond(res, rows); }
    if (path === "/test/auctions/advance" && req.method === "POST") { clockOffset += Number(bodyOf(req).milliseconds || 0); refresh(); return respond(res, rows); }
    if (!/^\/v1\/auctions(?:\/mine|\/[^/]+(?:\/(?:schedule|cancel))?)?$/.test(path)) return false;
    const detail = /^\/v1\/auctions\/([^/]+)$/.exec(path);
    refresh();
    if (path === "/v1/auctions" && req.method === "GET") {
      const status = url.searchParams.get("status") || "ACTIVE";
      if (!statuses.includes(status)) return reject(res, 400, "Invalid auction status");
      list(res, ["CREATED", "CANCELLED"].includes(status) ? [] : rows.filter((row) => row.status === status), url);
      return true;
    }
    if (req.method === "GET" && detail && detail[1] !== "mine") {
      const row = rows.find((item) => item.id === detail[1]);
      return row ? respond(res, row) : reject(res, 404, "Auction not found");
    }
    if (!claims) return reject(res, 401, "Sign in first");
    if (!claims.roles?.includes("SELLER")) return reject(res, 403, "Seller role required");
    if (path === "/v1/auctions/mine" && req.method === "GET") {
      const status = url.searchParams.get("status");
      if (status && !statuses.includes(status)) return reject(res, 400, "Invalid auction status");
      list(res, rows.filter((row) => row.sellerId === claims.sub && (!status || row.status === status)), url);
      return true;
    }
    if (path === "/v1/auctions" && req.method === "POST") {
      const body = bodyOf(req), product = findProduct(body.productId);
      if (!product || product.sellerId !== claims.sub || product.status !== "ACTIVE" || !product.skus.some((sku) => sku.id === body.skuId)) return reject(res, 403, "Choose your active product and SKU");
      if (!validWindow(body)) return reject(res, 400, "Auction needs positive prices, a future start and a duration between 3 minutes and 7 days");
      if (rows.some((row) => row.skuId === body.skuId && ["CREATED", "SCHEDULED", "ACTIVE"].includes(row.status))) return reject(res, 409, "This SKU already has a live auction");
      if (rows.filter((row) => row.sellerId === claims.sub && ["CREATED", "SCHEDULED", "ACTIVE"].includes(row.status)).length >= 5) return reject(res, 409, "Live auction limit reached");
      const row = { id: randomUUID(), productId: body.productId, skuId: body.skuId, sellerId: claims.sub, title: product.name, imageUrl: product.images[0]?.imageUrl ?? null,
        startingPrice: body.startingPrice, bidIncrement: body.bidIncrement, currentPrice: body.startingPrice, bidCount: 0, currency: "VND", startAt: body.startAt, endAt: body.endAt, originalEndAt: body.endAt, extensionCount: 0,
        status: "CREATED", cancelledBy: null, cancelledReason: null, cancelledActorId: null, cancelledAt: null };
      rows.unshift(row); return respond(res, row, 201);
    }
    const match = /^\/v1\/auctions\/([^/]+)(?:\/(schedule|cancel))?$/.exec(path);
    if (!match) return reject(res, 501, "Auction operation not modelled");
    const row = rows.find((item) => item.id === match[1]);
    if (!row) return reject(res, 404, "Auction not found");
    if (row.sellerId !== claims.sub) return reject(res, 403, "Auction owner required");
    if (req.method === "PUT" && !match[2]) {
      if (!["CREATED", "SCHEDULED"].includes(row.status) || Date.parse(row.startAt) <= clock() || row.bidCount) return reject(res, 409, "Auction cannot be edited after it starts or receives bids");
      const body = bodyOf(req);
      if (!validWindow(body)) return reject(res, 400, "Invalid auction schedule or prices");
      Object.assign(row, { startingPrice: body.startingPrice, currentPrice: body.startingPrice, bidIncrement: body.bidIncrement, startAt: body.startAt, endAt: body.endAt, originalEndAt: body.endAt });
      return respond(res, row);
    }
    if (req.method === "POST" && match[2] === "schedule") {
      if (row.status !== "CREATED") return reject(res, 409, "Only a draft can be scheduled");
      row.status = "SCHEDULED"; return respond(res, row);
    }
    if (req.method === "POST" && match[2] === "cancel") {
      if (!["CREATED", "SCHEDULED", "ACTIVE", "ENDED", "WON"].includes(row.status) || row.bidCount) return reject(res, 409, "This auction cannot be cancelled by the seller");
      const reason = String(bodyOf(req).reason || "").trim();
      if (!reason || Array.from(reason).length > 255) return reject(res, 400, "Enter a cancellation reason of 1–255 characters");
      Object.assign(row, { status: "CANCELLED", cancelledBy: "SELLER", cancelledReason: reason, cancelledActorId: claims.sub, cancelledAt: new Date(clock()).toISOString() });
      return respond(res, row);
    }
    return reject(res, 501, "Auction operation not modelled");
  }
  return { reset, handle };
}

module.exports = { createAuctionFixture };
