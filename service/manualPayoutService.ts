import { AxiosHeaders } from "axios";
import { createInvalidResponseError, isRecord, requestApi, requestApiBlob } from "../configs/api";
import type { ApiError, ApiResponse, Page } from "../types/commonResponseType";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import { payoutStatuses } from "../types/payoutType";
import { disputeStatuses, receiptStatuses } from "../types/payoutReceiptType";
import {
  bankMatchOutcomes, evidenceContentTypes, manualAttemptStates, manualCapabilityActions, manualCaseKinds, manualPayoutActions, manualResolutionOutcomes, maxEvidenceBytes, maxEvidenceFiles,
  type DisputeReviewInput, type ManualAttempt, type ManualBankMatch, type ManualCase, type ManualCommand, type ManualConfirmationInput, type ManualEvidence, type ManualHistoryEntry,
  type ManualPayout, type ManualPayoutAction, type ManualPayoutCapabilities, type ManualPayoutFilters, type ManualProblemInput, type ManualRecipient, type ManualResolutionCommand,
} from "../types/manualPayoutType";

const path = "/api/v1/payments/manual-payouts";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === "string" && uuidPattern.test(value);
export const sourceAccountPattern = /^[A-Za-z0-9_-]{1,64}$/;
export const bankReferencePattern = /^[A-Za-z0-9._/-]{1,120}$/;
const text = (value: unknown, max = 500): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const instant = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
const version = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const oneOf = <T extends string>(values: readonly T[], value: unknown): value is T => values.some((entry) => entry === value);
const nullable = <T>(value: unknown, check: (value: unknown) => value is T): value is T | null => value === null || check(value);
function fail(detail: string): never { throw createInvalidResponseError(detail); }
const sensitiveKeys = ["accountNumber", "recipientAccountNumber", "recipientAccountEncrypted", "accountEncrypted", "qrPayload", "qrUrl", "storageKey", "url", "publicUrl"];
const noSensitive = (value: Record<string, unknown>) => !sensitiveKeys.some((key) => Object.hasOwn(value, key));
const exactMoney = (value: unknown, label: string): string => typeof value === "string" && /^\d{1,17}\.\d{2}$/.test(value) ? value : fail(`Invalid ${label} amount`);
const minor = (value: string) => BigInt(value.replace(".", ""));
const unique = (ids: string[]) => new Set(ids).size === ids.length;

const parseCapabilities = (value: unknown): ManualPayoutCapabilities => {
  if (!isRecord(value) || typeof value.enabled !== "boolean" || !oneOf(["AUTO", "MANUAL"] as const, value.executionMode) || typeof value.automaticJobsEnabled !== "boolean" ||
    !instant(value.serverTime) || !Array.isArray(value.sourceAccounts) || !Array.isArray(value.allowedActions))
    return fail("Invalid manual payout capabilities");
  const sourceAccounts = value.sourceAccounts.map((account) => isRecord(account) && typeof account.id === "string" && sourceAccountPattern.test(account.id) && text(account.alias, 120) && noSensitive(account)
    ? { id: account.id, alias: account.alias } : fail("Invalid platform source account"));
  if (!unique(sourceAccounts.map((account) => account.id))) fail("Repeated platform source account");
  const actions = value.allowedActions.map((action) => oneOf(manualCapabilityActions, action) ? action : fail("Unknown manual payout capability"));
  if (!unique(actions) || actions.includes("RECONCILE") && !actions.includes("EXECUTE")) fail("Invalid manual payout capability set");
  return { enabled: value.enabled, executionMode: value.executionMode, automaticJobsEnabled: value.automaticJobsEnabled, serverTime: value.serverTime, sourceAccounts,
    canExecute: actions.includes("EXECUTE"), canReconcile: actions.includes("RECONCILE") };
};

