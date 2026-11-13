/* Local order-list/detail stand-in. Source contract and verification limits
 * are recorded in simulations/order-list.context.yaml. */
const http = require("node:http");
const userId = "68000000-0000-4000-8000-000000000003";
const order = (index, status, totalAmount, orderNumber, productName, price = {}) => ({
  orderId: `68000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  orderGroupId: `c8000000-0000-4000-8000-${String(index + 100).padStart(12, "0")}`,
  orderNumber, userId, sellerId: "68000000-0000-4000-8000-000000000004",
  orderType: "STANDARD", status, canCancel: status === "PENDING" || status === "PAID",
  createdAt: "2026-09-29T08:30:00Z", totalAmount,
  items: [{
    orderItemId: `69000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    productId: "70000000-0000-4000-8000-000000000001",
    skuId: "71000000-0000-4000-8000-000000000001",
    productName, skuCode: "SILVER", imageUrl: null,
    quantity: 1, unitPrice: totalAmount, totalPrice: totalAmount,
  }],
  ...price,
});
const initialOrders = () => [
  order(1, "PAID", 300000.5, "NX-260929-0042", "Apple AirPods Max Silver",
    { subtotal: 300000.5, shippingFee: 0, discountAmount: 0, taxAmount: 0 }),
  order(2, "PENDING", 9854900, "NX-260929-0038", "Rolex Submariner Watch",
    { subtotal: 9834000, shippingFee: 20900, discountAmount: 0, taxAmount: 0 }),
  order(3, "CANCELED", 93190, "NX-260921-0311", "Puma Future Rider Trainers"),
];
const historyEntry = (entry, index, previousStatus, newStatus, reason) => ({
  id: `72000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  previousStatus, newStatus, reason, changedBy: userId,
  createdAt: new Date(Date.parse(entry.createdAt) + index * 1000).toISOString(),
});
const initialHistories = () => Object.fromEntries(initialOrders().map((entry, index) => [entry.orderId, [
  historyEntry(entry, index * 10 + 1, null, "PENDING", "Order created from cart"),
  ...(entry.status === "PENDING" ? [] : [historyEntry(entry, index * 10 + 2, "PENDING", entry.status,
    entry.status === "PAID" ? "Payment confirmed" : "Changed my mind")]),
]]));
const initialEvidence = () => ({ reads: [], details: [], histories: [], cancellations: [], receiptConfirmations: [], shipments: [], ratingReads: [], ratingWrites: [], reputations: [], rejected: 0 });
// Detail/history refetches run together. Serialize read/modify/write evidence so
// one endpoint cannot overwrite another endpoint's recorded request.
let evidenceQueue = Promise.resolve();
async function recordEvidence(kind, request) {
  const write = evidenceQueue.then(async () => {
    const evidence = await pm.state.get("order-list-api:evidence") || initialEvidence();
    evidence[kind].push(request);
    if (!request.authorized) evidence.rejected += 1;
    await pm.state.set("order-list-api:evidence", evidence);
  });
  evidenceQueue = write.catch(() => {});
  await write;
}
const success = (data, page) => ({ code: 0, message: "response success", data, ...(page ? { page } : {}) });
function json(res, body, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}
function problem(res, status, code, detail) {
  res.writeHead(status, { "Content-Type": "application/problem+json", "Cache-Control": "no-store" });
  res.end(JSON.stringify({ type: "urn:problem:domain-error", title: "Order request failed", status, code, detail }));
}
function forward(req, res, port, path) {
  const headers = Object.fromEntries(Object.entries(req.headers)
    .filter(([name]) => !["host", "connection", "content-length"].includes(name)));
  const body = req.body == null ? undefined : typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  const upstream = http.request({
    hostname: "127.0.0.1", port, path, method: req.method,
    headers,
  }, (response) => {
    res.writeHead(response.statusCode, response.headers);
    response.pipe(res);
  });
  upstream.on("error", () => problem(res, 503, "SERVICE_UNAVAILABLE", "A fixture dependency is unavailable."));
  upstream.end(body);
}
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", process.env.NEXUS_OIDC_APP_ORIGIN || "http://127.0.0.1:3102");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Requested-With");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, "http://127.0.0.1:3914");
  if (url.pathname === "/health") return json(res, { ready: true });
  if (url.pathname === "/test/reset") {
    await evidenceQueue;
    await pm.state.set("order-list-api:mode", url.searchParams.get("mode") || "success");
    await pm.state.set("order-list-api:evidence", initialEvidence());
    await pm.state.set("order-list-api:orders", initialOrders());
    await pm.state.set("order-list-api:histories", initialHistories());
    await pm.state.set("order-list-api:detail-mode", "success");
    await pm.state.set("order-list-api:rating-mode", "success");
    await pm.state.set("order-list-api:ratings", []);
    return json(res, {});
  }
  if (url.pathname === "/test/mode") {
    await pm.state.set("order-list-api:mode", url.searchParams.get("mode") || "success");
    return json(res, {});
  }
  if (url.pathname === "/test/evidence") {
    await evidenceQueue;
    return json(res, await pm.state.get("order-list-api:evidence") || initialEvidence());
  }
  if (url.pathname === "/test/detail-mode") {
    await pm.state.set("order-list-api:detail-mode", url.searchParams.get("mode") || "success");
    return json(res, {});
  }
  if (url.pathname === "/test/rating-mode") {
    await pm.state.set("order-list-api:rating-mode", url.searchParams.get("mode") || "success");
    return json(res, {});
  }
  // Test-only controls let asynchronous refund events advance independently of a
  // user's cancellation request. They are never part of production code.
  if (url.pathname === "/test/order") {
    const orders = await pm.state.get("order-list-api:orders") || initialOrders();
    const entry = orders.find((candidate) => candidate.orderId === url.searchParams.get("id"));
    if (!entry) return problem(res, 404, "FIXTURE_ORDER_NOT_FOUND", "No fixture order has this reference.");
    const status = url.searchParams.get("status");
    if (status && status !== entry.status) {
      const histories = await pm.state.get("order-list-api:histories") || initialHistories();
      histories[entry.orderId].push(historyEntry(entry, 100 + histories[entry.orderId].length,
        entry.status, status, `Order moved to ${status}`));
      await pm.state.set("order-list-api:histories", histories);
      entry.status = status;
      entry.canCancel = status === "PENDING" || status === "PAID";
    }
    if (url.searchParams.has("canCancel")) entry.canCancel = url.searchParams.get("canCancel") === "true";
    if (url.searchParams.get("omitCanCancel") === "true") delete entry.canCancel;
    for (const field of ["deliveredAt", "autoCompleteAt"]) {
      if (url.searchParams.has(field)) entry[field] = url.searchParams.get(field) || null;
    }
    await pm.state.set("order-list-api:orders", orders);
    return json(res, {});
  }
  // #258 scheduler is a backend dependency. This control models its persisted
  // result, not a browser timer or a claim about the real scheduler/outbox.
  if (url.pathname === "/test/auto-complete") {
    const orders = await pm.state.get("order-list-api:orders") || initialOrders();
    const entry = orders.find((candidate) => candidate.orderId === url.searchParams.get("id"));
    if (!entry || entry.status !== "DELIVERED") return problem(res, 409, "FIXTURE_ORDER_NOT_DELIVERED", "Expected a delivered fixture order.");
    entry.status = "COMPLETED";
    const histories = await pm.state.get("order-list-api:histories") || initialHistories();
    histories[entry.orderId].push(historyEntry(entry, 100 + histories[entry.orderId].length,
      "DELIVERED", "COMPLETED", "Automatically completed after the receipt confirmation period"));
    await pm.state.set("order-list-api:orders", orders);
    await pm.state.set("order-list-api:histories", histories);
    return json(res, {});
  }
  if (url.pathname === "/v1/users/me" || url.pathname.startsWith("/v1/auth/"))
    return forward(req, res, Number(process.env.NEXUS_TEST_PROVIDER_PORT || process.env.NEXUS_OIDC_SIM_PORT || 3913), `/api${req.url}`);
  if (url.pathname === "/v1/categories/tree" || url.pathname === "/v1/products")
    return forward(req, res, Number(process.env.NEXUS_TEST_API_PORT || 3911), `/api${req.url}`);
  if (url.pathname === "/v1/shipments" && req.method === "GET") {
    const authorized = /^Bearer .+/.test(req.headers.authorization || "");
    const orderId = url.searchParams.get("orderId");
    await recordEvidence("shipments", { method: req.method, orderId, authorized,
      page: url.searchParams.get("page"), size: url.searchParams.get("size") });
    if (!authorized) return problem(res, 401, "SHIPMENT_UNAUTHENTICATED", "Sign in to view shipment updates.");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId || "") ||
      url.searchParams.get("page") !== "0" || url.searchParams.get("size") !== "1")
      return problem(res, 400, "SHIPMENT_INVALID_PARAMETER", "The fixture expects a valid orderId, page 0 and size 1.");
    // These order snapshots have no visible shipment. A successful empty list
    // models the delivered ownership-filtered read without a tracking fallback.
    return json(res, success([], { number: 0, size: 1, totalElements: 0, totalPages: 0 }));
  }
  if (url.pathname === "/v1/orders" && req.method === "GET") {
    const authorized = /^Bearer .+/.test(req.headers.authorization || "");
    await recordEvidence("reads", { method: req.method, status: url.searchParams.get("status"), page: url.searchParams.get("page"), size: url.searchParams.get("size"), authorized });
    if (!authorized) return problem(res, 401, "UNAUTHENTICATED", "Sign in to view your orders.");
    const mode = await pm.state.get("order-list-api:mode") || "success";
    if (mode === "unauthenticated") return problem(res, 401, "COMMERCE_UNAUTHENTICATED", "Your order session has expired. Sign in again.");
    if (mode === "unavailable") return problem(res, 503, "SERVICE_UNAVAILABLE", "Orders are temporarily unavailable. Please try again.");
    let orders = await pm.state.get("order-list-api:orders") || initialOrders();
    if (mode === "empty") orders = [];
    if (mode === "missing-group") delete orders[1].orderGroupId;
    if (mode === "long-number") orders[1].orderNumber = `NX-${"1234567890".repeat(9)}`;
    if (mode === "paged") orders = [...Array.from({ length: 25 }, (_, i) => order(i + 10, "PENDING", 150000 + i, `NX-260929-${String(i + 1).padStart(4, "0")}`, "Pending order")), ...orders];
    const status = url.searchParams.get("status");
    if (status) orders = orders.filter((entry) => entry.status === status);
    const page = Number(url.searchParams.get("page") || 0);
    const size = Number(url.searchParams.get("size") || 10);
    return json(res, success(orders.slice(page * size, (page + 1) * size), { number: page, size, totalElements: orders.length, totalPages: Math.ceil(orders.length / size) }));
  }
  // Provisional #212/#213 boundary, exercised by the real frontend. Not a delivered service contract.
  const reputationMatch = /^\/v1\/reputations\/([0-9a-f-]+)$/.exec(url.pathname);
  if (url.pathname === "/v1/ratings" || reputationMatch) {
    const authorized = /^Bearer .+/.test(req.headers.authorization || "");
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    await recordEvidence(reputationMatch ? "reputations" : req.method === "POST" ? "ratingWrites" : "ratingReads", {
      method: req.method, authorized, ...(req.method === "POST" ? { body } : { userId: reputationMatch?.[1] || url.searchParams.get("userId"), page: url.searchParams.get("page"), size: url.searchParams.get("size") }),
    });
    if (!authorized) return problem(res, 401, "RATING_UNAUTHENTICATED", "Sign in to view ratings.");
    const mode = await pm.state.get("order-list-api:rating-mode") || "success";
    if (mode === "unavailable") return problem(res, 503, "SERVICE_UNAVAILABLE", "Ratings are temporarily unavailable.");
    if (reputationMatch && req.method === "GET") return json(res, success({
      userId: reputationMatch[1], score: 78, trustLevel: "TRUSTED", totalTransaction: 42, successfulTransaction: 40, failedTransaction: 2,
    }));
    const ratings = await pm.state.get("order-list-api:ratings") || [];
    if (req.method === "GET") {
      const page = Number(url.searchParams.get("page") || 0);
      const size = Number(url.searchParams.get("size") || 100);
      const filtered = ratings.filter((rating) => rating.toUserId === url.searchParams.get("userId"));
      return json(res, success(filtered.slice(page * size, (page + 1) * size), {
        number: page, size, totalElements: filtered.length, totalPages: Math.ceil(filtered.length / size),
      }));
    }
    if (req.method === "POST") {
      const orders = await pm.state.get("order-list-api:orders") || initialOrders();
      const entry = orders.find((order) => order.orderId === body?.orderId);
      if (!entry || entry.status !== "COMPLETED" || body.toUserId !== entry.sellerId)
        return problem(res, 409, "RATING_NOT_ELIGIBLE", "Only a completed order can be rated.");
      if (ratings.some((rating) => rating.orderId === entry.orderId && rating.fromUserId === userId))
        return problem(res, 409, "RATING_ALREADY_EXISTS", "You have already rated this order.");
      if (!Number.isInteger(body.score) || body.score < 1 || body.score > 5 ||
        (body.comment !== null && (typeof body.comment !== "string" || body.comment.length > 1000)))
        return problem(res, 400, "VALIDATION_FAILED", "Select between one and five stars.");
      const rating = { id: "73000000-0000-4000-8000-000000000001", fromUserId: userId,
        toUserId: entry.sellerId, orderId: entry.orderId, score: body.score, comment: body.comment,
        createdAt: "2026-11-14T03:00:00Z" };
      ratings.push(rating);
      await pm.state.set("order-list-api:ratings", ratings);
      // Represents another tab completing the same rating before this write.
      if (mode === "conflict") return problem(res, 409, "RATING_ALREADY_EXISTS", "You have already rated this order.");
      return json(res, success(rating), 201);
    }
  }
  const detailMatch = /^\/v1\/orders\/([0-9a-f-]+)(?:\/(history|cancel|confirm-receipt))?$/.exec(url.pathname);
  if (detailMatch) {
    const [, orderId, action] = detailMatch;
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const authorized = /^Bearer .+/.test(req.headers.authorization || "");
    const recorded = { method: req.method, orderId, authorized };
    if (action === "confirm-receipt") await recordEvidence("receiptConfirmations", recorded);
    else if (action === "cancel") await recordEvidence("cancellations", { ...recorded, body,
      contentType: req.headers["content-type"] });
    else await recordEvidence(action === "history" ? "histories" : "details", recorded);
    if (!authorized) return problem(res, 401, "COMMERCE_UNAUTHENTICATED", "Sign in to view your order.");
    if (orderId === "68000000-0000-4000-8000-000000000099")
      return problem(res, 403, "COMMERCE_FORBIDDEN", "You do not have access to this order.");
    const orders = await pm.state.get("order-list-api:orders") || initialOrders();
    const entry = orders.find((candidate) => candidate.orderId === orderId);
    if (!entry) return problem(res, 404, "COMMERCE_ORDER_NOT_FOUND", "Order not found.");
    const mode = await pm.state.get("order-list-api:detail-mode") || "success";
    if (action === "history" && req.method === "GET") {
      if (mode === "history-unavailable") return problem(res, 503, "SERVICE_UNAVAILABLE", "Order updates are temporarily unavailable.");
      const histories = await pm.state.get("order-list-api:histories") || initialHistories();
      return json(res, success(histories[orderId]));
    }
    if (action === "confirm-receipt" && req.method === "POST") {
      if (mode === "receipt-unavailable") return problem(res, 503, "SERVICE_UNAVAILABLE", "Receipt confirmation is temporarily unavailable. Please try again.");
      if (mode === "receipt-conflict") {
        entry.status = "COMPLETED";
        await pm.state.set("order-list-api:orders", orders);
        return problem(res, 409, "COMMERCE_ORDER_NOT_DELIVERED", "This order has already completed. Refresh its latest status.");
      }
      if (entry.status !== "DELIVERED") return problem(res, 409, "COMMERCE_ORDER_NOT_DELIVERED", "Only a delivered order can be confirmed.");
      entry.status = "COMPLETED";
      entry.canCancel = false;
      const histories = await pm.state.get("order-list-api:histories") || initialHistories();
      histories[orderId].push(historyEntry(entry, 100 + histories[orderId].length,
        "DELIVERED", "COMPLETED", "Buyer confirmed receipt"));
      await pm.state.set("order-list-api:orders", orders);
      await pm.state.set("order-list-api:histories", histories);
      return json(res, success(entry));
    }
    if (action === "cancel" && req.method === "POST") {
      const reason = body && typeof body.reason === "string" ? body.reason.trim() : "";
      if (!reason || reason.length > 500) return problem(res, 400, "VALIDATION_FAILED", "A cancellation reason of up to 500 characters is required.");
      if (reason === "PAYMENT_DEADLINE_EXPIRED") return problem(res, 400, "COMMERCE_RESERVED_CANCEL_REASON", "This cancellation reason is reserved for payment expiry");
      if (mode === "cancel-conflict") {
        entry.status = "SHIPPED";
        entry.canCancel = false;
        await pm.state.set("order-list-api:orders", orders);
        return problem(res, 409, "COMMERCE_ORDER_NOT_CANCELLABLE", "This order has shipped and can no longer be cancelled.");
      }
      if (!entry.canCancel) return problem(res, 409, "COMMERCE_ORDER_NOT_CANCELLABLE", "The order can no longer be cancelled.");
      const previous = entry.status;
      entry.status = "CANCELED";
      entry.canCancel = false;
      const histories = await pm.state.get("order-list-api:histories") || initialHistories();
      histories[orderId].push(historyEntry(entry, 100 + histories[orderId].length, previous, "CANCELED", reason));
      await pm.state.set("order-list-api:orders", orders);
      await pm.state.set("order-list-api:histories", histories);
      return json(res, success({ orderGroupId: entry.orderGroupId, status: previous === "PAID" ? "PAID" : "CANCELED",
        currency: "VND", totalAmount: entry.totalAmount, dueAt: "2026-09-29T09:00:00Z", orders: [entry] }));
    }
    if (!action && req.method === "GET") {
      if (mode === "detail-unavailable") return problem(res, 503, "SERVICE_UNAVAILABLE", "This order is temporarily unavailable.");
      return json(res, success(entry));
    }
  }
  return problem(res, 501, "FIXTURE_NOT_IMPLEMENTED", "This endpoint is outside the order-list fixture.");
});
server.listen(process.env.PORT);
