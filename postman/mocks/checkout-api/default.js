/* Local #150/#151 dependency fixture. Requests use delivered #138 address codes;
 * their fees/localities model scenarios, not a live carrier quote. The simulation
 * removes its /api routeKey before this handler receives /v1/... requests.
 */
const http = require("node:http");
const { createHash } = require("node:crypto");
// Account #219 extends this existing HTTP fixture only in its dedicated run.
const accountHandler = process.env.NEXUS_ACCOUNT_SIMULATION === "true"
  ? require("../account-api/handler.js") : null;

const user = {
  id: "68000000-0000-4000-8000-000000000003", email: "buyer@nexus.local",
  fullName: "Nguyen Thi Lan", phone: "0901234567", gender: "FEMALE",
  address: "227 Nguyen Van Cu", dateOfBirth: "2000-01-01", roles: ["BUYER"],
  status: "ACTIVE", createdAt: "2026-11-04T00:00:00Z",
};
const items = [
  { id: "10000000-0000-4000-8000-000000000001", productId: "20000000-0000-4000-8000-000000000001", skuId: "30000000-0000-4000-8000-000000000001", quantity: 2, unitPrice: 150000 },
  { id: "10000000-0000-4000-8000-000000000002", productId: "20000000-0000-4000-8000-000000000002", skuId: "30000000-0000-4000-8000-000000000002", quantity: 1, unitPrice: 125000 },
];
const provinces = [{ code: "202", name: "Ho Chi Minh City" }, { code: "201", name: "Ha Noi" }];
const wards = {
  "202": [{ code: "20308", name: "Ward 4" }, { code: "20309", name: "Ward 5" }, { code: "20310", name: "Ben Nghe" }],
  "201": [{ code: "20701", name: "Phuc Xa" }],
};
const defaults = () => ({
  emptyProfile: false, emptyCart: false, previewFailure: false,
  malformedPreview: false, nullShippingFee: false, fieldError: false,
  wardsFailure: false, slowWard: false,
  metadataFailure: false, changedPreview: false,
  priceChanged: false, insufficientStock: false, stockSkuOnly: false,
  orderLostResponse: false, slowOrder: false, orderValidation: false,
  orderUnknownConflict: false,
  malformedPriceChanged: false,
});
const initialEvidence = () => ({ requests: [], previews: [], completedPreviews: [], orderRequests: 0, rejectedAuth: 0, orders: [], groups: [], completedOrders: 0, consumedCartPreviews: 0 });
// Concurrent reconnect reads must append to one evidence object; independent
// read/modify/write snapshots would erase each other's recorded requests.
let currentEvidence = initialEvidence();
const envelope = (data, page) => ({ code: 0, message: "response success", data, ...(page ? { page } : {}) });
const list = (data) => envelope(data, { number: 0, size: Math.max(1, data.length), totalElements: data.length, totalPages: data.length ? 1 : 0 });

function json(res, body, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}
function problem(res, status, code, detail, errors, extensions = {}, instance = "/api/v1/checkout/preview") {
  res.writeHead(status, { "Content-Type": "application/problem+json", "Cache-Control": "no-store" });
  res.end(JSON.stringify({
    type: `urn:problem:${code.toLowerCase().replaceAll("_", "-")}`,
    title: status === 400 ? "Validation Failed" : status === 409 ? "Conflict" : "Service Unavailable",
    status, code, detail, instance, ...(errors ? { errors } : {}), ...extensions,
  }));
}
function bodyOf(req) {
  return typeof req.body === "object" && req.body ? req.body : JSON.parse(req.body || "{}");
}