const parseBankMatch = (value: unknown): ManualBankMatch => {
  if (!isRecord(value) || !noSensitive(value) || value.provider !== "SEPAY" || !text(value.transactionId, 64) ||
    !nullable(value.amount, (entry): entry is string => typeof entry === "string" && /^\d{1,17}\.\d{2}$/.test(entry)) || !nullable(value.transferredAt, instant) ||
    !oneOf(bankMatchOutcomes, value.outcome) || !Number.isSafeInteger(value.transfers) || Number(value.transfers) < 1)
    return fail("Invalid bank transfer match");
  return { provider: "SEPAY", transactionId: value.transactionId, amount: value.amount, transferredAt: value.transferredAt, outcome: value.outcome, transfers: Number(value.transfers) };
};
const parseAttempt = (value: unknown): ManualAttempt => {
  if (!isRecord(value) || !noSensitive(value) || !isUuid(value.id) || !Number.isSafeInteger(value.attemptNo) || Number(value.attemptNo) < 1 || !oneOf(manualAttemptStates, value.state) ||
    !version(value.version) || !isUuid(value.claimedBy) || !instant(value.claimExpiresAt) || !nullable(value.qrExpiresAt, instant) || !nullable(value.reference, (entry): entry is string => text(entry, 120)) ||
    !oneOf(receiptStatuses, value.receiptStatus) || !version(value.receiptVersion) || !nullable(value.sellerConfirmedAt, instant))
    return fail("Invalid manual attempt");
  if (value.state === "QR_ISSUED" && (value.reference === null || value.qrExpiresAt === null)) fail("An issued QR needs a fixed reference and deadline");
  if (value.receiptStatus === "CONFIRMED" && value.sellerConfirmedAt === null) fail("A confirmed receipt needs its confirmation time");
  return { id: value.id, attemptNo: Number(value.attemptNo), state: value.state, version: Number(value.version), claimedBy: value.claimedBy, claimExpiresAt: value.claimExpiresAt,
    qrExpiresAt: value.qrExpiresAt, reference: value.reference, receiptStatus: value.receiptStatus, receiptVersion: Number(value.receiptVersion), sellerConfirmedAt: value.sellerConfirmedAt,
    ...(value.bankMatch === undefined || value.bankMatch === null ? {} : { bankMatch: parseBankMatch(value.bankMatch) }) };
};
const parseEvidence = (value: unknown): ManualEvidence => {
  if (!isRecord(value) || !noSensitive(value) || !isUuid(value.id) || !oneOf(evidenceContentTypes, value.contentType) || !Number.isSafeInteger(value.size) ||
    Number(value.size) < 1 || Number(value.size) > maxEvidenceBytes || !instant(value.createdAt))
    return fail("Invalid evidence reference");
  return { id: value.id, contentType: value.contentType, size: Number(value.size), createdAt: value.createdAt };
};
const parseCase = (value: unknown): ManualCase => {
  if (!isRecord(value) || !isUuid(value.id) || !oneOf(manualCaseKinds, value.kind) || !oneOf(disputeStatuses, value.status) || !text(value.reason, 120) ||
    !(value.explanation === null || typeof value.explanation === "string" && value.explanation.length <= 1000) || !version(value.version) || !instant(value.createdAt))
    return fail("Invalid payout review case");
  return { id: value.id, kind: value.kind, status: value.status, reason: value.reason, explanation: value.explanation ?? "", version: Number(value.version), createdAt: value.createdAt };
};
const parseHistory = (value: unknown): ManualHistoryEntry => {
  if (!isRecord(value) || !noSensitive(value) || !isUuid(value.id) || !text(value.event, 64) || !nullable(value.attemptId, isUuid) || !nullable(value.caseId, isUuid) ||
    !isUuid(value.actorId) || !nullable(value.actorRole, (entry): entry is string => text(entry, 32)) || !nullable(value.reason, (entry): entry is string => typeof entry === "string" && entry.length <= 1000) ||
    !instant(value.occurredAt))
    return fail("Invalid manual payout history step");
  return { id: value.id, event: value.event, attemptId: value.attemptId, caseId: value.caseId, actorId: value.actorId, actorRole: value.actorRole, reason: value.reason, occurredAt: value.occurredAt };
};
const parseRecipient = (value: unknown): ManualRecipient | null => {
  if (value === null || value === undefined) return null;
  if (!isRecord(value) || !noSensitive(value) || !text(value.bankCode, 40) || !text(value.holderName, 200) || typeof value.accountLast4 !== "string" || !/^\d{4}$/.test(value.accountLast4))
    return fail("Invalid masked recipient");
  return { bankCode: value.bankCode, holderName: value.holderName, accountLast4: value.accountLast4 };
};
const attemptActions: readonly ManualPayoutAction[] = ["ISSUE_QR", "READ_QR", "RELEASE", "UPLOAD_EVIDENCE", "CONFIRM_TRANSFER", "REPORT_PROBLEM", "RESOLVE", "REVIEW_DISPUTE"];

