import assert from "node:assert/strict";
import { test } from "node:test";
import { isApiError } from "../configs/api";
import { changeManagedOrderStatus, completeOrderRefund, createManagedShipment, getManagedOrders, getManagedPayments, getOrderRefunds, getRefundEvidence, parseManagedShipment, parsePaymentTransaction, parseRefund, refundEvidenceError, requestOrderRefund, updateManagedShipment, uploadRefundEvidence } from "../service/supportOperationsService";
import type { ServiceRequestOptions } from "../types/commonRequestType";

const id = "a2300000-0000-4000-8000-000000000001";
const key = "a2300000-0000-4000-8000-000000000002";
const instant = "2026-11-17T08:00:00Z";
const shipment = { id, orderId: id, buyerId: id, warehouseId: id, carrier: "fake", serviceType: null, trackingCode: null, status: "CREATED", shippingFee: 10000.25, shippingInfo: {}, createdAt: instant, updatedAt: instant, version: 0 };
const receipt = { evidenceId: key, contentType: "application/pdf", sizeBytes: 31, bankReference: "FT2611190001", uploadedBy: id, uploadedAt: instant };
const refund = { refundId: id, orderId: id, amount: 10000.25, currency: "VND", status: "COMPLETED", reason: "Approved", requestedAt: instant, completedAt: instant, evidence: [receipt] };
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
test("refund evidence is parsed strictly and uploaded as multipart with a trimmed bank reference", async () => {
  assert.deepEqual(parseRefund(refund).evidence, [receipt]);
  assert.throws(() => parseRefund({ ...refund, evidence: undefined }), invalid);
  assert.throws(() => parseRefund({ ...refund, evidence: [receipt, receipt] }), invalid);
  assert.throws(() => parseRefund({ ...refund, evidence: [{ ...receipt, contentType: "text/plain" }] }), invalid);
  assert.throws(() => parseRefund({ ...refund, evidence: [receipt, { ...receipt, evidenceId: id }, { ...receipt, evidenceId: "a2300000-0000-4000-8000-000000000003" }, { ...receipt, evidenceId: "a2300000-0000-4000-8000-000000000004" }] }), invalid);
  const calls: { path: string; method?: string; body: unknown; accept: string | null }[] = [];
  const options: ServiceRequestOptions = { context: { getAccessToken: () => "current-user", fetch: async (input, init) => {
    calls.push({ path: String(input), method: init?.method, body: init?.body, accept: new Headers(init?.headers).get("accept") });
    if (String(input).includes(`/evidence/${key}`)) return new Response(new Blob(["%PDF"], { type: "application/pdf" }), { headers: { "Content-Type": "application/pdf" } });
    return Response.json({ code: 0, message: "response success", data: { ...refund, status: "REQUESTED", completedAt: null } });
  } } };
  const pdf = new File(["%PDF-1.4"], "receipt.pdf", { type: "application/pdf" });
  const result = await uploadRefundEvidence(id, { file: pdf, bankReference: "  FT2611190001 " }, options);
  assert.equal(result.evidence.length, 1);
  assert.equal(calls[0].method, "POST"); assert.match(calls[0].path, new RegExp(`/api/v1/refunds/${id}/evidence$`));
  assert.ok(calls[0].body instanceof FormData); assert.equal((calls[0].body as FormData).get("bankReference"), "FT2611190001");
  assert.equal(((calls[0].body as FormData).get("file") as File).name, "receipt.pdf");
  assert.equal((await getRefundEvidence(id, key, options)).type, "application/pdf");
  assert.match(String(calls[1].accept), /application\/pdf/);
  await assert.rejects(uploadRefundEvidence(id, { file: pdf, bankReference: "   " }, options), invalid);
  await assert.rejects(uploadRefundEvidence(id, { file: new File(["x"], "notes.txt", { type: "text/plain" }), bankReference: "FT" }, options), invalid);
  await assert.rejects(getRefundEvidence(id, "not-a-uuid", options), invalid);
  assert.equal(calls.length, 2);
  assert.equal(refundEvidenceError(pdf, 3), "A refund keeps at most 3 transfer receipts.");
  assert.equal(refundEvidenceError(new File([], "empty.pdf", { type: "application/pdf" }), 0), "empty.pdf is empty.");
  assert.equal(refundEvidenceError(pdf, 2), null);
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
