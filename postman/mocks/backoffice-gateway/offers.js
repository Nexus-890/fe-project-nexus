/* Explicit test-only implementation of docs/api/seller-offers.openapi.yaml.
 * Notification entries record simulated intent. No email or bank request is sent.
 */
const auctionId = "a2250000-0000-4000-8000-000000000099";

function createOfferFixture({ ok, problem, bodyOf, randomUUID, seller }) {
  let offers, emails, next, auctionStatus, orderRows, now, available, penalties, eligibilityUnavailable;
  const candidates = [
    { bidderId: "b2250000-0000-4000-8000-000000000002", displayName: "B***B", amount: 4800000 },
    { bidderId: "b2250000-0000-4000-8000-000000000003", displayName: "C***C", amount: 4600000 },
    { bidderId: "b2250000-0000-4000-8000-000000000004", displayName: "D***D", amount: 4500000 },
  ];
  function reset() { offers = []; emails = []; next = 0; auctionStatus = "PAYMENT_TIMEOUT"; orderRows = []; now = Date.now(); available = 5; penalties = []; eligibilityUnavailable = false; }
  reset();
  const snapshot = () => {
    const unavailable = eligibilityUnavailable && auctionStatus === "PAYMENT_TIMEOUT" && !offers.some((offer) => offer.status === "OFFERED") && next < candidates.length;
    const canOffer = !unavailable && auctionStatus === "PAYMENT_TIMEOUT" && !offers.some((offer) => offer.status === "OFFERED") && next < candidates.length;
    return { auctionId, canOffer, eligibilityUnavailable: unavailable, candidate: canOffer ? { ...candidates[next] } : null, offers: offers.map((offer) => ({ ...offer })).reverse() };
  };
  const evidence = () => ({ ...snapshot(), auctionStatus, emails: [...emails], orders: orderRows.map((order) => ({ ...order })),
    originalWinnerId: "b2250000-0000-4000-8000-000000000001", originalWinningPrice: 5000000, available, penalties: [...penalties], environment: "simulation only; proposed #208 response state; no real notifications, inventory or penalties" });
  function handle(req, res, url, claims) {
    const path = url.pathname;
    if (path === "/test/offers/evidence") { ok(res, evidence()); return true; }
    if (path === "/test/offers/eligibility" && req.method === "POST") {
      eligibilityUnavailable = bodyOf(req).unavailable === true;
      ok(res, snapshot()); return true;
    }
    if (path === "/test/offer-response" && req.method === "POST") {
      const body = bodyOf(req);
      const action = body.action || ({ DECLINED: "declined", EXPIRED: "expired", ACCEPTED: "accepted", PAID: "payment-completed", PAYMENT_TIMEOUT: "payment-timeout" })[body.status];
      const open = offers.find((offer) => offer.status === "OFFERED");
      if (action === "payment-completed" || action === "payment-timeout") {
        const order = orderRows.find((row) => row.status === "PENDING");
        if (!order) { problem(res, 409, "No accepted offer order awaiting payment"); return true; }
        if (action === "payment-timeout") {
          order.status = "CANCELED"; order.reason = "PAYMENT_DEADLINE_EXPIRED";
          now = Date.parse(order.paymentDueAt) + 1; available++;
          auctionStatus = "PAYMENT_TIMEOUT";
          penalties.push({ bidderId: order.userId, reason: "PAYMENT_TIMEOUT", simulationOnly: true });
        } else { order.status = "PAID"; auctionStatus = "SETTLED"; }
      } else if (!open) { problem(res, 409, "No offered offer"); return true; }
      else if (action === "declined") { open.status = "DECLINED"; open.respondedAt = new Date(now + 1000).toISOString(); available++; }
      else if (action === "expired") { now = Date.parse(open.expiresAt); open.status = "EXPIRED"; available++; }
      else if (action === "accepted") {
        open.status = "ACCEPTED"; open.respondedAt = new Date(now + 1000).toISOString();
        open.orderId = randomUUID(); open.paymentDueAt = new Date(now + 900000).toISOString();
        orderRows.push({ orderId: open.orderId, userId: open.bidderId, totalAmount: open.amount, status: "PENDING", paymentDueAt: open.paymentDueAt });
        auctionStatus = "WON";
      } else { problem(res, 400, "Use declined, expired, accepted, payment-timeout or payment-completed"); return true; }
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
    const state = snapshot();
    if (state.eligibilityUnavailable) { problem(res, 503, "Bidder eligibility is temporarily unavailable"); return true; }
    if (!state.canOffer) { problem(res, 409, "The auction is not timed out, an offer is awaiting response, or no eligible bidder remains"); return true; }
    const candidate = candidates[next++];
    const offer = { ...candidate, id: randomUUID(), status: "OFFERED", offeredAt: new Date(now).toISOString(), expiresAt: new Date(now + 86400000).toISOString(), respondedAt: null, orderId: null, paymentDueAt: null };
    offers.push(offer); available--;
    emails.push({ bidderId: offer.bidderId, offerId: offer.id, amount: offer.amount, simulationOnly: true });
    ok(res, snapshot(), 201); return true;
  }
  return { reset, handle, evidence, auctionId, get auctionStatus() { return auctionStatus; } };
}

module.exports = { createOfferFixture };