export const parseManualPayout = (value: unknown): ManualPayout => {
  if (!isRecord(value) || !noSensitive(value) || !isUuid(value.id) || !isUuid(value.orderId) || !isUuid(value.sellerId) || !oneOf(payoutStatuses, value.status) || value.executionMode !== "MANUAL" ||
    !(value.confirmationSource === null || value.confirmationSource === "MANUAL_STAFF_CONFIRMED" || value.confirmationSource === "BANK_VERIFIED") || typeof value.currency !== "string" || !/^[A-Z]{3}$/.test(value.currency) || !version(value.version) ||
    !nullable(value.blockedReason, (entry): entry is string => text(entry, 300)) || !Array.isArray(value.allowedActions) || !instant(value.serverTime) || !instant(value.createdAt) ||
    !instant(value.updatedAt) || !Array.isArray(value.evidence) || !Array.isArray(value.cases) || !Array.isArray(value.history))
    return fail("Invalid manual payout");
  const orderAmount = exactMoney(value.orderAmount, "order"), shippingFee = exactMoney(value.shippingFee, "shipping"), platformFee = exactMoney(value.platformFee, "platform fee"), netAmount = exactMoney(value.netAmount, "net");
  if (minor(orderAmount) - minor(shippingFee) - minor(platformFee) !== minor(netAmount)) fail("Manual payout breakdown does not balance");
  const allowedActions = value.allowedActions.map((action) => oneOf(manualPayoutActions, action) ? action : fail("Unknown manual payout action"));
  const currentAttempt = value.currentAttempt === null || value.currentAttempt === undefined ? null : parseAttempt(value.currentAttempt);
  const evidence = value.evidence.map(parseEvidence), cases = value.cases.map(parseCase), history = value.history.map(parseHistory);
  if (!unique(allowedActions) || !unique(evidence.map((entry) => entry.id)) || evidence.length > maxEvidenceFiles || !unique(cases.map((entry) => entry.id)) || !unique(history.map((entry) => entry.id)))
    fail("Repeated manual payout entries");
  const openCases = cases.filter((entry) => entry.status !== "RESOLVED");
  const openSellerDispute = openCases.find((entry) => entry.kind === "SELLER_DISPUTE") ?? null;
  const has = (action: ManualPayoutAction) => allowedActions.includes(action);
  if (attemptActions.some(has) && !currentAttempt) fail("Attempt actions need a current attempt");
  if ((has("READ_QR") || has("CONFIRM_TRANSFER")) && currentAttempt?.state !== "QR_ISSUED") fail("A QR can be used only for an issued attempt");
  if (has("ISSUE_QR") && currentAttempt?.state !== "CLAIMED") fail("Only a claimed attempt can issue a QR");
  if (has("CLAIM") && value.status !== "PENDING") fail("Only a pending payout can be claimed");
  if (has("RETRY") && !["FAILED", "RETURNED"].includes(value.status)) fail("Only a failed or returned payout can be retried");
  if (has("RESOLVE") && !openCases.length) fail("Reconciliation needs an open case");
  if (has("REVIEW_DISPUTE") && !openSellerDispute) fail("Dispute review needs an open seller case");
  if (value.status === "SUCCEEDED" && value.confirmationSource === null) fail("Manual success needs a staff or bank confirmation");
  return { id: value.id, orderId: value.orderId, sellerId: value.sellerId, status: value.status, executionMode: "MANUAL", confirmationSource: value.confirmationSource,
    orderAmount, shippingFee, platformFee, netAmount, currency: value.currency, version: Number(value.version), blockedReason: value.blockedReason, allowedActions,
    serverTime: value.serverTime, createdAt: value.createdAt, updatedAt: value.updatedAt, currentAttempt, evidence, cases, history, recipient: parseRecipient(value.recipient),
    openCases, openSellerDispute, needsReview: value.status === "UNKNOWN" || openCases.length > 0 };
};

