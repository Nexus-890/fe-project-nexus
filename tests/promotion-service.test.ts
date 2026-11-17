import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { isApiError } from "../configs/api";
import { getCheckoutPreview, placeOrder } from "../service/checkoutService";
import { changeEventStatus, changeVoucherStatus, claimVoucher, getClaimableVouchers, getManagedVouchers, getVoucherPricing, getVoucherEligibility, getVoucherWallet, joinEventVoucher, parseVoucherQuotes, savePromotionEvent, saveVoucher, setVoucherProducts, withdrawEventVoucher, withdrawFromEvent } from "../service/promotionService";
import { at, buyerId, envelope, eventId, eventInput, managedVoucher, pageEnvelope, publicVoucher, sellerId, voucherId, voucherInput, walletEntry } from "./promotion-fixtures";

test("promotion services serialize authenticated writes, current terms, selected products, pagination and public reads over HTTP", async () => {
  const seen: { method?: string; path?: string; auth?: string; body: unknown }[] = [];
  const server = createServer(async (req, res) => {
    let body = ""; for await (const chunk of req) body += chunk;
    seen.push({ method: req.method, path: req.url, auth: req.headers.authorization, body: body ? JSON.parse(body) : null });
    if (req.method === "DELETE") { res.writeHead(204); res.end(); return; }
    let data: unknown = managedVoucher();
    if (req.url?.includes("promotions")) data = { ...eventInput, id: eventId, status: "DRAFT", registrationOpenRequested: false, createdAt: at, updatedAt: at };
    if (req.url?.endsWith("/sellers")) data = { id: voucherId, voucherId, eventSellerId: eventId, status: "ACTIVE", acceptedTermsVersion: 3, sellerFundingPercentSnapshot: 25, acceptedAt: at };
    if (req.url?.endsWith("/claim")) data = walletEntry();
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(req.method === "GET" ? pageEnvelope(req.url?.startsWith("/api/v1/vouchers/manage") ? [managedVoucher()] : req.url?.startsWith("/api/v1/vouchers/me") ? [walletEntry()] : [publicVoucher()], req.url?.includes("page=2") ? 2 : 0, 25) : envelope(data)));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve)); const address = server.address(); assert.ok(address && typeof address !== "string");
  let token = "first"; const options = { context: { baseUrl: `http://127.0.0.1:${address.port}`, getAccessToken: () => token } };
  try {
    await savePromotionEvent(undefined, eventInput, options); await changeEventStatus(eventId, "OPEN", options);
    await saveVoucher(undefined, voucherInput, options); await saveVoucher(voucherId, voucherInput, options); await changeVoucherStatus(voucherId, "ACTIVE", options);
    await setVoucherProducts(voucherId, [eventId], options); await joinEventVoucher(voucherId, 3, options);
    await withdrawEventVoucher(voucherId, options); await withdrawFromEvent(eventId, options); await claimVoucher(voucherId, options);
    token = "second";
    assert.equal((await getManagedVouchers({ page: 2, sourceType: "EVENT", eventId }, options)).page.totalElements, 25);
    await getVoucherWallet({ status: "USED" }, options); await getClaimableVouchers({ productId: eventId }, options);
    assert.deepEqual(seen[0], { method: "POST", path: "/api/v1/promotions/events", auth: "Bearer first", body: eventInput });
    assert.deepEqual(seen[1].body, { status: "OPEN" }); assert.deepEqual(seen[2].body, voucherInput);
    assert.equal(seen[3].method, "PUT"); assert.equal(seen[4].method, "PATCH"); assert.deepEqual(seen[5].body, { productIds: [eventId] });
    assert.deepEqual(seen[6].body, { acceptedTermsVersion: 3 }); assert.equal(seen[7].method, "DELETE"); assert.equal(seen[8].method, "DELETE");
    assert.ok(seen[10].path?.includes("sourceType=EVENT")); assert.equal(seen[10].auth, "Bearer second"); assert.equal(seen[12].auth, undefined);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
});

test("voucher pricing keeps repeated codes, explicit clearing and all server rejection reasons", async () => {
  const seen: string[] = [];
  const reasons = ["MIN_ORDER_NOT_MET", "NOT_CLAIMED", "EXPIRED", "LIMIT_REACHED", "NOT_ELIGIBLE", "STACKING"] as const;
  const context = { baseUrl: "http://fixture.invalid", fetch: async (input: string | URL | Request) => {
    seen.push(String(input)); return new Response(JSON.stringify(envelope({ subtotal: 100000, taxAmount: 0, discountAmount: 0, estimatedShippingFee: null, total: 100000,
      vouchers: reasons.map((reason) => ({ code: reason, applied: false, discountAmount: 0, reason, missingAmount: reason === "MIN_ORDER_NOT_MET" ? 50000 : null })) })), { headers: { "Content-Type": "application/json" } });
  } };
  const result = await getVoucherPricing(["PLATFORM50", "SHOP10"], { context }); await getVoucherPricing([], { context });
  assert.ok(seen[0].endsWith("?voucherCodes=PLATFORM50&voucherCodes=SHOP10")); assert.ok(seen[1].endsWith("?voucherCodes="));
  assert.deepEqual(result.vouchers.map((v) => v.reason), reasons); assert.equal(result.vouchers[0].missingAmount, 50000);
  assert.throws(() => parseVoucherQuotes([{ code: "X", applied: true, discountAmount: -1 }]));
  assert.throws(() => parseVoucherQuotes([{ code: "X", applied: false, discountAmount: 0, reason: "UNKNOWN" }]));
});

