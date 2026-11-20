/* Explicit test-only simulation for #230. Does not prove live backend integration. */
exports.createOperationsFixture = ({ ok, problem, list, bodyOf, randomUUID }) => {
  const id = (n) => `a2300000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const buyer = "68000000-0000-4000-8000-000000000003", seller = "68000000-0000-4000-8000-000000000002";
  let active = false, orders = [], refunds = [], shipments = [], history = {}, shipmentHistory = {}, requests = [], keys = new Map(), receipts = new Map();
  const receiptTypes = ["image/jpeg", "image/png", "application/pdf"];
  const form = (req) => {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString("latin1") : typeof req.body === "string" ? req.body : "";
    const boundary = /boundary=([^;]+)/.exec(String(req.headers["content-type"] || ""))?.[1];
    const fields = {};
    if (!boundary) return fields;
    for (const part of raw.split(`--${boundary}`)) {
      const name = /name="([^"]+)"/.exec(part)?.[1]; if (!name) continue;
      const content = part.slice(part.indexOf("\r\n\r\n") + 4).replace(/\r\n$/, "");
      fields[name] = /filename="/.test(part) ? { contentType: (/Content-Type: ([^\r\n]+)/i.exec(part)?.[1] || "").trim().toLowerCase(), content: Buffer.from(content, "latin1") } : Buffer.from(content, "latin1").toString("utf8");
    }
    return fields;
  };
  const reset = () => {
    active = true; requests = []; refunds = []; shipments = []; history = {}; shipmentHistory = {}; keys = new Map(); receipts = new Map();
    orders = Array.from({ length: 12 }, (_, index) => ({ orderId: id(index + 1), orderGroupId: id(100 + index), orderNumber: `NX-ADMIN-${index + 1}`, userId: buyer, sellerId: seller, orderType: index % 2 ? "AUCTION" : "STANDARD", status: index === 0 ? "CANCELED" : "PAID", totalAmount: 150000.25, createdAt: "2026-11-16T08:00:00Z", items: [] }));
  };
  const handle = (req, res, url, claims) => {
    const path = url.pathname;
    if (path === "/test/operations/reset") { reset(); ok(res, {}); return true; }
    if (path === "/test/operations/evidence") { ok(res, { requests, refunds, shipments, orders }); return true; }
    if (!active || !/^\/v1\/(?:orders\/manage|orders\/[^/]+\/(?:status|history)|payments$|refunds(?:\/|$)|shipments(?:\/|$)|carriers\/performance$)/.test(path)) return false;
    const multipart = String(req.headers["content-type"] || "").startsWith("multipart/form-data");
    const roles = claims?.roles || [], body = multipart ? {} : bodyOf(req);
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
      const row = { refundId: randomUUID(), ...body, amount: body.amount || 150000.25, currency: "VND", status: "REQUESTED", requestedAt: new Date().toISOString(), completedAt: null, evidence: [] };
      refunds.push(row); const result = { refundId: row.refundId, status: row.status }; keys.set(key, result); ok(res, result, 202); return true;
    }
    if (/^\/v1\/refunds\/[^/]+\/complete$/.test(path)) {
      const row = refunds.find((r) => r.refundId === path.split("/")[3]); if (!row) { problem(res, 404, "Refund not found"); return true; }
      if (!row.evidence.length) { problem(res, 409, "Upload the bank transfer evidence before completing the refund", "PAYMENT_REFUND_EVIDENCE_REQUIRED"); return true; }
      row.status = "COMPLETED"; row.completedAt ||= new Date().toISOString(); ok(res, row); return true;
    }
    const receiptMatch = /^\/v1\/refunds\/([^/]+)\/evidence(?:\/([^/]+))?$/.exec(path);
    if (receiptMatch) {
      const row = refunds.find((r) => r.refundId === receiptMatch[1]); if (!row) { problem(res, 404, "Refund not found", "PAYMENT_REFUND_NOT_FOUND"); return true; }
      if (req.method === "GET") {
        const stored = receipts.get(receiptMatch[2]); if (!stored || stored.refundId !== row.refundId) { problem(res, 404, "Refund not found", "PAYMENT_REFUND_NOT_FOUND"); return true; }
        res.writeHead(200, { "Content-Type": stored.contentType, "Cache-Control": "no-store, private", "Content-Disposition": "attachment; filename=\"refund-evidence\"", "X-Content-Type-Options": "nosniff" }); res.end(stored.content); return true;
      }
      const fields = form(req), reference = typeof fields.bankReference === "string" ? fields.bankReference.trim() : "";
      requests[requests.length - 1].body = { bankReference: reference, file: fields.file ? { contentType: fields.file.contentType, size: fields.file.content.length } : null };
      if (!reference || reference.length > 100) { problem(res, 400, "A bank transaction reference of at most 100 characters is required", "PAYMENT_REFUND_EVIDENCE_INVALID"); return true; }
      if (!fields.file || !receiptTypes.includes(fields.file.contentType)) { problem(res, 415, "Evidence must be a JPEG, PNG or PDF file", "PAYMENT_MANUAL_PAYOUT_EVIDENCE_UNSUPPORTED"); return true; }
      if (row.status === "COMPLETED") { problem(res, 409, "Refund is already completed; evidence can no longer change", "PAYMENT_REFUND_COMPLETED"); return true; }
      if (row.evidence.length >= 3) { problem(res, 409, "A refund keeps at most 3 evidence files", "PAYMENT_REFUND_EVIDENCE_LIMIT"); return true; }
      const evidenceId = randomUUID();
      receipts.set(evidenceId, { refundId: row.refundId, contentType: fields.file.contentType, content: fields.file.content });
      row.evidence.push({ evidenceId, contentType: fields.file.contentType, sizeBytes: fields.file.content.length, bankReference: reference, uploadedBy: claims.sub, uploadedAt: new Date().toISOString() });
      ok(res, row); return true;
    }
    if (path === "/v1/carriers/performance") {
      const from = Date.parse(url.searchParams.get("from") || ""), to = Date.parse(url.searchParams.get("to") || "");
      if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to || to - from > 366 * 86400000) { problem(res, 400, "Invalid statistics period", "SHIPMENT_INVALID_PERIOD"); return true; }
      list(res, [
        { carrier: "GHN", name: "Giao Hàng Nhanh", shipments: 12, delivered: 9, failed: 1, inProgress: 1, cancelled: 1, successRate: 0.9, averageDeliveryHours: 52.4, onTimeRate: 0.7778 },
        { carrier: "FAKE", name: "Nhà vận chuyển giả lập", shipments: 0, delivered: 0, failed: 0, inProgress: 0, cancelled: 0, successRate: null, averageDeliveryHours: null, onTimeRate: null },
      ], url); return true;
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