const validateFilters = (filters: ManualPayoutFilters) => {
  const { page = 0, size = 20, sellerId, status, claimedBy, receiptStatus, hasOpenDispute, needsReview, from, to } = filters;
  if (!Number.isSafeInteger(page) || page < 0 || !Number.isInteger(size) || size < 1 || size > 100 || sellerId !== undefined && !isUuid(sellerId) ||
    status !== undefined && (new Set(status).size !== status.length || status.some((entry) => !oneOf(payoutStatuses, entry))) || claimedBy !== undefined && claimedBy !== "me" ||
    receiptStatus !== undefined && !oneOf(receiptStatuses, receiptStatus) || hasOpenDispute !== undefined && hasOpenDispute !== true || needsReview !== undefined && needsReview !== true ||
    from !== undefined && !instant(from) || to !== undefined && !instant(to) || from && to && Date.parse(from) > Date.parse(to))
    return fail("Invalid manual payout filters");
  return Object.fromEntries(Object.entries({ page, size, sellerId, status: status?.length ? [...status] : undefined, claimedBy, receiptStatus, hasOpenDispute, needsReview, from, to }).filter(([, entry]) => entry !== undefined));
};
const pageOf = (response: ApiResponse<unknown>, number: number): Page<ManualPayout> => {
  if (!Array.isArray(response.data) || !response.page || response.page.number !== number || response.data.length > response.page.size || response.data.length > response.page.totalElements)
    return fail("Invalid manual payout page");
  const content = response.data.map(parseManualPayout);
  if (!unique(content.map((row) => row.id))) fail("Repeated manual payout row");
  return { content, page: response.page.number, size: response.page.size, totalElements: response.page.totalElements, totalPages: response.page.totalPages };
};
const commandOptions = (options: ServiceRequestOptions, key: string, params?: Record<string, unknown>): ServiceRequestOptions => {
  if (!isUuid(key)) fail("A UUID idempotency key is required");
  const headers = new AxiosHeaders(options.config?.headers); headers.set("Idempotency-Key", key);
  return { ...options, auth: true, params, config: { ...options.config, headers } };
};
const ensureIds = (...ids: string[]) => { if (ids.some((id) => !isUuid(id))) fail("A valid payout, attempt, case or evidence reference is required"); };
const ensureVersions = (...values: number[]) => { if (values.some((entry) => !version(entry))) fail("An exact expected version is required"); };
const detailFor = (data: unknown, payoutId: string) => {
  const detail = parseManualPayout(data);
  if (detail.id !== payoutId) fail("Manual payout reference mismatch");
  return detail;
};
const post = async (route: string, payoutId: string, body: Record<string, unknown>, key: string, options: ServiceRequestOptions) =>
  detailFor((await requestApi("POST", route, body, commandOptions(options, key))).data, payoutId);
const attemptRoute = (payoutId: string, attemptId: string, suffix: string) => { ensureIds(payoutId, attemptId); return `${path}/${payoutId}/attempts/${attemptId}/${suffix}`; };
const evidenceIdsOk = (ids: readonly string[] | undefined, min = 0) => ids === undefined ? min === 0 : ids.length >= min && ids.length <= maxEvidenceFiles && unique([...ids]) && ids.every(isUuid);
const reasonOk = (value: unknown): value is string => typeof value === "string" && text(value.trim(), 1000);

export const getManualPayoutCapabilities = async (options: ServiceRequestOptions = {}) =>
  parseCapabilities((await requestApi("GET", `${path}/capabilities`, undefined, { ...options, auth: true, params: undefined })).data);

