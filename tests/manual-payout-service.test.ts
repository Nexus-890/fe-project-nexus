import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { isApiError } from "../configs/api";
import {
  checkManualPayoutReadiness, claimManualPayout, confirmManualPayout, getManualPayoutCapabilities, getManualPayoutDetail, getManualPayoutEvidence, getManualPayoutQr, getManualPayouts,
  issueManualPayoutQr, manualPayoutErrorMessage, parseManualPayoutDetail, parseManualPayoutSummary, releaseManualPayoutClaim, reportManualPayoutProblem, resolveManualPayout,
  retryManualPayout, reviewReceiptDispute, uploadManualPayoutEvidence,
} from "../service/manualPayoutService";
import { confirmPayoutReceipt, disputePayoutReceipt } from "../service/sellerPayoutReceiptService";
import { parseSellerPayout } from "../service/payoutService";
import { combineQueueFilters, evidenceFileError, parseConfirmationForm, parseQueueForm, parseResolutionForm, parseSellerDisputeForm, secondsUntil, serverOffset } from "../features/manualPayoutSchema";

const id = "97000000-0000-4000-8000-000000000001";
const orderId = "97000000-0000-4000-8000-000000000002";
const sellerId = "68000000-0000-4000-8000-000000000002";
const staffId = "68000000-0000-4000-8000-000000000004";
const attemptId = "97000000-0000-4000-8000-000000000003";
const evidenceId = "97000000-0000-4000-8000-000000000004";
const sourceId = "97000000-0000-4000-8000-000000000005";
const disputeId = "97000000-0000-4000-8000-000000000006";
const at = "2026-11-18T03:00:00Z";
const summary = { id, orderId, sellerId, status: "PENDING", executionMode: "MANUAL", netAmount: "95000.00", currency: "VND", version: 2, claimedBy: null, claimedByMe: false,
  receiptStatus: null, hasOpenDispute: false, needsReview: false, blockedReason: null, createdAt: at };
const detail = { ...summary, orderAmount: "100000.00", shippingFee: "5000.00", platformFeeRate: "0.0000", platformFee: "0.00", confirmationSource: null,
  recipient: { bankName: "Vietcombank", holderName: "NGUYEN VAN A", accountLast4: "0123" }, serverTime: at, attempt: null, dispute: null, allowedActions: ["CLAIM"], history: [] };
const attempt = { id: attemptId, attemptNo: 1, state: "CLAIMED", version: 0, ownerId: staffId, ownedByMe: true, reference: null, leaseExpiresAt: "2026-11-18T03:05:00Z", qrDeadline: null,
  receiptStatus: "NOT_REQUESTED", receiptVersion: 0, evidence: [], confirmation: null };
const claimed = { ...detail, status: "PROCESSING", claimedBy: staffId, claimedByMe: true, attempt, allowedActions: ["ISSUE_QR", "RELEASE"] };
const issued = { ...claimed, attempt: { ...attempt, state: "QR_ISSUED", version: 1, reference: "NEXUS-97000000-1", qrDeadline: "2026-11-18T03:10:00Z" }, allowedActions: ["VIEW_QR", "UPLOAD_EVIDENCE", "CONFIRM", "REPORT_PROBLEM"] };
const envelope = (data: unknown) => ({ code: 0, message: "response success", data });
const invalid = (error: unknown) => isApiError(error) && error.kind === "invalid-response";
type Call = { method?: string; path: string; query: URLSearchParams; headers: Headers; body: unknown };
const recorder = (respond: (call: Call) => Response) => {
  const calls: Call[] = [];
  const options = { context: { getAccessToken: () => "staff-token", fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://fixture.test");
    const body = init?.body instanceof FormData ? init.body : typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    const call = { method: init?.method, path: url.pathname, query: url.searchParams, headers: new Headers(init?.headers), body };
    calls.push(call); return respond(call);
  } } };
  return { calls, options };
};

