import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { isApiError } from "../configs/api";
import {
  checkManualPayoutReadiness, claimManualPayout, confirmManualPayout, getManualPayoutCapabilities, getManualPayoutDetail, getManualPayoutEvidence, getManualPayoutQr, getManualPayouts,
  issueManualPayoutQr, manualPayoutErrorMessage, parseManualPayout, releaseManualPayoutClaim, reportManualPayoutProblem, resolveManualPayout,
  retryManualPayout, reviewReceiptDispute, uploadManualPayoutEvidence,
} from "../service/manualPayoutService";
import { confirmPayoutReceipt, disputePayoutReceipt } from "../service/sellerPayoutReceiptService";
import { parseSellerPayout } from "../service/payoutService";
import { combineQueueFilters, evidenceFileError, parseConfirmationForm, parseQueueForm, parseResolutionForm, parseReviewForm, parseSellerDisputeForm, secondsUntil, serverOffset } from "../features/manualPayoutSchema";

const id = "97000000-0000-4000-8000-000000000001";
const orderId = "97000000-0000-4000-8000-000000000002";
const sellerId = "68000000-0000-4000-8000-000000000002";
const staffId = "68000000-0000-4000-8000-000000000004";
const attemptId = "97000000-0000-4000-8000-000000000003";
const evidenceId = "97000000-0000-4000-8000-000000000004";
const caseId = "97000000-0000-4000-8000-000000000006";
const sourceId = "platform-main";
const at = "2026-11-18T03:00:00Z";
const reference = "NXP97000000000040000001";
const pending = { id, orderId, sellerId, status: "PENDING", executionMode: "MANUAL", confirmationSource: null, orderAmount: "100000.00", shippingFee: "5000.00", platformFee: "0.00",
  netAmount: "95000.00", currency: "VND", version: 2, blockedReason: null, allowedActions: ["CLAIM"], serverTime: at, createdAt: at, updatedAt: at, currentAttempt: null,
  evidence: [], cases: [], history: [], recipient: { bankCode: "970436", holderName: "NGUYEN VAN A", accountLast4: "0123" } };
const attempt = { id: attemptId, attemptNo: 1, state: "CLAIMED", version: 0, claimedBy: staffId, claimExpiresAt: "2026-11-18T03:05:00Z", qrExpiresAt: null, reference,
  receiptStatus: "NOT_REQUESTED", receiptVersion: 0, sellerConfirmedAt: null };
const claimed = { ...pending, status: "PROCESSING", currentAttempt: attempt, allowedActions: ["RELEASE", "ISSUE_QR"] };
const issued = { ...claimed, currentAttempt: { ...attempt, state: "QR_ISSUED", version: 1, qrExpiresAt: "2026-11-18T03:10:00Z" }, allowedActions: ["READ_QR", "CONFIRM_TRANSFER", "UPLOAD_EVIDENCE", "REPORT_PROBLEM"] };
const evidence = { id: evidenceId, contentType: "image/png", size: 8, createdAt: at };
const exception = { id: caseId, kind: "STAFF_EXCEPTION", status: "OPEN", reason: "RECONCILIATION_REQUIRED", explanation: "QR deadline expired", version: 0, createdAt: at };
const unknown = { ...issued, status: "UNKNOWN", blockedReason: "RECONCILIATION_REQUIRED", currentAttempt: { ...issued.currentAttempt, state: "UNKNOWN", version: 2 }, evidence: [evidence],
  cases: [exception], allowedActions: ["UPLOAD_EVIDENCE", "REPORT_PROBLEM", "RESOLVE"] };
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
  const { calls, options } = recorder(() => Response.json({ ...envelope([{ ...unknown, evidence: [], history: [], cases: [{ ...exception, explanation: "" }] }]), page }));
  const result = await getManualPayouts({ status: ["UNKNOWN", "SUCCEEDED"], claimedBy: "me", needsReview: true, from: "2026-11-01T00:00:00Z", to: "2026-11-30T23:59:59Z", page: 1 }, options);
  assert.equal(result.totalElements, 21);
  assert.equal(result.content[0].needsReview, true);
  assert.equal(calls[0].path, "/api/v1/payments/manual-payouts");
  assert.deepEqual(calls[0].query.getAll("status"), ["UNKNOWN", "SUCCEEDED"]);
  assert.equal(calls[0].query.get("claimedBy"), "me"); assert.equal(calls[0].query.get("needsReview"), "true"); assert.equal(calls[0].query.get("size"), "20");
  assert.equal(calls[0].headers.get("Authorization"), "Bearer staff-token");
  await assert.rejects(getManualPayouts({ hasOpenDispute: true, page: 1 }, options), invalid);
  const auto = recorder(() => Response.json({ ...envelope([{ ...pending, executionMode: "AUTO" }]), page: { ...page, number: 0 } }));
  await assert.rejects(getManualPayouts({}, auto.options), invalid);
  for (const bad of [{ size: 101 }, { status: ["PENDING", "PENDING"] as const }, { sellerId: "seller" }, { from: "2026-11-02T00:00:00Z", to: "2026-11-01T00:00:00Z" }])
    await assert.rejects(getManualPayouts(bad, auto.options), invalid);
});