export const getManualPayouts = async (filters: ManualPayoutFilters = {}, options: ServiceRequestOptions = {}): Promise<Page<ManualPayout>> => {
  const params = validateFilters(filters);
  const response = await requestApi("GET", path, undefined, { ...options, auth: true, params, config: { ...options.config, paramsSerializer: { indexes: null } } });
  const result = pageOf(response, Number(params.page));
  if (result.content.some((row) => filters.sellerId && row.sellerId !== filters.sellerId || filters.status?.length && !filters.status.includes(row.status) ||
    filters.receiptStatus && row.currentAttempt?.receiptStatus !== filters.receiptStatus || filters.hasOpenDispute && !row.openSellerDispute || filters.needsReview && !row.needsReview))
    fail("Manual payout queue does not match the requested filters");
  return result;
};
export const getManualPayoutDetail = async (payoutId: string, options: ServiceRequestOptions = {}) => {
  ensureIds(payoutId);
  return detailFor((await requestApi("GET", `${path}/${payoutId}`, undefined, { ...options, auth: true, params: undefined })).data, payoutId);
};
export const checkManualPayoutReadiness = async (payoutId: string, input: ManualCommand<{ reason?: string }>, options: ServiceRequestOptions = {}) => {
  ensureIds(payoutId); ensureVersions(input.expectedVersion);
  const reason = input.body?.reason?.trim();
  return post(`${path}/${payoutId}/readiness-check`, payoutId, { expectedPayoutVersion: input.expectedVersion, ...(reason ? { reason } : {}) }, input.idempotencyKey, options);
};
export const claimManualPayout = async (payoutId: string, input: ManualCommand, options: ServiceRequestOptions = {}) => {
  ensureIds(payoutId); ensureVersions(input.expectedVersion);
  return post(`${path}/${payoutId}/claims`, payoutId, { expectedPayoutVersion: input.expectedVersion }, input.idempotencyKey, options);
};
export const issueManualPayoutQr = async (payoutId: string, attemptId: string, input: ManualCommand, options: ServiceRequestOptions = {}) => {
  ensureVersions(input.expectedVersion);
  return post(attemptRoute(payoutId, attemptId, "qr-issuances"), payoutId, { expectedAttemptVersion: input.expectedVersion }, input.idempotencyKey, options);
};
export const getManualPayoutQr = async (payoutId: string, attemptId: string, options: ServiceRequestOptions = {}) =>
  requestApiBlob(attemptRoute(payoutId, attemptId, "qr"), ["image/png"], { ...options, auth: true, params: undefined });