test("manual queue serializes every filter, repeats statuses and rejects rows outside the requested view", async () => {
  const page = { number: 1, size: 20, totalElements: 21, totalPages: 2 };
  const { calls, options } = recorder(() => Response.json({ ...envelope([{ ...summary, status: "UNKNOWN", claimedBy: staffId, claimedByMe: true, needsReview: true }]), page }));
  const result = await getManualPayouts({ status: ["UNKNOWN", "SUCCEEDED"], claimedBy: "me", needsReview: true, from: "2026-11-01T00:00:00Z", to: "2026-11-30T23:59:59Z", page: 1 }, options);
  assert.equal(result.totalElements, 21);
  assert.equal(calls[0].path, "/api/v1/payments/manual-payouts");
  assert.deepEqual(calls[0].query.getAll("status"), ["UNKNOWN", "SUCCEEDED"]);
  assert.equal(calls[0].query.get("claimedBy"), "me"); assert.equal(calls[0].query.get("needsReview"), "true"); assert.equal(calls[0].query.get("size"), "20");
  assert.equal(calls[0].headers.get("Authorization"), "Bearer staff-token");
  await assert.rejects(getManualPayouts({ hasOpenDispute: true, page: 1 }, options), invalid);
  const auto = recorder(() => Response.json({ ...envelope([{ ...summary, executionMode: "AUTO" }]), page: { ...page, number: 0 } }));
  await assert.rejects(getManualPayouts({}, auto.options), invalid);
  for (const bad of [{ size: 101 }, { status: ["PENDING", "PENDING"] as const }, { sellerId: "seller" }, { from: "2026-11-02T00:00:00Z", to: "2026-11-01T00:00:00Z" }])
    await assert.rejects(getManualPayouts(bad, auto.options), invalid);
});

test("manual models keep exact decimal strings, separate states and refuse unsafe or inconsistent payloads", () => {
  assert.equal(parseManualPayoutSummary(summary).netAmount, "95000.00");
  for (const bad of [{ netAmount: 95000 }, { netAmount: "95000" }, { netAmount: "0.00" }, { netAmount: "9.5e4" }, { status: "ON_HOLD" }, { claimedByMe: true },
    { accountNumber: "0012340123" }, { executionMode: "HYBRID" }, { hasOpenDispute: true }])
    assert.throws(() => parseManualPayoutSummary({ ...summary, ...bad }), invalid);
  assert.equal(parseManualPayoutDetail(detail).recipient?.accountLast4, "0123");
  assert.equal(parseManualPayoutDetail(issued).attempt?.reference, "NEXUS-97000000-1");
  for (const bad of [{ shippingFee: "6000.00" }, { executionMode: "AUTO" }, { allowedActions: ["CLAIM", "CLAIM"] }, { allowedActions: ["SEND_MONEY"] },
    { recipient: { ...detail.recipient, accountLast4: "0012340123" } }, { status: "UNKNOWN", allowedActions: ["RETRY"] }, { status: "ON_HOLD", blockedReason: "Bank not verified", allowedActions: ["CLAIM"] }])
    assert.throws(() => parseManualPayoutDetail({ ...detail, ...bad }), invalid);
  assert.throws(() => parseManualPayoutDetail({ ...claimed, attempt: { ...attempt, ownedByMe: false } }), invalid);
  assert.throws(() => parseManualPayoutDetail({ ...issued, attempt: { ...issued.attempt, reference: null } }), invalid);
  assert.throws(() => parseManualPayoutDetail({ ...issued, status: "SUCCEEDED", attempt: { ...issued.attempt, state: "SUCCEEDED" }, allowedActions: [] }), invalid);
  const confirmation = { sourceAccountId: sourceId, amount: "95000.00", bankTransferReference: "FT2611180001", transferredAt: at, recordedAt: at };
  const succeeded = { ...issued, status: "SUCCEEDED", receiptStatus: "AWAITING_CONFIRMATION", confirmationSource: "MANUAL_STAFF_CONFIRMED", allowedActions: [],
    attempt: { ...issued.attempt, state: "SUCCEEDED", receiptStatus: "AWAITING_CONFIRMATION", confirmation } };
  assert.equal(parseManualPayoutDetail(succeeded).confirmationSource, "MANUAL_STAFF_CONFIRMED");
  assert.throws(() => parseManualPayoutDetail({ ...succeeded, confirmationSource: "PROVIDER_CONFIRMED" }), invalid);
  const step = { id: evidenceId, event: "STAFF_CONFIRMED", fromStatus: "PROCESSING", toStatus: "SUCCEEDED", attemptNo: 1, attemptState: "SUCCEEDED", amount: "95000.00", actorId: staffId,
    actorRole: "SUPPORT_STAFF", confirmationSource: "MANUAL_STAFF_CONFIRMED", reference: "FT2611180001", reason: null, simulated: true, occurredAt: at };
  assert.equal(parseManualPayoutDetail({ ...succeeded, history: [step] }).history[0].actorRole, "SUPPORT_STAFF");
  assert.throws(() => parseManualPayoutDetail({ ...succeeded, history: [{ ...step, event: "BANK_VERIFIED" }] }), invalid);
});