test("manual view keeps exact decimal strings and refuses unsafe or inconsistent payloads", () => {
  assert.equal(parseManualPayout(pending).netAmount, "95000.00");
  assert.equal(parseManualPayout(pending).recipient?.bankCode, "970436");
  assert.equal(parseManualPayout({ ...pending, recipient: undefined }).recipient, null);
  assert.equal(parseManualPayout(claimed).currentAttempt?.reference, reference);
  const parsed = parseManualPayout(unknown);
  assert.equal(parsed.openCases.length, 1); assert.equal(parsed.needsReview, true); assert.equal(parsed.openSellerDispute, null);
  for (const bad of [{ netAmount: 95000 }, { netAmount: "95000" }, { shippingFee: "6000.00" }, { executionMode: "AUTO" }, { currency: "vnd" }, { accountNumber: "0012340123" },
    { allowedActions: ["CLAIM", "CLAIM"] }, { allowedActions: ["SEND_MONEY"] }, { recipient: { ...pending.recipient, accountLast4: "0012340123" } },
    { status: "UNKNOWN", allowedActions: ["RETRY"] }, { allowedActions: ["RESOLVE"] }, { allowedActions: ["REVIEW_DISPUTE"] }])
    assert.throws(() => parseManualPayout({ ...pending, ...bad }), invalid);
  assert.throws(() => parseManualPayout({ ...issued, currentAttempt: { ...issued.currentAttempt, qrExpiresAt: null } }), invalid);
  assert.throws(() => parseManualPayout({ ...claimed, allowedActions: ["CONFIRM_TRANSFER"] }), invalid);
  assert.throws(() => parseManualPayout({ ...unknown, evidence: [evidence, { ...evidence, id: orderId }, { ...evidence, id: staffId }, { ...evidence, id: sellerId }] }), invalid);
  const succeeded = { ...issued, status: "SUCCEEDED", confirmationSource: "MANUAL_STAFF_CONFIRMED", allowedActions: [], currentAttempt: { ...issued.currentAttempt, state: "SUCCEEDED", receiptStatus: "AWAITING_CONFIRMATION" } };
  assert.equal(parseManualPayout(succeeded).confirmationSource, "MANUAL_STAFF_CONFIRMED");
  assert.throws(() => parseManualPayout({ ...succeeded, confirmationSource: null }), invalid);
  const bankMatch = { provider: "SEPAY", transactionId: "92704", amount: "95000.00", transferredAt: at, outcome: "CONFIRMED", transfers: 1 };
  const verified = parseManualPayout({ ...succeeded, confirmationSource: "BANK_VERIFIED", currentAttempt: { ...succeeded.currentAttempt, bankMatch } });
  assert.equal(verified.confirmationSource, "BANK_VERIFIED"); assert.deepEqual(verified.currentAttempt?.bankMatch, bankMatch);
  assert.equal(parseManualPayout(succeeded).currentAttempt?.bankMatch, undefined);
  for (const bad of [{ provider: "VCB" }, { amount: 95000 }, { outcome: "UNMATCHED" }, { transfers: 0 }, { accountNumber: "0000000002" }])
    assert.throws(() => parseManualPayout({ ...succeeded, currentAttempt: { ...succeeded.currentAttempt, bankMatch: { ...bankMatch, ...bad } } }), invalid);
  assert.throws(() => parseManualPayout({ ...succeeded, confirmationSource: "PROVIDER_CONFIRMED" }), invalid);
  const step = { id: evidenceId, event: "MANUAL_CONFIRMED", attemptId, caseId: null, actorId: staffId, actorRole: "SUPPORT_STAFF", reason: null, occurredAt: at };
  assert.equal(parseManualPayout({ ...succeeded, history: [step] }).history[0].event, "MANUAL_CONFIRMED");
  assert.deepEqual(parseManualPayout({ ...succeeded, history: [{ ...step, id: caseId, occurredAt: "2026-11-18T02:00:00Z" }, step] }).history.map((entry) => entry.id), [caseId, evidenceId]);
  assert.throws(() => parseManualPayout({ ...succeeded, history: [step, step] }), invalid);
});