const productName = (item) => item.id === items[0].id ? "Studio headphones in silver" : "Wireless earbuds with charging case";
const currentItems = async () => {
  const prices = await pm.state.get("checkout-api:prices") || {};
  return items.map((item) => ({ ...item, unitPrice: prices[item.skuId] ?? item.unitPrice }));
};
// Serialize writes so deliberately repeated browser requests exercise the same
// key/body guarantee without the stand-in itself racing its state persistence.
let orderTail = Promise.resolve();
async function placeOrder(req, res, options) {
  const evidence = currentEvidence;
  evidence.requests.push({ method: "POST", path: "/v1/orders", query: "", authorized: true });
  const body = bodyOf(req);
  const key = String(req.headers["idempotency-key"] || "").toLowerCase();
  const call = { key, body, status: 0 };
  evidence.orderRequests += 1;
  evidence.orders.push(call);
  const save = () => pm.state.set("checkout-api:evidence", evidence);
  const reject = async (status, code, detail, errors, extensions) => {
    call.status = status;
    evidence.completedOrders += 1;
    await save();
    return problem(res, status, code, detail, errors, extensions, "/api/v1/orders");
  };
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/.test(key))
    return reject(400, "COMMERCE_INVALID_ORDER_REQUEST", "Idempotency-Key must be a UUID");
  const address = body.shippingAddress || {};
  const required = ["recipientName", "phoneNumber", "addressLine", "provinceCode", "wardCode", "countryCode"];
  const invalid = required.filter((field) => typeof address[field] !== "string" || !address[field].trim());
  if (body.paymentMethod !== "SEPAY" || address.countryCode !== "VN" || invalid.length)
    return reject(400, "VALIDATION_FAILED", "A complete Vietnamese shipping address and SEPAY payment method are required.", invalid.map((field) => ({
      field: `shippingAddress.${field}`, code: "VALIDATION_NOT_BLANK", detail: "This field is required.",
    })));
  const saved = evidence.groups.find((entry) => entry.key === key);
  if (saved) {
    if (JSON.stringify(saved.body) !== JSON.stringify(body))
      return reject(409, "COMMERCE_IDEMPOTENCY_CONFLICT", "Idempotency-Key was already used for another request");
    call.status = 200;
    call.orderGroupId = saved.group.orderGroupId;
    evidence.completedOrders += 1;
    await save();
    return json(res, envelope(saved.group));
  }
  if (options.orderValidation)
    return reject(400, "VALIDATION_FAILED", "Please check your shipping address.", [
      { field: "shippingAddress.phoneNumber", code: "VALIDATION_PATTERN", detail: "Enter a reachable Vietnamese phone number." },
    ]);
  if (options.orderUnknownConflict)
    return reject(409, "COMMERCE_CHECKOUT_REJECTED", "This checkout cannot proceed. Review your cart before trying again.");
  if (options.malformedPriceChanged)
    return reject(409, "COMMERCE_PRICE_CHANGED", "A price changed, but its updated amount is unavailable. Return to your cart.", undefined, {
      skuId: items[0].skuId, oldPrice: 150000, newPrice: "invalid",
    });
  if (options.insufficientStock)
    // Forced future #151 contract: real inventory reservation is still pending.
    return reject(409, "COMMERCE_INSUFFICIENT_STOCK", "The selected item has sold out. Please update your cart.", undefined, {
      skuId: items[1].skuId, ...(options.stockSkuOnly ? {} : { productName: productName(items[1]) }),
    });
  const cartItems = await currentItems();
  if (options.priceChanged && cartItems[0].unitPrice === 150000) {
    await pm.state.set("checkout-api:prices", { [items[0].skuId]: 180000 });
    return reject(409, "COMMERCE_PRICE_CHANGED", "The price of Studio headphones in silver has changed. Confirm the new price to continue.", undefined, {
      skuId: items[0].skuId, oldPrice: 150000, newPrice: 180000,
    });
  }
  const orders = cartItems.map((item, index) => ({
    orderId: `c8000000-0000-4000-8000-00000000000${index + 1}`,
    orderNumber: `NX-20261104-0000000${index + 1}`,
    userId: user.id, sellerId: `68000000-0000-4000-8000-00000000000${index + 4}`,
    orderType: "STANDARD", status: "PENDING", createdAt: "2026-11-04T08:00:00Z",
    orderGroupId: "c8000000-0000-4000-8000-000000000006",
    recipientName: address.recipientName, phoneNumber: address.phoneNumber,
    subtotal: item.unitPrice * item.quantity, shippingFee: 0, discountAmount: 0, taxAmount: 0,
    totalAmount: item.unitPrice * item.quantity,
    items: [{
      orderItemId: `c9000000-0000-4000-8000-00000000000${index + 1}`,
      productId: item.productId, skuId: item.skuId, productName: productName(item),
      skuCode: `AUDIO-${index + 1}`, imageUrl: null, quantity: item.quantity,
      unitPrice: item.unitPrice, totalPrice: item.unitPrice * item.quantity,
    }],
  }));
  const group = {
    orderGroupId: "c8000000-0000-4000-8000-000000000006", status: "PENDING",
    totalAmount: orders.reduce((total, order) => total + order.totalAmount, 0),
    currency: "VND", dueAt: "2026-11-04T08:15:00Z", orders,
  };
  evidence.groups.push({ key, body, group });
  call.orderGroupId = group.orderGroupId;
  call.status = options.orderLostResponse ? 503 : 201;
  await save();
  if (options.slowOrder) await new Promise((resolve) => setTimeout(resolve, 1400));
  // Refresh after delays so concurrent GET evidence is not overwritten.
  const completed = currentEvidence;
  completed.completedOrders += 1;
  await pm.state.set("checkout-api:evidence", completed);
  if (options.orderLostResponse)
    return problem(res, 503, "GATEWAY_UNAVAILABLE", "The order response was lost. Retry to retrieve the same purchase.", undefined, {}, "/api/v1/orders");
  return json(res, envelope(group), 201);
}

