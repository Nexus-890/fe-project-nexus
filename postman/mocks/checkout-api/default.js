/* Local #150 dependency fixture. Shipping and preview contracts are provisional;
 * their fees/localities model scenarios, not a live carrier quote. The simulation
 * removes its /api routeKey before this handler receives /v1/... requests.
 */
const http = require("node:http");
const { createHash } = require("node:crypto");

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
const districts = {
  "202": [{ code: "1442", name: "District 4" }, { code: "1443", name: "District 1" }],
  "201": [{ code: "1542", name: "Ba Dinh" }],
};
const wards = {
  "1442": [{ code: "20308", name: "Ward 4" }, { code: "20309", name: "Ward 5" }],
  "1443": [{ code: "20310", name: "Ben Nghe" }],
  "1542": [{ code: "20701", name: "Phuc Xa" }],
};
const defaults = () => ({
  emptyProfile: false, emptyCart: false, previewFailure: false,
  malformedPreview: false, nullShippingFee: false, fieldError: false,
  districtsFailure: false, wardsFailure: false, slowWard: false,
  metadataFailure: false, changedPreview: false,
});
const initialEvidence = () => ({ requests: [], previews: [], completedPreviews: [], orderRequests: 0, rejectedAuth: 0 });
const envelope = (data, page) => ({ code: 0, message: "response success", data, ...(page ? { page } : {}) });
const list = (data) => envelope(data, { number: 0, size: Math.max(1, data.length), totalElements: data.length, totalPages: data.length ? 1 : 0 });

function json(res, body, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}
function problem(res, status, code, detail, errors) {
  res.writeHead(status, { "Content-Type": "application/problem+json", "Cache-Control": "no-store" });
  res.end(JSON.stringify({
    type: `urn:problem:${code.toLowerCase().replaceAll("_", "-")}`,
    title: status === 400 ? "Validation Failed" : "Service Unavailable",
    status, code, detail, instance: "/api/v1/checkout/preview", ...(errors ? { errors } : {}),
  }));
}
function bodyOf(req) {
  return typeof req.body === "object" && req.body ? req.body : JSON.parse(req.body || "{}");
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:3103");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return json(res, {});
  const url = new URL(req.url, "http://127.0.0.1:3913");
  if (url.pathname === "/health") return json(res, { ready: true });
  if (url.pathname === "/test/reset") {
    await pm.state.set("checkout-api:options", defaults());
    await pm.state.set("checkout-api:evidence", initialEvidence());
    return json(res, { ready: true });
  }
  const options = await pm.state.get("checkout-api:options") || defaults();
  if (url.pathname === "/test/options" && req.method === "POST") {
    const next = { ...options, ...bodyOf(req) };
    await pm.state.set("checkout-api:options", next);
    return json(res, next);
  }
  const evidence = await pm.state.get("checkout-api:evidence") || initialEvidence();
  if (url.pathname === "/test/evidence") return json(res, evidence);
  const authorization = req.headers.authorization || "";
  const expectedHash = await pm.state.get("oidc-keycloak:access-token-hash");
  const authorized = Boolean(authorization.startsWith("Bearer ") && expectedHash
    && createHash("sha256").update(authorization.slice(7)).digest("hex") === expectedHash);
  evidence.requests.push({ method: req.method, path: url.pathname, query: url.search, authorized });
  const save = () => pm.state.set("checkout-api:evidence", evidence);
  const publicPath = url.pathname === "/v1/categories/tree" || url.pathname.startsWith("/v1/products");
  if (!publicPath && !authorized) {
    evidence.rejectedAuth += 1;
    await save();
    return problem(res, 401, "UNAUTHENTICATED", "A valid access token is required.");
  }
  if (url.pathname === "/v1/users/me") {
    await save();
    return json(res, envelope(options.emptyProfile ? { ...user, fullName: "", phone: "", address: null } : user));
  }
  if (url.pathname === "/v1/carts/me" && req.method === "GET") {
    await save();
    return json(res, envelope({ id: "40000000-0000-4000-8000-000000000001", userId: user.id, status: "ACTIVE", items: options.emptyCart ? [] : items }));
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
      name: item === items[0] ? "Studio headphones in silver" : "Wireless earbuds with charging case",
      slug: `audio-${item.productId}`, categoryId: "electronics", sellerId: "seller-1",
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
  if (url.pathname === "/v1/shipping/districts") {
    await save();
    if (options.districtsFailure) return problem(res, 503, "SHIPPING_UNAVAILABLE", "Districts are temporarily unavailable.");
    return json(res, list(districts[url.searchParams.get("provinceCode")] || []));
  }
  if (url.pathname === "/v1/shipping/wards") {
    await save();
    if (options.wardsFailure) return problem(res, 503, "SHIPPING_UNAVAILABLE", "Wards are temporarily unavailable.");
    return json(res, list(wards[url.searchParams.get("districtCode")] || []));
  }
  if (url.pathname === "/v1/checkout/preview" && req.method === "POST") {
    const body = bodyOf(req);
    evidence.previews.push(body);
    await save();
    if (options.slowWard && body.shippingAddress?.ward === "Ward 4")
      await new Promise((resolve) => setTimeout(resolve, 1400));
    const completed = await pm.state.get("checkout-api:evidence") || initialEvidence();
    completed.completedPreviews.push(body.shippingAddress?.ward);
    await pm.state.set("checkout-api:evidence", completed);
    if (options.previewFailure) return problem(res, 503, "SHIPPING_UNAVAILABLE", "Shipping quotes are temporarily unavailable.");
    if (options.fieldError) return problem(res, 400, "VALIDATION_FAILED", "Please check your shipping address.", [
      { field: "shippingAddress.phoneNumber", code: "VALIDATION_PATTERN", detail: "Enter a reachable Vietnamese phone number." },
    ]);
    const address = body.shippingAddress || {};
    const required = ["recipientName", "phoneNumber", "addressLine", "city", "district", "ward", "countryCode"];
    const invalid = required.filter((field) => typeof address[field] !== "string" || !address[field].trim());
    if (body.paymentMethod !== "SEPAY" || invalid.length)
      return problem(res, 400, "VALIDATION_FAILED", "All shipping fields are required.", invalid.map((field) => ({ field: `shippingAddress.${field}`, code: "VALIDATION_NOT_BLANK", detail: "This field is required." })));
    const shippingFee = options.nullShippingFee ? null : address.ward === "Ward 5" ? 45000 : 30000;
    const subtotal = options.changedPreview ? 500000 : 425000;
    const preview = {
      items: items.map((entry) => ({ itemId: entry.id, productId: entry.productId, skuId: entry.skuId, quantity: entry.quantity, unitPrice: entry.unitPrice, lineTotal: entry.unitPrice * entry.quantity })),
      subtotal, shippingFee, taxAmount: 0, discountAmount: 0,
      total: subtotal + (shippingFee || 0), issues: [],
    };
    return json(res, options.malformedPreview ? { ...envelope(preview), data: { ...preview, total: "invalid" } } : envelope(preview));
  }
  if (url.pathname === "/v1/orders" && req.method === "POST") {
    evidence.orderRequests += 1;
    await save();
    return problem(res, 501, "NOT_IMPLEMENTED", "Order creation belongs to #151.");
  }
  await save();
  return json(res, { title: "Fixture endpoint not implemented", status: 501, path: url.pathname }, 501);
});
server.listen(process.env.PORT);
