import assert from "node:assert/strict";
import { test } from "node:test";
import { isApiError } from "../configs/api";
import { changeManagedOrderStatus, completeOrderRefund, createManagedShipment, getManagedOrders, getManagedPayments, getOrderRefunds, parseManagedShipment, parsePaymentTransaction, requestOrderRefund, updateManagedShipment } from "../service/supportOperationsService";
import type { ServiceRequestOptions } from "../types/commonRequestType";

const id = "a2300000-0000-4000-8000-000000000001";
const key = "a2300000-0000-4000-8000-000000000002";
const instant = "2026-11-17T08:00:00Z";
const shipment = { id, orderId: id, buyerId: id, warehouseId: id, carrier: "fake", serviceType: null, trackingCode: null, status: "CREATED", shippingFee: 10000.25, shippingInfo: {}, createdAt: instant, updatedAt: instant, version: 0 };
const refund = { refundId: id, orderId: id, amount: 10000.25, currency: "VND", status: "COMPLETED", reason: "Approved", requestedAt: instant, completedAt: instant };
const payment = { transactionId: id, orderGroupId: id, provider: "SEPAY", providerReference: null, amount: 10000.25, currency: "VND", status: "UNRECONCILED", type: "NORMAL", receivedAt: instant };
const invalid = (error: unknown) => isApiError(error) && error.kind === "invalid-response";
const fixture = (data: unknown, paged = false) => {
  const calls: { path: string; method?: string; body: unknown; headers: Headers; signal: AbortSignal | null | undefined }[] = [];
  const options: ServiceRequestOptions = { context: { getAccessToken: () => "current-user", fetch: async (input, init) => {
    calls.push({ path: String(input), method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined, headers: new Headers(init?.headers), signal: init?.signal });
    return Response.json({ code: 0, message: "response success", data, ...(paged ? { page: { number: 0, size: 10, totalElements: Array.isArray(data) ? data.length : 1, totalPages: 1 } } : {}) });
  } } };
  return { calls, options };
};
test("operations sends delivered filters and private auth and keeps sibling page metadata", async () => {
  const { calls, options } = fixture([payment], true);
  const result = await getManagedPayments({ status: "UNRECONCILED", page: 0, size: 10 }, options);
  assert.equal(result.content[0].amount, 10000.25);
  assert.match(calls[0].path, /status=UNRECONCILED/); assert.equal(calls[0].headers.get("authorization"), "Bearer current-user"); assert.equal(result.totalElements, 1);
  await assert.rejects(getManagedOrders({ userId: "invalid" }, options), invalid);
  assert.equal(calls.length, 1);
});
test("refund POST captures a required key and completion uses its own bodyless POST", async () => {
  const { calls, options } = fixture(refund);
  await requestOrderRefund({ orderId: id, reason: " Approved ", amount: 10000.25 }, key, options);
  await completeOrderRefund(id, options);
  assert.equal(calls[0].headers.get("idempotency-key"), key);
  assert.deepEqual(calls[0].body, { orderId: id, reason: "Approved", amount: 10000.25 });
  assert.match(calls[0].path, /\/api\/v1\/refunds$/); assert.match(calls[1].path, /\/refunds\/.*\/complete$/); assert.equal(calls[1].method, "POST"); assert.equal(calls[1].body, undefined);
});
test("shipment creation, update and override retain the exact service split and wire methods", async () => {
  const { calls, options } = fixture(shipment);
  await createManagedShipment({ orderId: id }, key, options);
  await updateManagedShipment(id, { status: "PACKED", reason: " Prepared " }, false, options);
  await updateManagedShipment(id, { status: "DELIVERED", reason: "Verified carrier evidence" }, true, options);
  assert.deepEqual(calls.map((c) => c.method), ["POST", "PATCH", "POST"]);
  assert.match(calls[0].path, /\/api\/v1\/shipments$/); assert.match(calls[1].path, /\/status$/); assert.match(calls[2].path, /\/override$/);
  assert.deepEqual(calls[1].body, { status: "PACKED", reason: "Prepared" });
  assert.equal(calls[0].headers.get("idempotency-key"), key);
});
test("operations rejects malformed money, enums, references, pages and reasons", async () => {
  assert.throws(() => parsePaymentTransaction({ ...payment, amount: 1.234 }), invalid);
  assert.throws(() => parseManagedShipment({ ...shipment, status: "FUTURE" }), invalid);
  assert.throws(() => parseManagedShipment({ ...shipment, shippingFee: -1 }), invalid);
  const { calls, options } = fixture(shipment);
  await assert.rejects(updateManagedShipment(id, { status: "PACKED", reason: " " }, true, options), invalid);
  await assert.rejects(requestOrderRefund({ orderId: id, reason: "Approved", amount: -1 }, key, options), invalid);
  await assert.rejects(createManagedShipment({ orderId: "bad" }, key, options), invalid);
  assert.equal(calls.length, 0);
  const mismatch = fixture([{ ...refund, orderId: key }], true);
  await assert.rejects(getOrderRefunds(id, mismatch.options), invalid);
});
test("409 keeps symbolic transition code and all field details", async () => {
  const options: ServiceRequestOptions = { context: { fetch: async () => Response.json({ code: "COMMERCE_ILLEGAL_TRANSITION", title: "Conflict", detail: "The order status transition is not allowed", errors: [{ field: "reason", code: "VALIDATION_SIZE", detail: "Too long" }] }, { status: 409 }) } };
  await assert.rejects(changeManagedOrderStatus(id, { status: "SHIPPED", reason: "Approved" }, options), (error) => isApiError(error) && error.status === 409 && error.code === "COMMERCE_ILLEGAL_TRANSITION" && error.fieldErrors?.reason[0] === "Too long");
});
test("a changed session rejects a late operations response", async () => {
  let session = 1;
  const options: ServiceRequestOptions = { context: { getAccessToken: () => "current-user", getSessionId: () => session, fetch: async () => { session++; return Response.json({ code: 0, message: "response success", data: [payment], page: { number: 0, size: 10, totalElements: 1, totalPages: 1 } }); } } };
  await assert.rejects(getManagedPayments({}, options), (error) => isApiError(error) && error.kind === "aborted");
});