test("every write sends one UUID key and the exact expected version on its own route", async () => {
  const { calls, options } = recorder((call) => Response.json(envelope(call.path.endsWith("/claims") || call.path.endsWith("/readiness-check") ? claimed : call.path.endsWith("/release") ? claimed : issued)));
  const key = randomUUID();
  await claimManualPayout(id, { idempotencyKey: key, expectedVersion: 2 }, options);
  await checkManualPayoutReadiness(id, { idempotencyKey: randomUUID(), expectedVersion: 2 }, options);
  await issueManualPayoutQr(id, attemptId, { idempotencyKey: randomUUID(), expectedVersion: 0 }, options);
  await releaseManualPayoutClaim(id, attemptId, { idempotencyKey: randomUUID(), expectedVersion: 0 }, options);
  await confirmManualPayout(id, attemptId, { idempotencyKey: randomUUID(), expectedVersion: 1, body: { sourceAccountId: sourceId, amount: "95000.00", bankTransferReference: "FT2611180001", transferredAt: at, evidenceIds: [evidenceId] } }, options);
  await reportManualPayoutProblem(id, attemptId, { idempotencyKey: randomUUID(), expectedVersion: 1, body: { kind: "UNCERTAIN_OUTCOME", reason: "Bank app timed out", evidenceIds: [] } }, options);
  assert.deepEqual(calls.map((call) => call.path.replace(`/api/v1/payments/manual-payouts/${id}`, "")), ["/claims", "/readiness-check", `/attempts/${attemptId}/qr-issuances`,
    `/attempts/${attemptId}/release`, `/attempts/${attemptId}/confirmation`, `/attempts/${attemptId}/problems`]);
  assert.equal(calls[0].headers.get("Idempotency-Key"), key);
  assert.deepEqual(calls[0].body, { expectedPayoutVersion: 2 });
  assert.deepEqual(calls[2].body, { expectedAttemptVersion: 0 });
  assert.equal((calls[4].body as { amount: string }).amount, "95000.00");
  assert.ok(calls.every((call) => call.method === "POST" && /^[0-9a-f-]{36}$/.test(call.headers.get("Idempotency-Key") ?? "")));
  await assert.rejects(claimManualPayout(id, { idempotencyKey: "retry-1", expectedVersion: 2 }, options), invalid);
  await assert.rejects(claimManualPayout(id, { idempotencyKey: randomUUID(), expectedVersion: -1 }, options), invalid);
  await assert.rejects(confirmManualPayout(id, attemptId, { idempotencyKey: randomUUID(), expectedVersion: 1, body: { sourceAccountId: sourceId, amount: "95000", bankTransferReference: "FT", transferredAt: at, evidenceIds: [evidenceId] } }, options), invalid);
  await assert.rejects(confirmManualPayout(id, attemptId, { idempotencyKey: randomUUID(), expectedVersion: 1, body: { sourceAccountId: sourceId, amount: "95000.00", bankTransferReference: "FT", transferredAt: at, evidenceIds: [] } }, options), invalid);
  const otherAttempt = recorder(() => Response.json(envelope({ ...issued, attempt: { ...issued.attempt, id: evidenceId } })));
  await assert.rejects(issueManualPayoutQr(id, attemptId, { idempotencyKey: randomUUID(), expectedVersion: 0 }, otherAttempt.options), invalid);
});