export const releaseManualPayoutClaim = async (payoutId: string, attemptId: string, input: ManualCommand<{ reason?: string }>, options: ServiceRequestOptions = {}) => {
  ensureVersions(input.expectedVersion);
  const reason = input.body?.reason?.trim();
  return post(attemptRoute(payoutId, attemptId, "release"), payoutId, { expectedAttemptVersion: input.expectedVersion, ...(reason ? { reason } : {}) }, input.idempotencyKey, options);
};
export const uploadManualPayoutEvidence = async (payoutId: string, attemptId: string, file: File, input: ManualCommand, options: ServiceRequestOptions = {}) => {
  if (!oneOf(evidenceContentTypes, file.type) || file.size < 1 || file.size > maxEvidenceBytes) fail("Evidence must be a JPEG, PNG or PDF file up to 10 MiB");
  ensureVersions(input.expectedVersion);
  const route = attemptRoute(payoutId, attemptId, "evidence");
  const form = new FormData(); form.append("file", file, file.name);
  const { data } = await requestApi("POST", route, form, commandOptions(options, input.idempotencyKey, { expectedAttemptVersion: input.expectedVersion }));
  return detailFor(data, payoutId);
};
export const getManualPayoutEvidence = async (payoutId: string, attemptId: string, evidenceId: string, options: ServiceRequestOptions = {}) => {
  ensureIds(evidenceId);
  return requestApiBlob(`${attemptRoute(payoutId, attemptId, "evidence")}/${evidenceId}`, evidenceContentTypes, { ...options, auth: true, params: undefined });
};
export const confirmManualPayout = async (payoutId: string, attemptId: string, input: ManualCommand<ManualConfirmationInput>, options: ServiceRequestOptions = {}) => {
  const body = input.body;
  if (!body || !sourceAccountPattern.test(body.sourceAccountId) || !bankReferencePattern.test(body.bankTransferReference) || !instant(body.transferredAt) ||
    exactMoney(body.amount, "transferred") !== body.amount || !evidenceIdsOk(body.evidenceIds, 1))
    fail("Confirmation needs source account, exact amount, bank reference, transfer time and 1-3 evidence files");
  ensureVersions(input.expectedVersion);
  return post(attemptRoute(payoutId, attemptId, "confirmation"), payoutId, { expectedAttemptVersion: input.expectedVersion, ...body }, input.idempotencyKey, options);
};
export const reportManualPayoutProblem = async (payoutId: string, attemptId: string, input: ManualCommand<ManualProblemInput>, options: ServiceRequestOptions = {}) => {
  if (!input.body || !reasonOk(input.body.reason) || !evidenceIdsOk(input.body.evidenceIds)) fail("A problem report needs a reason");
  ensureVersions(input.expectedVersion);
  return post(attemptRoute(payoutId, attemptId, "problems"), payoutId,
    { expectedAttemptVersion: input.expectedVersion, reason: input.body.reason.trim(), evidenceIds: [...input.body.evidenceIds] }, input.idempotencyKey, options);
};
export const resolveManualPayout = async (payoutId: string, attemptId: string, input: ManualResolutionCommand, options: ServiceRequestOptions = {}) => {
  const body = input.body;
  const facts = [body.sourceAccountId, body.amount, body.bankTransferReference, body.transferredAt];
  const someFacts = facts.some((entry) => entry !== undefined && entry !== null);
  const allFacts = typeof body.sourceAccountId === "string" && sourceAccountPattern.test(body.sourceAccountId) && typeof body.amount === "string" && /^\d{1,17}\.\d{2}$/.test(body.amount) &&
    typeof body.bankTransferReference === "string" && bankReferencePattern.test(body.bankTransferReference) && instant(body.transferredAt);
  if (!oneOf(manualResolutionOutcomes, body.outcome) || !isUuid(body.caseId) || !reasonOk(body.reason) || !evidenceIdsOk(body.evidenceIds, 1) ||
    someFacts && (!allFacts || body.outcome !== "CONFIRMED_SENT"))
    fail("Resolution needs an outcome, the open case, a reason, 1-3 evidence files and complete transfer facts when settling a sent transfer");
  ensureVersions(input.expectedPayoutVersion, input.expectedAttemptVersion, body.expectedCaseVersion);
  return post(attemptRoute(payoutId, attemptId, "resolution"), payoutId,
    { expectedPayoutVersion: input.expectedPayoutVersion, expectedAttemptVersion: input.expectedAttemptVersion, ...body, reason: body.reason.trim() }, input.idempotencyKey, options);
};
export const reviewReceiptDispute = async (payoutId: string, attemptId: string, disputeId: string, input: ManualCommand<DisputeReviewInput>, options: ServiceRequestOptions = {}) => {
  ensureIds(disputeId);
  const body = input.body;
  if (!body || !reasonOk(body.reason) || !evidenceIdsOk(body.evidenceIds, body.action === "TRANSFER_EVIDENCE_PROVIDED" ? 1 : 0)) fail("A dispute review needs a reason, and evidence when it says transfer evidence was provided");
  ensureVersions(input.expectedVersion, body.expectedCaseVersion);
  return post(`${attemptRoute(payoutId, attemptId, "receipt-disputes")}/${disputeId}/reviews`, payoutId,
    { expectedAttemptVersion: input.expectedVersion, expectedCaseVersion: body.expectedCaseVersion, action: body.action, reason: body.reason.trim(), evidenceIds: [...body.evidenceIds] }, input.idempotencyKey, options);
};
export const retryManualPayout = async (payoutId: string, input: ManualCommand<{ reason: string }>, options: ServiceRequestOptions = {}) => {
  ensureIds(payoutId);
  if (!input.body || !reasonOk(input.body.reason)) fail("A retry needs a reason");
  ensureVersions(input.expectedVersion);
  return post(`${path}/${payoutId}/retries`, payoutId, { expectedPayoutVersion: input.expectedVersion, reason: input.body.reason.trim() }, input.idempotencyKey, options);
};

export const manualPayoutErrorMessage = (error: ApiError): string => {
  if (error.kind === "network") return "The response was lost. Refresh this payout before any further action; do not transfer again.";
  if (error.kind === "invalid-response") return `The payout service returned data this screen cannot trust (${error.detail ?? error.title}).`;
  switch (error.status) {
    case 401: return "Your session has ended. Sign in again to continue.";
    case 403: return "Your role cannot perform this payout action.";
    case 404: return "This payout, attempt or file was not found for your account.";
    case 409: return `${error.detail || "This payout changed."} The latest state has been reloaded.`;
    case 413: return "The evidence file is larger than 10 MiB.";
    case 415: return "Only JPEG, PNG or PDF evidence is accepted.";
    case 501: case 503: return "Manual payouts are not available right now. No payout was changed.";
    default: return error.detail || error.title;
  }
};