test("claim conflicts, ownership failures, malformed pages and cancellation remain actionable failures", async () => {
  for (const [status, code] of [[409, "COMMERCE_VOUCHER_ALREADY_CLAIMED"], [403, "FORBIDDEN"], [409, "COMMERCE_VOUCHER_CLAIM_LIMIT_REACHED"]] as const) {
    const context = { baseUrl: "http://fixture.invalid", fetch: async () => new Response(JSON.stringify({ status, code, title: "Rejected", detail: code }), { status }) };
    await assert.rejects(claimVoucher(voucherId, { context }), (error: unknown) => isApiError(error) && error.status === status && error.code === code);
  }
  const context = { baseUrl: "http://fixture.invalid", fetch: async () => new Response(JSON.stringify(envelope([managedVoucher()]))) };
  await assert.rejects(getManagedVouchers({}, { context }), (error: unknown) => isApiError(error) && error.kind === "invalid-response");
  const controller = new AbortController(); controller.abort(); await assert.rejects(getVoucherWallet({}, { context, signal: controller.signal }));
});

test("unselected wallet candidates are evaluated independently, and stacking uses the real selection", async () => {
  const context = { baseUrl: "http://fixture.invalid", fetch: async (input: string | URL | Request) => {
    const codes = new URL(String(input)).searchParams.getAll("voucherCodes").filter(Boolean);
    const vouchers = codes.map((code, i) => ({ code, applied: i === 0, discountAmount: i === 0 ? 10000 : 0, reason: i === 0 ? null : "STACKING" }));
    return new Response(JSON.stringify(envelope({ subtotal: 100000, taxAmount: 0, discountAmount: codes.length ? 10000 : 0, estimatedShippingFee: null, total: codes.length ? 90000 : 100000, vouchers })));
  } };
  assert.deepEqual((await getVoucherEligibility([], ["A", "B"], { context })).map((row) => row.applied), [true, true]);
  const quotes = await getVoucherEligibility(["A"], ["A", "B"], { context });
  assert.equal(quotes[0].applied, true); assert.equal(quotes[1].reason, "STACKING");
});

test("checkout preview and order POST carry exactly the same selected voucher intent and order idempotency key", async () => {
  const seen: { path: string; body: Record<string, unknown>; key: string | null }[] = [];
  const productId = "a2250000-0000-4000-8000-000000000001", skuId = "a2250000-0000-4000-8000-000000000002";
  const item = { itemId: voucherId, productId, skuId, quantity: 1, unitPrice: 200000, lineTotal: 200000 };
  const context = { baseUrl: "http://fixture.invalid", fetch: async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input); const body = JSON.parse(String(init?.body)); const headers = new Headers(init?.headers); seen.push({ path, body, key: headers.get("Idempotency-Key") });
    const data = path.endsWith("preview") ? { items: [item], subtotal: 200000, shippingFee: 10000, taxAmount: 0, discountAmount: 50000, total: 160000, issues: [], vouchers: [{ code: "NEXUS50", applied: true, discountAmount: 50000 }] }
      : { orderGroupId: eventId, status: "PENDING", currency: "VND", dueAt: "2026-12-01T00:00:00Z", totalAmount: 160000, orders: [{ orderId: voucherId, orderNumber: "NX-1", userId: buyerId, sellerId, orderType: "STANDARD", status: "PENDING", createdAt: at, totalAmount: 160000, items: [{ ...item, orderItemId: voucherId, productName: "Headphones", skuCode: "HEAD-1", imageUrl: null, totalPrice: 200000 }] }] };
    return new Response(JSON.stringify(envelope(data)), { headers: { "Content-Type": "application/json" } });
  } };
  const destination = { recipientName: "Buyer", phoneNumber: "0901234567", addressLine: "1 Street", provinceCode: "202", wardCode: "20308", city: "HCM", ward: "Ward 1", countryCode: "VN" as const, voucherCodes: ["NEXUS50"] };
  assert.equal((await getCheckoutPreview(destination, { context })).vouchers?.[0].applied, true);
  assert.equal((await placeOrder(destination, eventId, { context })).totalAmount, "160000.00");
  assert.deepEqual(seen[0].body, seen[1].body); assert.deepEqual(seen[0].body.voucherCodes, ["NEXUS50"]); assert.equal(seen[1].key, eventId);
  await getCheckoutPreview({ ...destination, voucherCodes: [] }, { context }); assert.deepEqual(seen[2].body.voucherCodes, []);
});