test("admin-only commands validate outcome proof, the open case version and a retry reason", async () => {
  const unknown = { ...issued, status: "UNKNOWN", needsReview: true, attempt: { ...issued.attempt, state: "UNKNOWN" }, allowedActions: ["RESOLVE"] };
  const { calls, options } = recorder((call) => Response.json(envelope(call.path.endsWith("/retries") ? { ...detail, status: "PENDING" } : unknown)));
  await resolveManualPayout(id, attemptId, { idempotencyKey: randomUUID(), expectedVersion: 1, body: { outcome: "CONFIRMED_NOT_SENT", reason: "Bank statement shows no debit", evidenceIds: [evidenceId] } }, options);
  await assert.rejects(resolveManualPayout(id, attemptId, { idempotencyKey: randomUUID(), expectedVersion: 1, body: { outcome: "CONFIRMED_RETURNED", reason: "Returned", evidenceIds: [] } }, options), invalid);
  await assert.rejects(resolveManualPayout(id, attemptId, { idempotencyKey: randomUUID(), expectedVersion: 1, body: { outcome: "CONFIRMATION_RECORDED_IN_ERROR", reason: "No transfer", evidenceIds: [evidenceId] } }, options), invalid);
  await reviewReceiptDispute(id, attemptId, disputeId, { idempotencyKey: randomUUID(), expectedVersion: 1, body: { decision: "REQUEST_INFORMATION", note: "Send the bank SMS", expectedDisputeVersion: 0 } }, options);
  await retryManualPayout(id, { idempotencyKey: randomUUID(), expectedVersion: 4, body: { reason: "Reconciled as not sent" } }, options);
  await assert.rejects(retryManualPayout(id, { idempotencyKey: randomUUID(), expectedVersion: 4, body: { reason: " " } }, options), invalid);
  assert.equal(calls[1].path, `/api/v1/payments/manual-payouts/${id}/attempts/${attemptId}/receipt-disputes/${disputeId}/reviews`);
  assert.deepEqual(calls[2].body, { expectedPayoutVersion: 4, reason: "Reconciled as not sent" });
});

test("QR and evidence are binary reads through the shared boundary and reject problem bodies or wrong types", async () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const { calls, options } = recorder(() => new Response(png, { headers: { "Content-Type": "image/png", "Cache-Control": "no-store, private" } }));
  const qr = await getManualPayoutQr(id, attemptId, options);
  assert.equal(qr.type, "image/png"); assert.equal(qr.size, 8);
  assert.equal(calls[0].headers.get("Authorization"), "Bearer staff-token");
  assert.match(calls[0].headers.get("Accept") ?? "", /image\/png/);
  assert.equal(calls[0].query.size, 0);
  const html = recorder(() => new Response("<html></html>", { headers: { "Content-Type": "text/html" } }));
  await assert.rejects(getManualPayoutQr(id, attemptId, html.options), invalid);
  const problem = recorder(() => Response.json({ title: "Conflict", status: 409, code: "PAYMENT_MANUAL_PAYOUT_NOT_OWNER", detail: "Another executor owns this attempt" }, { status: 409, headers: { "Content-Type": "application/problem+json" } }));
  await assert.rejects(getManualPayoutQr(id, attemptId, problem.options), (error: unknown) => isApiError(error) && error.status === 409 && error.code === "PAYMENT_MANUAL_PAYOUT_NOT_OWNER");
  const pdf = recorder(() => new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), { headers: { "Content-Type": "application/pdf" } }));
  assert.equal((await getManualPayoutEvidence(id, attemptId, evidenceId, pdf.options)).type, "application/pdf");
  assert.equal(pdf.calls[0].path, `/api/v1/payments/manual-payouts/${id}/attempts/${attemptId}/evidence/${evidenceId}`);
});

