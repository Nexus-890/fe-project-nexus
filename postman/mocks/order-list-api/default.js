/* Local #154 fixture. orderGroupId models the task's pending #138 contract;
 * it is deliberately not claimed as delivered by develop's OrderResponse. */
const http = require("node:http");
const userId = "68000000-0000-4000-8000-000000000003";
const order = (index, status, totalAmount, orderNumber, productName) => ({
  orderId: `68000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  orderGroupId: `c8000000-0000-4000-8000-${String(index + 100).padStart(12, "0")}`,
  orderNumber, userId, sellerId: "68000000-0000-4000-8000-000000000004",
  orderType: "STANDARD", status, createdAt: "2026-09-29T08:30:00Z", totalAmount,
  items: [{
    orderItemId: `69000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    productId: "70000000-0000-4000-8000-000000000001",
    skuId: "71000000-0000-4000-8000-000000000001",
    productName, skuCode: "SILVER", imageUrl: null,
    quantity: 1, unitPrice: totalAmount, totalPrice: totalAmount,
  }],
});
const initialOrders = () => [
  order(1, "PAID", 300000.5, "NX-260929-0042", "Apple AirPods Max Silver"),
  order(2, "PENDING", 9854900, "NX-260929-0038", "Rolex Submariner Watch"),
  order(3, "CANCELED", 93190, "NX-260921-0311", "Puma Future Rider Trainers"),
];
const initialEvidence = () => ({ reads: [], rejected: 0 });
const success = (data, page) => ({ code: 0, message: "response success", data, ...(page ? { page } : {}) });
function json(res, body, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}
function problem(res, status, code, detail) {
  res.writeHead(status, { "Content-Type": "application/problem+json", "Cache-Control": "no-store" });
  res.end(JSON.stringify({ type: "urn:problem:domain-error", title: "Order list unavailable", status, code, detail }));
}
function forward(req, res, port, path) {
  const upstream = http.request({
    hostname: "127.0.0.1", port, path, method: req.method,
    headers: { authorization: req.headers.authorization || "", accept: "application/json" },
  }, (response) => {
    res.writeHead(response.statusCode, { "Content-Type": response.headers["content-type"] || "application/json" });
    response.pipe(res);
  });
  upstream.on("error", () => problem(res, 503, "SERVICE_UNAVAILABLE", "A fixture dependency is unavailable."));
  upstream.end();
}
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:3102");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, "http://127.0.0.1:3914");
  if (url.pathname === "/health") return json(res, { ready: true });
  if (url.pathname === "/test/reset") {
    await pm.state.set("order-list-api:mode", url.searchParams.get("mode") || "success");
    await pm.state.set("order-list-api:evidence", initialEvidence());
    return json(res, {});
  }
  if (url.pathname === "/test/mode") {
    await pm.state.set("order-list-api:mode", url.searchParams.get("mode") || "success");
    return json(res, {});
  }
  if (url.pathname === "/test/evidence") return json(res, await pm.state.get("order-list-api:evidence") || initialEvidence());
  if (url.pathname === "/v1/users/me") return forward(req, res, 3913, `/api${req.url}`);
  if (url.pathname === "/v1/categories/tree" || url.pathname === "/v1/products")
    return forward(req, res, 3911, `/api${req.url}`);
  if (url.pathname === "/v1/orders" && req.method === "GET") {
    const evidence = await pm.state.get("order-list-api:evidence") || initialEvidence();
    const authorized = /^Bearer .+/.test(req.headers.authorization || "");
    evidence.reads.push({ method: req.method, status: url.searchParams.get("status"), page: url.searchParams.get("page"), size: url.searchParams.get("size"), authorized });
    if (!authorized) evidence.rejected += 1;
    await pm.state.set("order-list-api:evidence", evidence);
    if (!authorized) return problem(res, 401, "UNAUTHENTICATED", "Sign in to view your orders.");
    const mode = await pm.state.get("order-list-api:mode") || "success";
    if (mode === "unauthenticated") return problem(res, 401, "COMMERCE_UNAUTHENTICATED", "Your order session has expired. Sign in again.");
    if (mode === "unavailable") return problem(res, 503, "SERVICE_UNAVAILABLE", "Orders are temporarily unavailable. Please try again.");
    let orders = initialOrders();
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
  return problem(res, 501, "FIXTURE_NOT_IMPLEMENTED", "This endpoint is outside the order-list fixture.");
});
server.listen(process.env.PORT);
