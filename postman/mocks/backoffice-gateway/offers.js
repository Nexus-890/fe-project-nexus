/* Explicit test-only implementation of docs/api/seller-offers.openapi.yaml.
 * Notification entries record simulated intent. No email or bank request is sent.
 */
const auctionId = "a2250000-0000-4000-8000-000000000099";

function createOfferFixture({ ok, problem, bodyOf, randomUUID, seller }) {
  let version, offers, emails, next, auctionStatus, orderRows, now;
  const candidates = [
    { bidderId: "b2250000-0000-4000-8000-000000000002", displayName: "Bidder B", amount: 4800000 },
    { bidderId: "b2250000-0000-4000-8000-000000000003", displayName: "Bidder C", amount: 4600000 },
    { bidderId: "b2250000-0000-4000-8000-000000000004", displayName: "Bidder D", amount: 4500000 },
  ];
  function reset() { version = 0; offers = []; emails = []; next = 0; auctionStatus = "PAYMENT_TIMEOUT"; orderRows = []; now = Date.now(); }
  reset();
  const snapshot = () => {
    const canOffer = auctionStatus === "PAYMENT_TIMEOUT" && !offers.some((offer) => ["OPEN", "ACCEPTED"].includes(offer.status)) && next < candidates.length;
    return { auctionId, version, canOffer, candidate: canOffer ? { ...candidates[next] } : null, offers: offers.map((offer) => ({ ...offer })).reverse() };
  };
  const evidence = () => ({ ...snapshot(), auctionStatus, emails: [...emails], orders: orderRows.map((order) => ({ ...order })),
    originalWinnerId: "b2250000-0000-4000-8000-000000000001", originalWinningPrice: 5000000, environment: "simulation only; proposed #208 contract; no real notifications" });
  function handle(req, res, url, claims) {
    const path = url.pathname;
    if (path === "/test/offers/evidence") { ok(res, evidence()); return true; }
    if (path === "/test/offer-response" && req.method === "POST") {
      const body = bodyOf(req);
      const action = body.action || ({ DECLINED: "declined", EXPIRED: "expired", ACCEPTED: "accepted", PAID: "payment-completed" })[body.status];
      const open = offers.find((offer) => offer.status === "OPEN");
      if (action === "payment-completed") {
        const accepted = offers.find((offer) => offer.status === "ACCEPTED");
        if (!accepted) { problem(res, 409, "No accepted offer order to pay"); return true; }
        orderRows.find((order) => order.orderId === accepted.orderId).status = "PAID";
        auctionStatus = "SETTLED"; version++;
      } else if (!open) { problem(res, 409, "No open offer"); return true; }
      else if (action === "declined") { open.status = "DECLINED"; open.respondedAt = new Date(now + 1000).toISOString(); version++; }
      else if (action === "expired") { now = Date.parse(open.expiresAt); open.status = "EXPIRED"; version++; }
      else if (action === "accepted") {
        open.status = "ACCEPTED"; open.respondedAt = new Date(now + 1000).toISOString();
        open.orderId = randomUUID(); open.paymentDueAt = new Date(now + 900000).toISOString();
        orderRows.push({ orderId: open.orderId, userId: open.bidderId, totalAmount: open.amount, status: "PENDING", paymentDueAt: open.paymentDueAt }); version++;
      } else { problem(res, 400, "Use declined, expired, accepted or payment-completed"); return true; }
      ok(res, evidence()); return true;
    }
    const match = /^\/v1\/auctions\/([^/]+)\/second-chance-offers$/.exec(path);
    if (!match) return false;
    if (!claims) { problem(res, 401, "Sign in first"); return true; }
    if (!claims.roles?.includes("SELLER") || claims.sub !== seller) { problem(res, 403, "Auction owner required"); return true; }
    if (match[1] !== auctionId) { problem(res, 404, "Simulated timed-out auction missing"); return true; }
    if (req.method === "GET") { ok(res, snapshot()); return true; }
    if (req.method !== "POST") { problem(res, 501, "Offer operation not modelled"); return true; }
    if (Object.keys(bodyOf(req)).length) { problem(res, 400, "The server selects the bidder and amount; no request body is allowed"); return true; }
    if (req.headers["if-match"] !== `"${version}"`) { problem(res, 412, "Offer candidate changed; refresh before confirming"); return true; }
    const state = snapshot();
    if (!state.canOffer) { problem(res, 409, "An offer is already open, accepted, or no eligible bidder remains"); return true; }
    const candidate = candidates[next++];
    const offer = { ...candidate, id: randomUUID(), status: "OPEN", offeredAt: new Date(now).toISOString(), expiresAt: new Date(now + 86400000).toISOString(), respondedAt: null, orderId: null, paymentDueAt: null };
    offers.push(offer); version++;
    emails.push({ bidderId: offer.bidderId, offerId: offer.id, amount: offer.amount, simulationOnly: true });
    ok(res, snapshot(), 201); return true;
  }
  return { reset, handle, evidence, auctionId, get auctionStatus() { return auctionStatus; } };
}

module.exports = { createOfferFixture };