test("evidence upload is multipart, bound to the attempt and limited to JPEG, PNG or PDF up to 10 MiB", async () => {
  const withEvidence = { ...issued, attempt: { ...issued.attempt, version: 2, evidence: [{ id: evidenceId, fileName: "transfer.png", contentType: "image/png", size: 8, uploadedAt: at }] } };
  const { calls, options } = recorder(() => Response.json(envelope(withEvidence), { status: 201 }));
  const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "transfer.png", { type: "image/png" });
  const result = await uploadManualPayoutEvidence(id, attemptId, file, { idempotencyKey: randomUUID(), expectedVersion: 1 }, options);
  assert.equal(result.attempt?.evidence[0].id, evidenceId);
  const form = calls[0].body as FormData;
  assert.equal(form.get("expectedAttemptVersion"), "1"); assert.equal((form.get("file") as File).name, "transfer.png");
  await assert.rejects(uploadManualPayoutEvidence(id, attemptId, new File(["x"], "a.gif", { type: "image/gif" }), { idempotencyKey: randomUUID(), expectedVersion: 1 }, options), invalid);
  await assert.rejects(uploadManualPayoutEvidence(id, attemptId, new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.pdf", { type: "application/pdf" }), { idempotencyKey: randomUUID(), expectedVersion: 1 }, options), invalid);
  assert.equal(calls.length, 1);
});

test("capabilities expose rollout state, and errors explain honest recovery without suggesting another transfer", async () => {
  const caps = { canExecute: true, canReconcile: false, newWorkEnabled: false, automaticJobsEnabled: false, serverTime: at, claimLeaseSeconds: 300, qrIssuanceSeconds: 600, sourceAccounts: [{ id: sourceId, alias: "Nexus payout VCB" }] };
  const { options } = recorder(() => Response.json(envelope(caps)));
  assert.equal((await getManualPayoutCapabilities(options)).newWorkEnabled, false);
  const bad = recorder(() => Response.json(envelope({ ...caps, canExecute: false, canReconcile: true })));
  await assert.rejects(getManualPayoutCapabilities(bad.options), invalid);
  const missing = recorder(() => Response.json({ title: "Not Found", status: 404 }, { status: 404 }));
  await assert.rejects(getManualPayoutDetail(id, missing.options), (error: unknown) => isApiError(error) && error.status === 404);
  assert.match(manualPayoutErrorMessage({ kind: "network", status: 0, title: "Network request failed" }), /do not transfer again/);
  assert.match(manualPayoutErrorMessage({ kind: "http", status: 503, title: "Unavailable" }), /No payout was changed/);
});

test("seller receipt commands target the owner route with receipt version, and old payouts default to automatic", async () => {
  const base = { id, orderId, sellerId, orderAmount: "100000.00", shippingFee: "5000.00", platformFeeRate: "0.0000", platformFee: "0.00", netAmount: "95000.00", currency: "VND",
    status: "SUCCEEDED", attemptCount: 1, recipientAccountLast4: "0123", providerReference: "FT2611180001", createdAt: at, simulated: true };
  assert.equal(parseSellerPayout({ ...base }).executionMode, "AUTO");
  assert.equal(parseSellerPayout({ ...base }).manualAttempt, null);
  const manualAttempt = { attemptId, attemptNo: 1, state: "SUCCEEDED", receiptStatus: "AWAITING_CONFIRMATION", receiptVersion: 0, staffConfirmedAt: at, sellerConfirmedAt: null, dispute: null, allowedSellerActions: ["CONFIRM_RECEIPT", "DISPUTE_RECEIPT"] };
  const manual = { ...base, executionMode: "MANUAL", confirmationSource: "MANUAL_STAFF_CONFIRMED", manualAttempt };
  assert.deepEqual(parseSellerPayout(manual).manualAttempt?.allowedSellerActions, ["CONFIRM_RECEIPT", "DISPUTE_RECEIPT"]);
  for (const bad of [{ executionMode: "AUTO" }, { manualAttempt: { ...manualAttempt, state: "CONFIRMATION_CORRECTED" } }, { manualAttempt: { ...manualAttempt, evidence: [] } },
    { manualAttempt: { ...manualAttempt, receiptStatus: "CONFIRMED" } }, { manualAttempt: { ...manualAttempt, allowedSellerActions: ["TRANSFER_AGAIN"] } }])
    assert.throws(() => parseSellerPayout({ ...manual, ...bad }), invalid);
  const confirmed = { ...manual, manualAttempt: { ...manualAttempt, receiptStatus: "CONFIRMED", receiptVersion: 1, sellerConfirmedAt: at, allowedSellerActions: ["DISPUTE_RECEIPT"] }, history: [] };
  const { calls, options } = recorder(() => Response.json(envelope(confirmed)));
  const key = randomUUID();
  assert.equal((await confirmPayoutReceipt(id, attemptId, { idempotencyKey: key, expectedReceiptVersion: 0 }, options)).manualAttempt?.receiptStatus, "CONFIRMED");
  await disputePayoutReceipt(id, attemptId, { idempotencyKey: randomUUID(), expectedReceiptVersion: 1, body: { reason: "CONFIRMATION_MISTAKE", explanation: "  Clicked too early  " } }, options);
  assert.equal(calls[0].path, `/api/v1/payments/payouts/${id}/manual-attempts/${attemptId}/receipt-confirmations`);
  assert.equal(calls[0].headers.get("Idempotency-Key"), key);
  assert.deepEqual(calls[0].body, { expectedReceiptVersion: 0 });
  assert.deepEqual(calls[1].body, { expectedReceiptVersion: 1, reason: "CONFIRMATION_MISTAKE", explanation: "Clicked too early" });
  await assert.rejects(disputePayoutReceipt(id, attemptId, { idempotencyKey: randomUUID(), expectedReceiptVersion: 1, body: { reason: "NOT_RECEIVED", explanation: "   " } }, options), invalid);
  await assert.rejects(disputePayoutReceipt(id, attemptId, { idempotencyKey: randomUUID(), expectedReceiptVersion: 1, body: { reason: "NOT_RECEIVED", explanation: "x".repeat(1001) } }, options), invalid);
  const other = recorder(() => Response.json(envelope({ ...confirmed, manualAttempt: { ...confirmed.manualAttempt, attemptId: evidenceId } })));
  await assert.rejects(confirmPayoutReceipt(id, attemptId, { idempotencyKey: randomUUID(), expectedReceiptVersion: 0 }, other.options), invalid);
  assert.equal(calls.length, 2);
});

test("admin resolution proof upload is allowed without ownership, other attempt actions are not", () => {
  const unknown = { ...issued, status: "UNKNOWN", needsReview: true, claimedByMe: false, attempt: { ...issued.attempt, state: "UNKNOWN", ownedByMe: false } };
  assert.deepEqual(parseManualPayoutDetail({ ...unknown, allowedActions: ["RESOLVE", "UPLOAD_EVIDENCE"] }).allowedActions, ["RESOLVE", "UPLOAD_EVIDENCE"]);
  assert.throws(() => parseManualPayoutDetail({ ...unknown, allowedActions: ["UPLOAD_EVIDENCE"] }), invalid);
  assert.throws(() => parseManualPayoutDetail({ ...unknown, allowedActions: ["RESOLVE", "CONFIRM"] }), invalid);
  assert.throws(() => parseManualPayoutDetail({ ...detail, allowedActions: ["RESOLVE"] }), invalid);
});

test("workspace forms validate exact values locally before any command is sent", () => {
  assert.deepEqual(parseQueueForm({ sellerId: ` ${sellerId} `, from: "2026-11-01", to: "2026-11-30", statuses: ["UNKNOWN", "SUCCEEDED"], receiptStatus: "DISPUTED" }),
    { ok: true, value: { from: "2026-11-01T00:00:00.000+07:00", to: "2026-11-30T23:59:59.999+07:00", sellerId, status: ["UNKNOWN", "SUCCEEDED"], receiptStatus: "DISPUTED" } });
  for (const bad of [{ sellerId: "seller" }, { from: "2026-11-30", to: "2026-11-01" }, { receiptStatus: "PAID" }])
    assert.equal(parseQueueForm({ sellerId: "", from: "", to: "", statuses: [], receiptStatus: "", ...bad }).ok, false);
  assert.deepEqual(combineQueueFilters("MINE", {}, 2), { claimedBy: "me", page: 2, size: 20 });
  assert.deepEqual(combineQueueFilters("READY", { status: ["ON_HOLD"] }, 0).status, ["ON_HOLD"]);
  const file = (name: string, type: string, size: number) => new File([new Uint8Array(size)], name, { type });
  assert.equal(evidenceFileError(file("proof.pdf", "application/pdf", 10), 0), null);
  assert.match(evidenceFileError(file("proof.gif", "image/gif", 10), 0) ?? "", /JPEG, PNG or PDF/);
  assert.match(evidenceFileError(file("big.png", "image/png", 10 * 1024 * 1024 + 1), 0) ?? "", /10 MiB/);
  assert.match(evidenceFileError(file("fourth.png", "image/png", 10), 3) ?? "", /at most 3/);
  const form = { sourceAccountId: sourceId, amount: "95000.00", reference: "FT2611180001", transferredAt: "2026-11-18T09:30", evidenceIds: [evidenceId], attested: true };
  const serverNow = Date.parse("2026-11-18T03:00:00Z");
  assert.deepEqual(parseConfirmationForm(form, "95000.00", [sourceId], serverNow), { ok: true, value: { sourceAccountId: sourceId, amount: "95000.00", bankTransferReference: "FT2611180001", transferredAt: "2026-11-18T02:30:00.000Z", evidenceIds: [evidenceId] } });
  for (const bad of [{ amount: "95000" }, { amount: "94999.99" }, { reference: "a b" }, { transferredAt: "2026-11-18T11:00" }, { evidenceIds: [] }, { attested: false }, { sourceAccountId: evidenceId }])
    assert.equal(parseConfirmationForm({ ...form, ...bad }, "95000.00", [sourceId], serverNow).ok, false);
  const dispute = { id: disputeId, status: "OPEN" as const, reason: "NOT_RECEIVED" as const, explanation: "Nothing arrived", version: 3, openedAt: at };
  assert.deepEqual(parseResolutionForm("CONFIRMATION_RECORDED_IN_ERROR", " no transfer ", [evidenceId], dispute), { ok: true, value: { outcome: "CONFIRMATION_RECORDED_IN_ERROR", reason: "no transfer", evidenceIds: [evidenceId], disputeId, expectedDisputeVersion: 3 } });
  assert.equal(parseResolutionForm("CONFIRMED_NOT_SENT", "nothing", [], null).ok, false);
  assert.equal(parseResolutionForm("CONFIRMATION_RECORDED_IN_ERROR", "x", [evidenceId], { ...dispute, status: "RESOLVED" }).ok, false);
  assert.equal(parseResolutionForm("CONFIRMED_SENT", "seen in bank app", [], null).ok, true);
  assert.equal(parseSellerDisputeForm("NOT_RECEIVED", "   ").ok, false);
  assert.equal(parseSellerDisputeForm("REFUND_ME", "please").ok, false);
  assert.equal(secondsUntil("2026-11-18T03:10:00Z", serverOffset("2026-11-18T03:00:00Z", 1000), 1000 + 30_000), 570);
  assert.equal(secondsUntil("2026-11-18T03:10:00Z", 0, Date.parse("2026-11-18T04:00:00Z")), 0);
});
