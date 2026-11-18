/* Explicit test-only simulation for #230. Does not prove live backend integration. */
exports.createOperationsFixture = ({ ok, problem, list, bodyOf, randomUUID }) => {
  const id = (n) => `a2300000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const buyer = "68000000-0000-4000-8000-000000000003", seller = "68000000-0000-4000-8000-000000000002";
  let active = false, orders = [], refunds = [], shipments = [], history = {}, shipmentHistory = {}, requests = [], keys = new Map();
  const reset = () => {
    active = true; requests = []; refunds = []; shipments = []; history = {}; shipmentHistory = {}; keys = new Map();
    orders = Array.from({ length: 12 }, (_, index) => ({ orderId: id(index + 1), orderGroupId: id(100 + index), orderNumber: `NX-ADMIN-${index + 1}`, userId: buyer, sellerId: seller, orderType: index % 2 ? "AUCTION" : "STANDARD", status: index === 0 ? "CANCELED" : "PAID", totalAmount: 150000.25, createdAt: "2026-11-16T08:00:00Z", items: [] }));
  };
  const handle = (req, res, url, claims) => {
    const path = url.pathname;
    if (path === "/test/operations/reset") { reset(); ok(res, {}); return true; }
    if (path === "/test/operations/evidence") { ok(res, { requests, refunds, shipments, orders }); return true; }
    if (!active || !/^\/v1\/(?:orders\/manage|orders\/[^/]+\/(?:status|history)|payments$|refunds(?:\/|$)|shipments(?:\/|$))/.test(path)) return false;
    const roles = claims?.roles || [], body = bodyOf(req);
    const key = req.headers["idempotency-key"];
    requests.push({ method: req.method, path, query: Object.fromEntries(url.searchParams), body, key });
    if (!roles.some((role) => ["ADMIN", "SUPPORT_STAFF"].includes(role))) { problem(res, 403, "Staff access required"); return true; }
    if (path === "/v1/orders/manage") {
      const rows = orders.filter((row) => ["status", "orderType", "userId", "sellerId"].every((field) => !url.searchParams.has(field) || row[field] === url.searchParams.get(field)) && (!url.searchParams.has("from") || Date.parse(row.createdAt) >= Date.parse(url.searchParams.get("from"))) && (!url.searchParams.has("to") || Date.parse(row.createdAt) <= Date.parse(url.searchParams.get("to"))));
      list(res, rows, url); return true;
    }
    const orderMatch = /^\/v1\/orders\/([^/]+)\/(status|history)$/.exec(path);
    if (orderMatch) {
      const row = orders.find((o) => o.orderId === orderMatch[1]);
      if (!row) { problem(res, 404, "Order not found"); return true; }
      if (orderMatch[2] === "history") { list(res, history[row.orderId] || [], url); return true; }
      if (!roles.includes("ADMIN")) { problem(res, 403, "Administrator required"); return true; }
      if (row.status !== "PAID" || body.status !== "SHIPPED") { problem(res, 409, "The order status transition is not allowed", "COMMERCE_ILLEGAL_TRANSITION"); return true; }
      history[row.orderId] = [{ id: randomUUID(), previousStatus: row.status, newStatus: body.status, reason: body.reason, changedBy: claims.sub, createdAt: new Date().toISOString() }]; row.status = body.status; ok(res, row); return true;
    }
    if (path === "/v1/payments") {
      const payment = { transactionId: id(301), orderGroupId: id(100), amount: 150000.25, currency: "VND", provider: "SEPAY", providerReference: "****8877", type: "NORMAL", status: "UNRECONCILED", receivedAt: "2026-11-16T08:00:00Z" };
      list(res, !url.searchParams.has("status") || url.searchParams.get("status") === payment.status ? [payment] : [], url); return true;
    }
    if (path === "/v1/refunds") {
      if (req.method === "GET") { list(res, refunds.filter((r) => r.orderId === url.searchParams.get("orderId")), url); return true; }
      if (keys.has(key)) { ok(res, keys.get(key), 202); return true; }
      if (refunds.some((r) => r.orderId === body.orderId)) { problem(res, 409, "A refund already exists"); return true; }
      const row = { refundId: randomUUID(), ...body, amount: body.amount || 150000.25, currency: "VND", status: "REQUESTED", requestedAt: new Date().toISOString(), completedAt: null };
      refunds.push(row); const result = { refundId: row.refundId, status: row.status }; keys.set(key, result); ok(res, result, 202); return true;
    }
    if (/^\/v1\/refunds\/[^/]+\/complete$/.test(path)) {
      const row = refunds.find((r) => r.refundId === path.split("/")[3]); if (!row) { problem(res, 404, "Refund not found"); return true; }
      row.status = "COMPLETED"; row.completedAt ||= new Date().toISOString(); ok(res, row); return true;
    }
    if (path === "/v1/shipments") {
      if (req.method === "GET") { list(res, shipments.filter((s) => (!url.searchParams.has("orderId") || s.orderId === url.searchParams.get("orderId")) && (!url.searchParams.has("status") || s.status === url.searchParams.get("status"))), url); return true; }
      if (keys.has(key)) { ok(res, keys.get(key), 201); return true; }
      const row = { id: randomUUID(), ...body, warehouseId: body.warehouseId || id(400), buyerId: buyer, carrier: body.carrier || "fake", serviceType: body.serviceType || null, trackingCode: "FAKE-SIMULATED", status: "CREATED", shippingFee: 20000, shippingInfo: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 0 };
      shipments.push(row); keys.set(key, row); ok(res, row, 201); return true;
    }
    const match = /^\/v1\/shipments\/([^/]+)\/(status|override|history)$/.exec(path);
    if (match) {
      const row = shipments.find((s) => s.id === match[1]); if (!row) { problem(res, 404, "Shipment not found"); return true; }
      if (match[2] === "history") { list(res, shipmentHistory[row.id] || [], url); return true; }
      if (match[2] === "status" && body.status === "DELIVERED") { problem(res, 409, "Shipment transition rejected", "SHIPMENT_ILLEGAL_TRANSITION"); return true; }
      row.status = body.status; row.version++; row.updatedAt = new Date().toISOString();
      (shipmentHistory[row.id] ||= []).unshift({ id: randomUUID(), status: row.status, description: body.reason, source: "MANUAL", carrierEventId: null, changedBy: claims.sub, changedAt: row.updatedAt }); ok(res, row); return true;
    }
    return false;
  };
  return { handle, deactivate: () => { active = false; } };
};
