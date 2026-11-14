/* Simulation-only PROPOSED #261 contract. No real bank transfer is attempted. */
function createPayoutFixture({ ok, problem, list, bodyOf, randomUUID, seller }) {
  let accounts, payouts, orders, attempts, requests;
  const bankId = "95000000-0000-4000-8000-000000000001";
  const orderId = "95000000-0000-4000-8000-000000000002";
  const createdAt = "2026-11-14T03:00:00Z";
  function reset() {
    accounts = [{ id: bankId, sellerId: seller, bankCode: "VCB", bankName: "Vietcombank", accountHolder: "DEMO SELLER", last4: "4321", verified: false, createdAt }];
    payouts = []; attempts = new Map(); requests = [];
    orders = [{ orderId, orderNumber: "NX-PAYOUT-001", sellerId: seller, sellerName: "Demo Seller", status: "COMPLETED", totalAmount: 4800000, completedAt: createdAt, payoutId: null, refundStatus: null },
      ...["PAID", "SHIPPED", "DELIVERED", "REFUND_REQUESTED"].map((status, index) => ({ orderId: `95000000-0000-4000-8000-${String(index + 3).padStart(12, "0")}`, orderNumber: `NX-NOT-PAYABLE-${status}`, sellerId: seller, sellerName: "Demo Seller", status, totalAmount: 100000, completedAt: null, payoutId: null, refundStatus: null }))];
  }
  const masked = (account) => ({ id: account.id, bankCode: account.bankCode, bankName: account.bankName, accountHolder: account.accountHolder, last4: account.last4, verified: account.verified, createdAt: account.createdAt });
  const publicPayout = (payout) => ({ id: payout.id, orderId: payout.orderId, orderNumber: payout.orderNumber, bankAccount: payout.bankAccount, amount: payout.amount, status: payout.status, createdAt: payout.createdAt, paidAt: payout.paidAt, reference: payout.reference });
  const reject = (res, status, detail, code) => { problem(res, status, detail, code); return true; };
  const respond = (res, data, status) => { ok(res, data, status); return true; };
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function handle(req, res, url, claims) {
    const path = url.pathname.replace(/^\/api/, "");
    if (!path.startsWith("/v1/sellers/") && !path.startsWith("/v1/payouts") && path !== "/test/payouts-verify" && path !== "/test/payouts/evidence") return false;
    if (path === "/test/payouts/evidence" && req.method === "GET") return respond(res, { accounts: accounts.map(masked), payouts: payouts.map(publicPayout), requests });
    requests.push({ method: req.method, path, actor: claims?.sub || null, ...(path === "/v1/payouts" ? { orderId: bodyOf(req).orderId, bankAccountId: bodyOf(req).bankAccountId, idempotencyKey: req.headers["idempotency-key"] } : {}) });
    if (!claims) return reject(res, 401, "Sign in first", "UNAUTHENTICATED");
    const has = (role) => claims.roles?.includes(role);
    if (path === "/test/payouts-verify" && req.method === "POST") {
      if (!has("ADMIN")) return reject(res, 403, "Admin required", "FORBIDDEN");
      const account = accounts.find((row) => row.id === (bodyOf(req).bankAccountId || bankId));
      if (!account) return reject(res, 404, "Bank account missing", "PAYOUT_BANK_ACCOUNT_NOT_FOUND");
      account.verified = true;
      return respond(res, masked(account));
    }
    if (/^\/v1\/sellers\/(?!me(?:\/|$))/.test(path)) return reject(res, 403, "Only own seller account data is available", "FORBIDDEN");
    if (path.startsWith("/v1/sellers/me/")) {
      if (!has("SELLER")) return reject(res, 403, "Seller role required", "FORBIDDEN");
      if (path === "/v1/sellers/me/bank-accounts" && req.method === "GET") return respond(res, accounts.filter((row) => row.sellerId === claims.sub).map(masked));
      if (path === "/v1/sellers/me/bank-accounts" && req.method === "POST") {
        const body = bodyOf(req);
        if (!body.bankCode || !body.bankName || !body.accountHolder || !/^\d{6,34}$/.test(body.accountNumber || "") || body.sellerId || body.verified != null)
          return reject(res, 400, "Valid bank details are required", "VALIDATION_FAILED");
        const account = { id: randomUUID(), sellerId: claims.sub, bankCode: body.bankCode, bankName: body.bankName, accountHolder: body.accountHolder, last4: body.accountNumber.slice(-4), verified: false, createdAt: new Date().toISOString() };
        accounts.push(account); return respond(res, masked(account), 201);
      }
      if (path === "/v1/sellers/me/payouts" && req.method === "GET") { list(res, payouts.filter((row) => row.sellerId === claims.sub).map(publicPayout), url); return true; }
    }
    if (!has("ADMIN")) return reject(res, 403, "Admin role required", "FORBIDDEN");
    if (path === "/v1/payouts/payable-orders" && req.method === "GET") {
      list(res, orders.filter((order) => order.status === "COMPLETED" && !order.payoutId && !order.refundStatus).map((order) => ({ ...order, bankAccounts: accounts.filter((account) => account.sellerId === order.sellerId).map(masked) })), url); return true;
    }
    if (path === "/v1/payouts" && req.method === "POST") {
      const body = bodyOf(req), key = req.headers["idempotency-key"];
      if (!uuid.test(key || "") || !uuid.test(body.orderId || "") || !uuid.test(body.bankAccountId || "")) return reject(res, 400, "UUID Idempotency-Key and order/account are required", "VALIDATION_FAILED");
      const replay = attempts.get(key.toLowerCase());
      if (replay) {
        if (replay.adminId !== claims.sub || replay.orderId !== body.orderId || replay.bankAccountId !== body.bankAccountId) return reject(res, 409, "Idempotency key payload changed", "PAYOUT_IDEMPOTENCY_CONFLICT");
        return respond(res, replay.payout, 200);
      }
      const order = orders.find((row) => row.orderId === body.orderId), account = accounts.find((row) => row.id === body.bankAccountId);
      if (!order) return reject(res, 404, "Order missing", "PAYOUT_ORDER_NOT_FOUND");
      if (!account || account.sellerId !== order.sellerId) return reject(res, 403, "Bank account must belong to the order seller", "FORBIDDEN");
      if (order.status !== "COMPLETED" || order.refundStatus) return reject(res, 409, "Order must be completed without a refund", "PAYOUT_ORDER_NOT_COMPLETED");
      if (!account.verified) return reject(res, 409, "Bank account is not verified", "PAYOUT_BANK_ACCOUNT_UNVERIFIED");
      if (order.payoutId) return reject(res, 409, "Order already has a payout", "PAYOUT_ALREADY_EXISTS");
      const payout = { id: randomUUID(), orderId: order.orderId, orderNumber: order.orderNumber, bankAccount: masked(account), amount: order.totalAmount, status: "PENDING", createdAt: new Date().toISOString(), paidAt: null, reference: null };
      payouts.push({ ...payout, sellerId: order.sellerId }); order.payoutId = payout.id;
      attempts.set(key.toLowerCase(), { ...body, adminId: claims.sub, payout });
      return respond(res, payout, 201);
    }
    return reject(res, 501, "Payout endpoint is not modelled", "NOT_IMPLEMENTED");
  }
  reset();
  return { reset, handle };
}
module.exports = { createPayoutFixture };