async function forwardSession(req, res, url) {
  const headers = Object.fromEntries(Object.entries(req.headers).filter(([name]) => !['host', 'connection', 'content-length'].includes(name)));
  const upstream = await fetch('http://127.0.0.1:' + (process.env.NEXUS_TEST_PROVIDER_PORT || '3923') + '/session' + url.pathname, {
    method: req.method, headers,
    body: ['GET','HEAD','OPTIONS'].includes(req.method) ? undefined : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {})),
  });
  res.statusCode = upstream.status;
  upstream.headers.forEach((value,name) => { if (!['content-length','content-encoding','transfer-encoding','set-cookie'].includes(name)) res.setHeader(name,value); });
  const cookies = upstream.headers.getSetCookie();
  if(cookies.length) res.setHeader('Set-Cookie',cookies);
  res.end(Buffer.from(await upstream.arrayBuffer()));
}
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", `http://127.0.0.1:${process.env.NEXUS_TEST_APP_PORT || 3123}`);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key, X-Requested-With");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return json(res, {});
  const url = new URL(req.url, "http://127.0.0.1:3913");
  if (accountHandler && await accountHandler(req, res, url, { state: pm.state, json, problem, bodyOf, envelope, user })) return;
  if (url.pathname.startsWith('/v1/auth/')) return forwardSession(req, res, url);
  if (url.pathname === "/health") return json(res, { ready: true });
  if (url.pathname === '/test/qr.svg') {
    res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
    return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><path fill="white" d="M0 0h256v256H0z"/><path d="M16 16h224v224H16z"/></svg>');
  }
  if (url.pathname === "/test/reset") {
    await pm.state.set("checkout-api:options", defaults());
    currentEvidence = initialEvidence();
    await pm.state.set("checkout-api:evidence", currentEvidence);
    await pm.state.set("checkout-api:prices", {});
    return json(res, { ready: true });
  }
  const options = await pm.state.get("checkout-api:options") || defaults();
  if (url.pathname === "/test/options" && req.method === "POST") {
    const next = { ...options, ...bodyOf(req) };
    await pm.state.set("checkout-api:options", next);
    return json(res, next);
  }
  const evidence = currentEvidence;
  if (url.pathname === "/test/evidence") return json(res, evidence);
  const authorization = req.headers.authorization || "";
  const expectedHash = await pm.state.get("oidc-keycloak:access-token-hash");
  const authorized = Boolean(authorization.startsWith("Bearer ") && expectedHash
    && createHash("sha256").update(authorization.slice(7)).digest("hex") === expectedHash);
  evidence.requests.push({ method: req.method, path: url.pathname, query: url.search, authorized });
  const save = () => pm.state.set("checkout-api:evidence", evidence);
  const publicPath = url.pathname === "/v1/categories/tree" || url.pathname.startsWith("/v1/products") || url.pathname === "/v1/inventory";
  if (!publicPath && !authorized) {
    evidence.rejectedAuth += 1;
    await save();
    return problem(res, 401, "UNAUTHENTICATED", "A valid access token is required.");
  }
  if (url.pathname === "/v1/inventory") return json(res, envelope((url.searchParams.get("skuIds") || "").split(",").filter(Boolean).map((skuId) => ({ skuId, available: 100 }))));
  if (url.pathname === "/v1/vouchers/me") return json(res, list([]));
  if (url.pathname === "/v1/carts/me/pricing") { const subtotal = (await currentItems()).reduce((sum, item) => sum + item.unitPrice * item.quantity, 0); return json(res, envelope({ subtotal, taxAmount: 0, discountAmount: 0, estimatedShippingFee: null, total: subtotal, vouchers: [] })); }
  if (url.pathname === "/v1/users/me") {
    await save();
    return json(res, envelope(options.emptyProfile ? { ...user, fullName: "", phone: "", address: null } : user));
  }
  if (url.pathname === "/v1/carts/me" && req.method === "GET") {
    await save();
    return json(res, envelope({ id: "40000000-0000-4000-8000-000000000001", userId: user.id, status: "ACTIVE", items: options.emptyCart || evidence.groups.length ? [] : await currentItems() }));
  }
  if (url.pathname === "/v1/categories/tree") {
    await save();
    return json(res, list([]));
  }
  const item = items.find((entry) => url.pathname === `/v1/products/${entry.productId}`);
  if (item) {
    await save();
    if (options.metadataFailure) return problem(res, 503, "CATALOG_UNAVAILABLE", "Product details are temporarily unavailable.");
    return json(res, envelope({
      id: item.productId,
      name: productName(item),
      slug: `audio-${item.productId}`, categoryId: "electronics", sellerId: item === items[0] ? "seller-1" : "seller-2",
      status: "ACTIVE", minPrice: 999999, description: "Optional catalog metadata; cart prices remain authoritative.",
      auctionEnable: false,
      skus: [{ id: item.skuId, productId: item.productId, skuCode: "AUDIO", color: "Silver", size: null, price: 999999, status: "ACTIVE" }],
      images: [],
    }));
  }
  if (url.pathname === "/v1/shipping/provinces") {
    await save();
    return json(res, list(provinces));
  }
  if (url.pathname === "/v1/shipping/wards") {
    await save();
    if (options.wardsFailure) return problem(res, 503, "SHIPPING_UNAVAILABLE", "Wards are temporarily unavailable.");
    return json(res, list(wards[url.searchParams.get("provinceCode")] || []));
  }
  if (url.pathname === "/v1/checkout/preview" && req.method === "POST") {
    const body = bodyOf(req);
    evidence.previews.push(body);
    await save();
    if (options.slowWard && body.shippingAddress?.wardCode === "20308")
      await new Promise((resolve) => setTimeout(resolve, 1400));
    const completed = currentEvidence;
    completed.completedPreviews.push(body.shippingAddress?.wardCode);
    if (completed.groups.length) {
      completed.consumedCartPreviews += 1;
      await pm.state.set("checkout-api:evidence", completed);
      return problem(res, 409, "COMMERCE_CART_EMPTY", "Your cart has already been checked out.");
    }
    await pm.state.set("checkout-api:evidence", completed);
    if (options.previewFailure) return problem(res, 503, "SHIPPING_UNAVAILABLE", "Shipping quotes are temporarily unavailable.");
    if (options.fieldError) return problem(res, 400, "VALIDATION_FAILED", "Please check your shipping address.", [
      { field: "shippingAddress.phoneNumber", code: "VALIDATION_PATTERN", detail: "Enter a reachable Vietnamese phone number." },
    ]);
    const address = body.shippingAddress || {};
    const required = ["recipientName", "phoneNumber", "addressLine", "provinceCode", "wardCode", "countryCode"];
    const invalid = required.filter((field) => typeof address[field] !== "string" || !address[field].trim());
    if (body.paymentMethod !== "SEPAY" || invalid.length)
      return problem(res, 400, "VALIDATION_FAILED", "All shipping fields are required.", invalid.map((field) => ({ field: `shippingAddress.${field}`, code: "VALIDATION_NOT_BLANK", detail: "This field is required." })));
    const shippingFee = options.nullShippingFee ? null : address.wardCode === "20309" ? 45000 : 30000;
    const cartItems = await currentItems();
    const subtotal = options.changedPreview ? 500000 : cartItems.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
    const preview = {
      items: cartItems.map((entry) => ({ itemId: entry.id, productId: entry.productId, skuId: entry.skuId, quantity: entry.quantity, unitPrice: entry.unitPrice, lineTotal: entry.unitPrice * entry.quantity })),
      subtotal, shippingFee, taxAmount: 0, discountAmount: 0,
      total: subtotal + (shippingFee || 0), issues: [],
    };
    return json(res, options.malformedPreview ? { ...envelope(preview), data: { ...preview, total: "invalid" } } : envelope(preview));
  }
  if (url.pathname.startsWith('/v1/orders/groups/') && req.method === 'GET') {
    const group = evidence.groups.find(entry => url.pathname === '/v1/orders/groups/' + entry.group.orderGroupId);
    await save();
    return group ? json(res, envelope(group.group)) : problem(res, 404, 'COMMERCE_ORDER_GROUP_NOT_FOUND', 'No such order group.');
  }
  if (url.pathname === '/v1/payments' && req.method === 'POST') {
    const body = bodyOf(req);
    const group = evidence.groups.find(entry => entry.group.orderGroupId === body.orderGroupId);
    if (!group) return problem(res, 404, 'PAYMENT_SESSION_NOT_FOUND', 'No group exists for this payment.');
    const now = Date.now();
    group.payment ||= {
      sessionId: 'ec2a083f-868b-4d3e-9dda-1904a9c7bbdd',
      qrImageUrl: 'http://127.0.0.1:' + (process.env.NEXUS_CHECKOUT_API_PORT || '3923') + '/api/test/qr.svg',
      bankAccount: '0000000002', amount: group.group.totalAmount,
      memoCode: 'NX20261106001', transferContent: 'SEVQR NX20261106001',
      expiresAt: new Date(now + 600000).toISOString(),
    };
    await save();
    return json(res, envelope({ ...group.payment, serverNow: new Date(now).toISOString() }), 201);
  }
  if (url.pathname === "/v1/orders" && req.method === "POST") {
    const run = orderTail.then(() => placeOrder(req, res, options));
    orderTail = run.catch(() => {});
    return run;
  }
  await save();
  return json(res, { title: "Fixture endpoint not implemented", status: 501, path: url.pathname }, 501);
});
server.listen(process.env.PORT);