test("every write sends one UUID key and the exact expected version on its own route", async () => {
  const { calls, options } = recorder((call) => Response.json(envelope(call.path.endsWith("/claims") || call.path.endsWith("/readiness-check") || call.path.endsWith("/release") ? claimed : issued)));
  const key = randomUUID();
  await claimManualPayout(id, { idempotencyKey: key, expectedVersion: 2 }, options);
  await checkManualPayoutReadiness(id, { idempotencyKey: randomUUID(), expectedVersion: 2 }, options);
  await issueManualPayoutQr(id, attemptId, { idempotencyKey: randomUUID(), expectedVersion: 0 }, options);
  await releaseManualPayoutClaim(id, attemptId, { idempotencyKey: randomUUID(), expectedVersion: 0 }, options);
  await confirmManualPayout(id, attemptId, { idempotencyKey: randomUUID(), expectedVersion: 1, body: { sourceAccountId: sourceId, amount: "95000.00", bankTransferReference: "FT2611180001", transferredAt: at, evidenceIds: [evidenceId] } }, options);
  await reportManualPayoutProblem(id, attemptId, { idempotencyKey: randomUUID(), expectedVersion: 1, body: { reason: "Bank app timed out", evidenceIds: [] } }, options);
  assert.deepEqual(calls.map((call) => call.path.replace(`/api/v1/payments/manual-payouts/${id}`, "")), ["/claims", "/readiness-check", `/attempts/${attemptId}/qr-issuances`,
    `/attempts/${attemptId}/release`, `/attempts/${attemptId}/confirmation`, `/attempts/${attemptId}/problems`]);
  assert.equal(calls[0].headers.get("Idempotency-Key"), key);
  assert.deepEqual(calls[0].body, { expectedPayoutVersion: 2 });
  assert.deepEqual(calls[2].body, { expectedAttemptVersion: 0 });
  assert.deepEqual(calls[5].body, { expectedAttemptVersion: 1, reason: "Bank app timed out", evidenceIds: [] });
  assert.ok(calls.every((call) => call.method === "POST" && /^[0-9a-f-]{36}$/.test(call.headers.get("Idempotency-Key") ?? "")));
  await assert.rejects(claimManualPayout(id, { idempotencyKey: "retry-1", expectedVersion: 2 }, options), invalid);
  await assert.rejects(claimManualPayout(id, { idempotencyKey: randomUUID(), expectedVersion: -1 }, options), invalid);
  await assert.rejects(confirmManualPayout(id, attemptId, { idempotencyKey: randomUUID(), expectedVersion: 1, body: { sourceAccountId: sourceId, amount: "95000", bankTransferReference: "FT", transferredAt: at, evidenceIds: [evidenceId] } }, options), invalid);
  await assert.rejects(confirmManualPayout(id, attemptId, { idempotencyKey: randomUUID(), expectedVersion: 1, body: { sourceAccountId: sourceId, amount: "95000.00", bankTransferReference: "a b", transferredAt: at, evidenceIds: [evidenceId] } }, options), invalid);
  await assert.rejects(confirmManualPayout(id, attemptId, { idempotencyKey: randomUUID(), expectedVersion: 1, body: { sourceAccountId: sourceId, amount: "95000.00", bankTransferReference: "FT", transferredAt: at, evidenceIds: [] } }, options), invalid);
  const other = recorder(() => Response.json(envelope({ ...issued, id: orderId })));
  await assert.rejects(issueManualPayoutQr(id, attemptId, { idempotencyKey: randomUUID(), expectedVersion: 0 }, other.options), invalid);
});

