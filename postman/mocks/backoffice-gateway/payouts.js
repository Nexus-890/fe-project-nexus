/* Explicit local simulation of issue #257/#261. All provider steps are simulated.
 * Production never imports this handler and no banking request is made here.
 */
function createPayoutFixture({ ok, problem, list, bodyOf, randomUUID, seller, getBankAccounts = () => [] }) {
  const system = "00000000-0000-0000-0000-000000000000";
  const statuses = ["ON_HOLD", "PENDING", "PROCESSING", "UNKNOWN", "SUCCEEDED", "FAILED", "RETURNED"];
  let payouts, attempts, requests, transactions, counter, manualView = () => null;
  const money = (value) => typeof value === "string" && /^\d{1,17}\.\d{2}$/.test(value);
  const minor = (value) => BigInt(value.replace(".", ""));
  const decimal = (value) => `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
  const instant = () => new Date(Date.now() + counter++).toISOString();
  const publicRow = (row) => ({ id: row.id, orderId: row.orderId, sellerId: row.sellerId, orderAmount: row.orderAmount,
    shippingFee: row.shippingFee, platformFeeRate: row.platformFeeRate, platformFee: row.platformFee, netAmount: row.netAmount,
    currency: row.currency, status: row.status, attemptCount: row.attemptCount, recipientAccountLast4: row.recipientAccountLast4,
    providerReference: row.providerReference, createdAt: row.createdAt, simulated: true, executionMode: row.executionMode || "AUTO",
    confirmationSource: row.confirmationSource ?? null, manualAttempt: manualView(row) });
  const snapshot = (row) => ({ ...publicRow(row), history: row.history.map((step) => ({ ...step })).reverse() });
  const verifiedBank = (sellerId) => getBankAccounts().find((bank) => bank.sellerId === sellerId && bank.active && bank.isDefault && bank.verificationStatus === "VERIFIED");
  const record = (row, event, fromStatus, actorId = system, extra = {}) => row.history.push({ id: randomUUID(), event, fromStatus, toStatus: row.status,
    attemptNo: row.attemptCount, amount: row.netAmount, sellerBankId: row.sellerBankId, recipientAccountLast4: row.recipientAccountLast4,
    provider: row.attemptCount ? "SANDBOX" : null, providerReference: row.providerReference, providerStatus: null,
    errorCode: null, errorMessage: null, simulated: true, actorId, occurredAt: instant(), ...extra });
  const respond = (res, data, status) => { ok(res, data, status); return true; };
  const reject = (res, status, detail, code) => { problem(res, status, detail, code); return true; };
  function reset() { payouts = []; attempts = new Map(); requests = []; transactions = []; counter = 0; }
  function releaseHeld(account) {
    const sellerId = typeof account === "string" ? account : account.sellerId;
    const bank = verifiedBank(sellerId);
    if (!bank) return;
    for (const row of payouts.filter((payout) => payout.sellerId === sellerId && payout.status === "ON_HOLD" && payout.executionMode !== "MANUAL")) {
      row.status = "PENDING"; row.sellerBankId = bank.id; record(row, "RELEASED", "ON_HOLD");
    }
  }
  function completeOrder(body) {
    const existing = payouts.find((row) => row.orderId === body.orderId);
    if (existing) return existing;
    if (body.status !== "COMPLETED" || body.funded !== true || body.refund !== false || !money(body.orderAmount) || !money(body.shippingFee)) return null;
    const base = minor(body.orderAmount) - minor(body.shippingFee);
    const feeRate = body.platformFeeRate ?? "0.0000";
    if (base <= 0n || !/^(?:0(?:\.\d{1,4})?|1(?:\.0{1,4})?)$/.test(feeRate)) return null;
    const [wholeRate, fractionRate = ""] = feeRate.split(".");
    const rateUnits = BigInt(wholeRate) * 10000n + BigInt(fractionRate.padEnd(4, "0"));
    const fee = (base * rateUnits + 5000n) / 10000n;
    const net = base - fee;
    if (net <= 0n) return null;
    const sellerId = body.sellerId || seller, bank = verifiedBank(sellerId);
    const row = { id: randomUUID(), orderId: body.orderId, sellerId, orderAmount: body.orderAmount, shippingFee: body.shippingFee,
      platformFeeRate: feeRate, platformFee: decimal(fee), netAmount: decimal(net), currency: "VND", status: bank ? "PENDING" : "ON_HOLD", attemptCount: 0,
      recipientAccountLast4: null, providerReference: null, createdAt: instant(), sellerBankId: bank?.id ?? null, sourceEventId: body.eventId || randomUUID(), history: [] };
    record(row, "CREATED", null); if (!bank) record(row, "HELD", row.status);
    payouts.push(row); return row;
  }
  function providerStep(row, outcome) {
    if (row.executionMode === "MANUAL") return false;
    if (row.status === "PENDING") {
      const bank = verifiedBank(row.sellerId);
      if (!bank) return false;
      row.sellerBankId = bank.id; row.recipientAccountLast4 = bank.accountLast4; row.status = "PROCESSING"; row.attemptCount++;
      row.providerReference = null; record(row, "SENT", "PENDING", system, { providerStatus: "ACCEPTED" });
    }
    if (outcome === "PROCESSING") return row.status === "PROCESSING";
    if (outcome === "RETURNED") {
      if (row.status !== "SUCCEEDED") return row.status === "RETURNED";
      row.status = "RETURNED"; transactions.push({ payoutId: row.id, type: "PAYOUT_RETURN", attemptNo: row.attemptCount, amount: row.netAmount, simulated: true }); record(row, "RETURNED", "SUCCEEDED"); return true;
    }
    if (!["PROCESSING", "UNKNOWN"].includes(row.status)) return row.status === outcome;
    const previous = row.status;
    if (outcome === "UNKNOWN") { if (previous !== "UNKNOWN") { row.status = "UNKNOWN"; record(row, "TIMED_OUT", previous, system, { errorCode: "PROVIDER_TIMEOUT", errorMessage: "Sandbox result is unclear; reconcile this attempt." }); } return true; }
    if (!["SUCCEEDED", "FAILED"].includes(outcome)) return false;
    row.status = outcome;
    if (outcome === "SUCCEEDED") {
      row.providerReference = `SANDBOX-${row.id}-${row.attemptCount}`;
      transactions.push({ payoutId: row.id, type: "PAYOUT", attemptNo: row.attemptCount, amount: row.netAmount, providerReference: row.providerReference, simulated: true });
    }
    record(row, previous === "UNKNOWN" ? "RECONCILED" : outcome, previous, system, outcome === "FAILED" ? { errorCode: "SANDBOX_REJECTED", errorMessage: "The simulated provider rejected this attempt." } : { providerStatus: "CONFIRMED" });
    return true;
  }
  function handle(req, res, url, claims) {
    const route = url.pathname.replace(/^\/api/, "");
    if (route === "/test/payouts/evidence" && req.method === "GET") return respond(res, { payouts: payouts.map(snapshot), requests, transactions, simulated: true });
    if (route === "/test/payouts/order-completed" && req.method === "POST") { const row = completeOrder(bodyOf(req)); return respond(res, { payout: row ? snapshot(row) : null, simulated: true }); }
    if (route === "/test/payouts/provider" && req.method === "POST") {
      const body = bodyOf(req), row = payouts.find((payout) => payout.id === body.payoutId);
      if (!row) return reject(res, 404, "Payout missing", "PAYOUT_NOT_FOUND");
      return providerStep(row, body.outcome) ? respond(res, snapshot(row)) : reject(res, 409, "The simulated transition is not allowed", "PAYOUT_NOT_RETRYABLE");
    }
    if (!route.startsWith("/v1/payments/payouts")) return false;
    requests.push({ method: req.method, path: route, actor: claims?.sub || null, query: Object.fromEntries(url.searchParams), ...(route.endsWith("/retry") ? { idempotencyKey: req.headers["idempotency-key"] } : {}) });
    if (!claims) return reject(res, 401, "Sign in first", "UNAUTHENTICATED");
    const isAdmin = claims.roles?.includes("ADMIN"), isSeller = claims.roles?.includes("SELLER");
    if (route === "/v1/payments/payouts/me" && req.method === "GET") {
      if (!isSeller) return reject(res, 403, "Seller role required", "FORBIDDEN");
      list(res, payouts.filter((row) => row.sellerId === claims.sub).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(publicRow), url); return true;
    }
    if (route === "/v1/payments/payouts" && req.method === "GET") {
      if (!isAdmin) return reject(res, 403, "Administrator role required", "FORBIDDEN");
      const selectedStatuses = url.searchParams.getAll("status"), sellerId = url.searchParams.get("sellerId"), from = url.searchParams.get("from"), to = url.searchParams.get("to");
      if (selectedStatuses.some((status) => !statuses.includes(status))) return reject(res, 400, "Invalid status filter", "INVALID_PARAMETER");
      list(res, payouts.filter((row) => (!sellerId || row.sellerId === sellerId) && (!selectedStatuses.length || selectedStatuses.includes(row.status)) && (!from || Date.parse(row.createdAt) >= Date.parse(from)) && (!to || Date.parse(row.createdAt) <= Date.parse(to))).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(publicRow), url); return true;
    }
    const match = /^\/v1\/payments\/payouts\/([^/]+)(\/retry)?$/.exec(route);
    if (!match) return reject(res, 501, "No manual payout creation endpoint exists", "NOT_IMPLEMENTED");
    const row = payouts.find((payout) => payout.id === match[1]);
    if (!row || !isAdmin && (!isSeller || row.sellerId !== claims.sub)) return reject(res, 404, "Payout not found", "PAYOUT_NOT_FOUND");
    if (!match[2] && req.method === "GET") return respond(res, snapshot(row));
    if (match[2] && req.method === "POST") {
      if (!isAdmin) return reject(res, 403, "Administrator role required", "FORBIDDEN");
      const key = req.headers["idempotency-key"];
      if (typeof key !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key) || Object.keys(bodyOf(req)).length) return reject(res, 400, "A UUID Idempotency-Key and no body are required", "INVALID_PARAMETER");
      const previous = attempts.get(key.toLowerCase());
      if (previous) return previous.payoutId === row.id && previous.actorId === claims.sub ? respond(res, snapshot(row)) : reject(res, 409, "Retry key belongs to another request", "PAYOUT_NOT_RETRYABLE");
      if (row.executionMode === "MANUAL") return reject(res, 409, "Manual payouts are retried from the manual payout workspace", "PAYOUT_NOT_RETRYABLE");
      if (!["FAILED", "RETURNED"].includes(row.status) || !verifiedBank(row.sellerId)) return reject(res, 409, "Only failed or returned payouts with a verified default account may retry", "PAYOUT_NOT_RETRYABLE");
      const before = row.status; row.status = "PENDING"; record(row, "RETRIED", before, claims.sub); attempts.set(key.toLowerCase(), { payoutId: row.id, actorId: claims.sub });
      return respond(res, snapshot(row));
    }
    return reject(res, 501, "No manual payout creation endpoint exists", "NOT_IMPLEMENTED");
  }
  reset();
  return { reset, handle, releaseHeld, rows: () => payouts, snapshot, setManualView: (view) => { manualView = view; } };
}
module.exports = { createPayoutFixture };