test("admin commands carry payout, attempt and case versions, case id and proof", async () => {
  const { calls, options } = recorder((call) => Response.json(envelope(call.path.endsWith("/retries") ? pending : unknown)));
  const body = { caseId, expectedCaseVersion: 0, outcome: "CONFIRMED_NOT_SENT" as const, reason: "Bank statement shows no debit", evidenceIds: [evidenceId] };
  await resolveManualPayout(id, attemptId, { idempotencyKey: randomUUID(), expectedPayoutVersion: 2, expectedAttemptVersion: 2, body }, options);
  assert.deepEqual(calls[0].body, { expectedPayoutVersion: 2, expectedAttemptVersion: 2, ...body });
  await assert.rejects(resolveManualPayout(id, attemptId, { idempotencyKey: randomUUID(), expectedPayoutVersion: 2, expectedAttemptVersion: 2, body: { ...body, evidenceIds: [] } }, options), invalid);
  await assert.rejects(resolveManualPayout(id, attemptId, { idempotencyKey: randomUUID(), expectedPayoutVersion: 2, expectedAttemptVersion: 2, body: { ...body, caseId: "case" } }, options), invalid);
  await assert.rejects(resolveManualPayout(id, attemptId, { idempotencyKey: randomUUID(), expectedPayoutVersion: 2, expectedAttemptVersion: 2, body: { ...body, sourceAccountId: sourceId } }, options), invalid);
  await reviewReceiptDispute(id, attemptId, caseId, { idempotencyKey: randomUUID(), expectedVersion: 2, body: { action: "REQUEST_INFORMATION", reason: "Send the bank SMS", evidenceIds: [], expectedCaseVersion: 0 } }, options);
  await assert.rejects(reviewReceiptDispute(id, attemptId, caseId, { idempotencyKey: randomUUID(), expectedVersion: 2, body: { action: "TRANSFER_EVIDENCE_PROVIDED", reason: "Sent", evidenceIds: [], expectedCaseVersion: 0 } }, options), invalid);
  await retryManualPayout(id, { idempotencyKey: randomUUID(), expectedVersion: 4, body: { reason: "Reconciled as not sent" } }, options);
  await assert.rejects(retryManualPayout(id, { idempotencyKey: randomUUID(), expectedVersion: 4, body: { reason: " " } }, options), invalid);
  assert.equal(calls[1].path, `/api/v1/payments/manual-payouts/${id}/attempts/${attemptId}/receipt-disputes/${caseId}/reviews`);
  assert.deepEqual(calls[1].body, { expectedAttemptVersion: 2, expectedCaseVersion: 0, action: "REQUEST_INFORMATION", reason: "Send the bank SMS", evidenceIds: [] });
  assert.deepEqual(calls[2].body, { expectedPayoutVersion: 4, reason: "Reconciled as not sent" });
});

test("QR and evidence are binary reads through the shared boundary and reject problem bodies or wrong types", async () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const { calls, options } = recorder(() => new Response(png, { headers: { "Content-Type": "image/png", "Cache-Control": "no-store, private" } }));
  const qr = await getManualPayoutQr(id, attemptId, options);
  assert.equal(qr.type, "image/png"); assert.equal(qr.size, 8);
  assert.equal(calls[0].headers.get("Authorization"), "Bearer staff-token");
  assert.equal(calls[0].query.size, 0);
  const html = recorder(() => new Response("<html></html>", { headers: { "Content-Type": "text/html" } }));
  await assert.rejects(getManualPayoutQr(id, attemptId, html.options), invalid);
  const problem = recorder(() => Response.json({ title: "Conflict", status: 409, code: "MANUAL_PAYOUT_CONFLICT", detail: "Another executor owns this attempt" }, { status: 409, headers: { "Content-Type": "application/problem+json" } }));
  await assert.rejects(getManualPayoutQr(id, attemptId, problem.options), (error: unknown) => isApiError(error) && error.status === 409 && error.code === "MANUAL_PAYOUT_CONFLICT");
  const pdf = recorder(() => new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), { headers: { "Content-Type": "application/pdf" } }));
  assert.equal((await getManualPayoutEvidence(id, attemptId, evidenceId, pdf.options)).type, "application/pdf");
  assert.equal(pdf.calls[0].path, `/api/v1/payments/manual-payouts/${id}/attempts/${attemptId}/evidence/${evidenceId}`);
});

test("evidence upload is multipart with the attempt version as a query parameter", async () => {
  const { calls, options } = recorder(() => Response.json(envelope({ ...issued, evidence: [evidence] }), { status: 201 }));
  const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "transfer.png", { type: "image/png" });
  const result = await uploadManualPayoutEvidence(id, attemptId, file, { idempotencyKey: randomUUID(), expectedVersion: 1 }, options);
  assert.equal(result.evidence[0].id, evidenceId);
  assert.equal(calls[0].query.get("expectedAttemptVersion"), "1");
  const form = calls[0].body as FormData;
  assert.equal((form.get("file") as File).name, "transfer.png"); assert.equal(form.get("expectedAttemptVersion"), null);
  await assert.rejects(uploadManualPayoutEvidence(id, attemptId, new File(["x"], "a.gif", { type: "image/gif" }), { idempotencyKey: randomUUID(), expectedVersion: 1 }, options), invalid);
  await assert.rejects(uploadManualPayoutEvidence(id, attemptId, new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.pdf", { type: "application/pdf" }), { idempotencyKey: randomUUID(), expectedVersion: 1 }, options), invalid);
  assert.equal(calls.length, 1);
});

test("capabilities map allowed actions, and errors explain honest recovery without suggesting another transfer", async () => {
  const caps = { enabled: false, executionMode: "MANUAL", automaticJobsEnabled: false, serverTime: at, sourceAccounts: [{ id: sourceId, alias: "Nexus payout VCB" }], allowedActions: ["EXECUTE"] };
  const { options } = recorder(() => Response.json(envelope(caps)));
  const parsed = await getManualPayoutCapabilities(options);
  assert.equal(parsed.enabled, false); assert.equal(parsed.canExecute, true); assert.equal(parsed.canReconcile, false);
  for (const bad of [{ allowedActions: ["RECONCILE"] }, { allowedActions: ["EXECUTE", "EXECUTE"] }, { sourceAccounts: [{ id: "bad id", alias: "x" }] }, { executionMode: "HYBRID" }]) {
    const broken = recorder(() => Response.json(envelope({ ...caps, ...bad })));
    await assert.rejects(getManualPayoutCapabilities(broken.options), invalid);
  }
  const missing = recorder(() => Response.json({ title: "Not Found", status: 404 }, { status: 404 }));
  await assert.rejects(getManualPayoutDetail(id, missing.options), (error: unknown) => isApiError(error) && error.status === 404);
  assert.match(manualPayoutErrorMessage({ kind: "network", status: 0, title: "Network request failed" }), /do not transfer again/);
  assert.match(manualPayoutErrorMessage({ kind: "http", status: 503, title: "Unavailable" }), /No payout was changed/);
});

test("seller payouts read the manual receipt, and receipt commands return the receipt view", async () => {
  const base = { id, orderId, sellerId, orderAmount: "100000.00", shippingFee: "5000.00", platformFeeRate: "0.0000", platformFee: "0.00", netAmount: "95000.00", currency: "VND",
    status: "SUCCEEDED", attemptCount: 1, recipientAccountLast4: "0123", providerReference: "FT2611180001", createdAt: at, simulated: true };
  assert.equal(parseSellerPayout({ ...base }).executionMode, "AUTO");
  assert.equal(parseSellerPayout({ ...base }).manual, null);
  const receipt = { attemptId, attemptState: "SUCCEEDED", receiptStatus: "AWAITING_CONFIRMATION", receiptVersion: 0, hasOpenDispute: false, allowedActions: ["CONFIRM_RECEIPT", "OPEN_DISPUTE"], dispute: null };
  const manual = { ...base, providerReference: null, executionMode: "MANUAL", confirmationSource: "MANUAL_STAFF_CONFIRMED", manual: receipt };
  assert.deepEqual(parseSellerPayout(manual).manual?.allowedActions, ["CONFIRM_RECEIPT", "OPEN_DISPUTE"]);
  assert.throws(() => parseSellerPayout({ ...base, providerReference: null }), invalid);
  for (const bad of [{ executionMode: "AUTO", providerReference: "FT" }, { manual: { ...receipt, attemptState: "CONFIRMATION_CORRECTED" } }, { manual: { ...receipt, evidence: [] } },
    { manual: { ...receipt, receiptStatus: "CONFIRMED" } }, { manual: { ...receipt, allowedActions: ["TRANSFER_AGAIN"] } }, { manual: { ...receipt, hasOpenDispute: true } }])
    assert.throws(() => parseSellerPayout({ ...manual, ...bad }), invalid);
  const confirmed = { ...receipt, receiptStatus: "CONFIRMED", receiptVersion: 1, allowedActions: ["OPEN_DISPUTE"] };
  const { calls, options } = recorder(() => Response.json(envelope(confirmed)));
  const key = randomUUID();
  assert.equal((await confirmPayoutReceipt(id, attemptId, { idempotencyKey: key, expectedReceiptVersion: 0 }, options)).receiptStatus, "CONFIRMED");
  await disputePayoutReceipt(id, attemptId, { idempotencyKey: randomUUID(), expectedReceiptVersion: 1, body: { reason: "CONFIRMATION_MISTAKE", explanation: "  Clicked too early  " } }, options);
  assert.equal(calls[0].path, `/api/v1/payments/payouts/${id}/manual-attempts/${attemptId}/receipt-confirmations`);
  assert.equal(calls[0].headers.get("Idempotency-Key"), key);
  assert.deepEqual(calls[0].body, { expectedReceiptVersion: 0 });
  assert.deepEqual(calls[1].body, { expectedReceiptVersion: 1, reason: "CONFIRMATION_MISTAKE", explanation: "Clicked too early" });
  await assert.rejects(disputePayoutReceipt(id, attemptId, { idempotencyKey: randomUUID(), expectedReceiptVersion: 1, body: { reason: "NOT_RECEIVED", explanation: "   " } }, options), invalid);
  const other = recorder(() => Response.json(envelope({ ...confirmed, attemptId: evidenceId })));
  await assert.rejects(confirmPayoutReceipt(id, attemptId, { idempotencyKey: randomUUID(), expectedReceiptVersion: 0 }, other.options), invalid);
  assert.equal(calls.length, 2);
});

test("workspace forms validate exact values locally before any command is sent", () => {
  assert.deepEqual(parseQueueForm({ sellerId: ` ${sellerId} `, from: "2026-11-01", to: "2026-11-30", statuses: ["UNKNOWN", "SUCCEEDED"], receiptStatus: "DISPUTED" }),
    { ok: true, value: { from: "2026-11-01T00:00:00.000+07:00", to: "2026-11-30T23:59:59.999+07:00", sellerId, status: ["UNKNOWN", "SUCCEEDED"], receiptStatus: "DISPUTED" } });
  for (const bad of [{ sellerId: "seller" }, { from: "2026-11-30", to: "2026-11-01" }, { receiptStatus: "PAID" }])
    assert.equal(parseQueueForm({ sellerId: "", from: "", to: "", statuses: [], receiptStatus: "", ...bad }).ok, false);
  assert.deepEqual(combineQueueFilters("MINE", {}, 2), { claimedBy: "me", page: 2, size: 20 });
  const file = (name: string, type: string, size: number) => new File([new Uint8Array(size)], name, { type });
  assert.equal(evidenceFileError(file("proof.pdf", "application/pdf", 10), 0), null);
  assert.match(evidenceFileError(file("proof.gif", "image/gif", 10), 0) ?? "", /JPEG, PNG or PDF/);
  assert.match(evidenceFileError(file("big.png", "image/png", 10 * 1024 * 1024 + 1), 0) ?? "", /10 MiB/);
  assert.match(evidenceFileError(file("fourth.png", "image/png", 10), 3) ?? "", /at most 3/);
  const form = { sourceAccountId: sourceId, amount: "95000.00", reference: "FT2611180001", transferredAt: "2026-11-18T09:30", evidenceIds: [evidenceId], attested: true };
  const serverNow = Date.parse("2026-11-18T03:00:00Z");
  assert.deepEqual(parseConfirmationForm(form, "95000.00", [sourceId], serverNow), { ok: true, value: { sourceAccountId: sourceId, amount: "95000.00", bankTransferReference: "FT2611180001", transferredAt: "2026-11-18T02:30:00.000Z", evidenceIds: [evidenceId] } });
  for (const bad of [{ amount: "95000.001" }, { amount: "94999.99" }, { reference: "a b" }, { reference: "x".repeat(121) }, { transferredAt: "2026-11-18T11:00" }, { evidenceIds: [] }, { attested: false }, { sourceAccountId: "other" }])
    assert.equal(parseConfirmationForm({ ...form, ...bad }, "95000.00", [sourceId], serverNow).ok, false);
  assert.equal(parseConfirmationForm({ ...form, amount: "95000" }, "95000.00", [sourceId], serverNow).ok, true);
  const sameMinute = parseConfirmationForm(form, "95000.00", [sourceId], serverNow, "2026-11-18T02:30:42.000Z");
  assert.equal(sameMinute.ok && sameMinute.value.transferredAt, "2026-11-18T02:30:59.999Z");
  assert.equal(parseConfirmationForm(form, "95000.00", [sourceId], serverNow, "2026-11-18T02:31:05.000Z").ok, false);
  const openCase = parseManualPayout(unknown).openCases[0];
  const context = { attemptState: "UNKNOWN" as const, payoutStatus: "UNKNOWN" as const, openCases: [openCase], netAmount: "95000.00", sourceIds: [sourceId], serverNow };
  const facts = { sourceAccountId: "", amount: "", reference: "", transferredAt: "" };
  assert.equal(parseResolutionForm({ caseId, outcome: "CONFIRMED_NOT_SENT", reason: " nothing left the account ", evidenceIds: [evidenceId], facts }, context).ok, true);
  assert.equal(parseResolutionForm({ caseId, outcome: "CONFIRMED_NOT_SENT", reason: "nothing", evidenceIds: [], facts }, context).ok, false);
  assert.equal(parseResolutionForm({ caseId, outcome: "CONFIRMED_SENT", reason: "seen in bank app", evidenceIds: [evidenceId], facts }, context).ok, false);
  assert.equal(parseResolutionForm({ caseId, outcome: "CONFIRMED_SENT", reason: "seen in bank app", evidenceIds: [evidenceId], facts: { sourceAccountId: sourceId, amount: "95000.00", reference: "FT1", transferredAt: "2026-11-18T09:30" } }, context).ok, true);
  assert.equal(parseResolutionForm({ caseId, outcome: "CONFIRMED_RETURNED", reason: "returned", evidenceIds: [evidenceId], facts }, context).ok, false);
  assert.equal(parseResolutionForm({ caseId: orderId, outcome: "CONFIRMED_NOT_SENT", reason: "x", evidenceIds: [evidenceId], facts }, context).ok, false);
  const dispute = { ...openCase, kind: "SELLER_DISPUTE" as const };
  assert.equal(parseReviewForm("REQUEST_INFORMATION", "Send the bank SMS", [], dispute).ok, true);
  assert.equal(parseReviewForm("TRANSFER_EVIDENCE_PROVIDED", "Shared the slip", [], dispute).ok, false);
  assert.equal(parseSellerDisputeForm("NOT_RECEIVED", "   ").ok, false);
  assert.equal(parseSellerDisputeForm("REFUND_ME", "please").ok, false);
  assert.equal(secondsUntil("2026-11-18T03:10:00Z", serverOffset("2026-11-18T03:00:00Z", 1000), 1000 + 30_000), 570);
  assert.equal(secondsUntil("2026-11-18T03:10:00Z", 0, Date.parse("2026-11-18T04:00:00Z")), 0);
});
