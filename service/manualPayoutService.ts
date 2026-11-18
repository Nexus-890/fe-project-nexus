import { AxiosHeaders } from "axios";
import { createInvalidResponseError, isRecord, requestApi, requestApiBlob } from "../configs/api";
import type { ApiError, ApiResponse, Page } from "../types/commonResponseType";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import { payoutStatuses, type PayoutStatus } from "../types/payoutType";
import { disputeReasons, disputeStatuses, receiptStatuses, type ReceiptDispute, type ReceiptStatus } from "../types/payoutReceiptType";
import {
  actorRoles, confirmationSources, evidenceContentTypes, executionModes, manualAttemptStates, manualHistoryEvents, manualPayoutActions, maxEvidenceBytes, maxEvidenceFiles,
  type DisputeReviewInput, type ManualAttempt, type ManualCommand, type ManualConfirmation, type ManualConfirmationInput, type ManualEvidence, type ManualHistoryEntry,
  type ManualPayoutCapabilities, type ManualPayoutDetail, type ManualPayoutFilters, type ManualPayoutSummary, type ManualProblemInput, type ManualRecipient, type ManualResolutionInput,
} from "../types/manualPayoutType";

const path = "/api/v1/payments/manual-payouts";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === "string" && uuidPattern.test(value);
const text = (value: unknown, max = 500): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const instant = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
const version = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const oneOf = <T extends string>(values: readonly T[], value: unknown): value is T => values.some((entry) => entry === value);
const nullable = <T>(value: unknown, check: (value: unknown) => value is T): value is T | null => value === null || check(value);
const fail = (detail: string): never => { throw createInvalidResponseError(detail); };
const sensitiveKeys = ["accountNumber", "recipientAccountNumber", "recipientAccountEncrypted", "qrPayload", "qrUrl"];
const noSensitive = (value: Record<string, unknown>) => !sensitiveKeys.some((key) => Object.hasOwn(value, key));
const exactMoney = (value: unknown, label: string): string => typeof value === "string" && /^\d{1,17}\.\d{2}$/.test(value) ? value : fail(`Invalid ${label} amount`);
const minor = (value: string) => BigInt(value.replace(".", ""));
const feeRate = (value: unknown) => typeof value === "string" && /^(?:0(?:\.\d{1,4})?|1(?:\.0{1,4})?)$/.test(value) ? value : fail("Invalid platform fee rate");

const parseCapabilities = (value: unknown): ManualPayoutCapabilities => {
  if (!isRecord(value) || typeof value.canExecute !== "boolean" || typeof value.canReconcile !== "boolean" || typeof value.newWorkEnabled !== "boolean" ||
    typeof value.automaticJobsEnabled !== "boolean" || !instant(value.serverTime) || !Number.isSafeInteger(value.claimLeaseSeconds) || Number(value.claimLeaseSeconds) < 1 ||
    !Number.isSafeInteger(value.qrIssuanceSeconds) || Number(value.qrIssuanceSeconds) < 1 || !Array.isArray(value.sourceAccounts) || value.canReconcile && !value.canExecute)
    return fail("Invalid manual payout capabilities");
  const sourceAccounts = value.sourceAccounts.map((account) => isRecord(account) && isUuid(account.id) && text(account.alias, 120) && noSensitive(account) ? { id: account.id, alias: account.alias } : fail("Invalid platform source account"));
  if (new Set(sourceAccounts.map((account) => account.id)).size !== sourceAccounts.length) fail("Repeated platform source account");
  return { canExecute: value.canExecute, canReconcile: value.canReconcile, newWorkEnabled: value.newWorkEnabled, automaticJobsEnabled: value.automaticJobsEnabled,
    serverTime: value.serverTime, claimLeaseSeconds: Number(value.claimLeaseSeconds), qrIssuanceSeconds: Number(value.qrIssuanceSeconds), sourceAccounts };
};

export const parseManualPayoutSummary = (value: unknown): ManualPayoutSummary => {
  if (!isRecord(value) || !noSensitive(value) || !isUuid(value.id) || !isUuid(value.orderId) || !isUuid(value.sellerId) || !oneOf(payoutStatuses, value.status) ||
    !oneOf(executionModes, value.executionMode) || value.currency !== "VND" || !version(value.version) || !nullable(value.claimedBy, isUuid) || typeof value.claimedByMe !== "boolean" ||
    value.claimedByMe && value.claimedBy === null || !nullable(value.receiptStatus, (entry): entry is ReceiptStatus => oneOf(receiptStatuses, entry)) ||
    typeof value.hasOpenDispute !== "boolean" || typeof value.needsReview !== "boolean" || !nullable(value.blockedReason, (entry): entry is string => text(entry, 300)) || !instant(value.createdAt))
    return fail("Invalid manual payout row");
  const netAmount = exactMoney(value.netAmount, "net");
  if (minor(netAmount) <= BigInt(0)) fail("Manual payout net amount must be positive");
  if (value.status === "ON_HOLD" && value.blockedReason === null) fail("An on-hold payout must state why it is blocked");
  if (value.hasOpenDispute && !value.needsReview) fail("An open seller dispute must be review-needed");
  return { id: value.id, orderId: value.orderId, sellerId: value.sellerId, status: value.status, executionMode: value.executionMode, netAmount, currency: "VND",
    version: Number(value.version), claimedBy: value.claimedBy, claimedByMe: value.claimedByMe, receiptStatus: value.receiptStatus, hasOpenDispute: value.hasOpenDispute,
    needsReview: value.needsReview, blockedReason: value.blockedReason, createdAt: value.createdAt };
};

const parseEvidence = (value: unknown): ManualEvidence => {
  if (!isRecord(value) || !isUuid(value.id) || !text(value.fileName, 255) || !oneOf(evidenceContentTypes, value.contentType) || !Number.isSafeInteger(value.size) ||
    Number(value.size) < 1 || Number(value.size) > maxEvidenceBytes || !instant(value.uploadedAt) || Object.hasOwn(value, "url") || Object.hasOwn(value, "publicUrl"))
    return fail("Invalid evidence reference");
  return { id: value.id, fileName: value.fileName, contentType: value.contentType, size: Number(value.size), uploadedAt: value.uploadedAt };
};
const parseConfirmation = (value: unknown): ManualConfirmation => {
  if (!isRecord(value) || !isUuid(value.sourceAccountId) || !text(value.bankTransferReference, 64) || !instant(value.transferredAt) || !instant(value.recordedAt))
    return fail("Invalid staff confirmation");
  return { sourceAccountId: value.sourceAccountId, amount: exactMoney(value.amount, "confirmed"), bankTransferReference: value.bankTransferReference, transferredAt: value.transferredAt, recordedAt: value.recordedAt };
};
const parseAttempt = (value: unknown): ManualAttempt => {
  if (!isRecord(value) || !noSensitive(value) || !isUuid(value.id) || !Number.isSafeInteger(value.attemptNo) || Number(value.attemptNo) < 1 || !oneOf(manualAttemptStates, value.state) ||
    !version(value.version) || !isUuid(value.ownerId) || typeof value.ownedByMe !== "boolean" || !nullable(value.reference, (entry): entry is string => text(entry, 64)) ||
    !nullable(value.leaseExpiresAt, instant) || !nullable(value.qrDeadline, instant) || !oneOf(receiptStatuses, value.receiptStatus) || !version(value.receiptVersion) || !Array.isArray(value.evidence))
    return fail("Invalid manual attempt");
  const evidence = value.evidence.map(parseEvidence);
  if (evidence.length > maxEvidenceFiles || new Set(evidence.map((entry) => entry.id)).size !== evidence.length) fail("Invalid attempt evidence list");
  const confirmation = value.confirmation === null || value.confirmation === undefined ? null : parseConfirmation(value.confirmation);
  if (value.state === "CLAIMED" && (value.leaseExpiresAt === null || value.reference !== null)) fail("A claimed attempt needs a lease and no issued reference");
  if (value.state === "QR_ISSUED" && (value.reference === null || value.qrDeadline === null)) fail("An issued QR needs a fixed reference and deadline");
  if (value.state === "SUCCEEDED" && confirmation === null) fail("A succeeded manual attempt needs its staff confirmation");
  if (value.receiptStatus !== "NOT_REQUESTED" && confirmation === null) fail("Seller receipt cannot be requested before staff confirmation");
  return { id: value.id, attemptNo: Number(value.attemptNo), state: value.state, version: Number(value.version), ownerId: value.ownerId, ownedByMe: value.ownedByMe,
    reference: value.reference, leaseExpiresAt: value.leaseExpiresAt, qrDeadline: value.qrDeadline, receiptStatus: value.receiptStatus, receiptVersion: Number(value.receiptVersion), evidence, confirmation };
};
export const parseReceiptDispute = (value: unknown): ReceiptDispute => {
  if (!isRecord(value) || !isUuid(value.id) || !oneOf(disputeStatuses, value.status) || !oneOf(disputeReasons, value.reason) || !text(value.explanation, 1000) || !version(value.version) || !instant(value.openedAt))
    return fail("Invalid receipt dispute");
  return { id: value.id, status: value.status, reason: value.reason, explanation: value.explanation, version: Number(value.version), openedAt: value.openedAt };
};
const parseHistory = (value: unknown): ManualHistoryEntry => {
  if (!isRecord(value) || !noSensitive(value) || !isUuid(value.id) || !oneOf(manualHistoryEvents, value.event) || !nullable(value.fromStatus, (entry): entry is PayoutStatus => oneOf(payoutStatuses, entry)) ||
    !oneOf(payoutStatuses, value.toStatus) || !Number.isSafeInteger(value.attemptNo) || Number(value.attemptNo) < 0 || !nullable(value.attemptState, (entry): entry is ManualAttempt["state"] => oneOf(manualAttemptStates, entry)) ||
    !isUuid(value.actorId) || !oneOf(actorRoles, value.actorRole) || !nullable(value.confirmationSource, (entry): entry is ManualPayoutDetail["confirmationSource"] & string => oneOf(confirmationSources, entry)) ||
    !nullable(value.reference, (entry): entry is string => text(entry, 64)) || !nullable(value.reason, (entry): entry is string => text(entry, 1000)) || typeof value.simulated !== "boolean" || !instant(value.occurredAt))
    return fail("Invalid manual payout history step");
  return { id: value.id, event: value.event, fromStatus: value.fromStatus, toStatus: value.toStatus, attemptNo: Number(value.attemptNo), attemptState: value.attemptState,
    amount: exactMoney(value.amount, "history"), actorId: value.actorId, actorRole: value.actorRole, confirmationSource: value.confirmationSource, reference: value.reference,
    reason: value.reason, simulated: value.simulated, occurredAt: value.occurredAt };
};
const parseRecipient = (value: unknown): ManualRecipient | null => {
  if (value === null) return null;
  if (!isRecord(value) || !noSensitive(value) || !text(value.bankName, 120) || !text(value.holderName, 120) || typeof value.accountLast4 !== "string" || !/^\d{4}$/.test(value.accountLast4))
    return fail("Invalid masked recipient");
  return { bankName: value.bankName, holderName: value.holderName, accountLast4: value.accountLast4 };
};
const attemptActions = ["ISSUE_QR", "VIEW_QR", "RELEASE", "UPLOAD_EVIDENCE", "CONFIRM", "REPORT_PROBLEM"] as const;

export const parseManualPayoutDetail = (value: unknown): ManualPayoutDetail => {
  const summary = parseManualPayoutSummary(value);
  if (!isRecord(value) || !instant(value.serverTime) || !Array.isArray(value.allowedActions) || !Array.isArray(value.history) ||
    !nullable(value.confirmationSource, (entry): entry is ManualPayoutDetail["confirmationSource"] & string => oneOf(confirmationSources, entry)))
    return fail("Invalid manual payout detail");
  const orderAmount = exactMoney(value.orderAmount, "order"), shippingFee = exactMoney(value.shippingFee, "shipping"), platformFee = exactMoney(value.platformFee, "platform fee");
  if (minor(orderAmount) - minor(shippingFee) - minor(platformFee) !== minor(summary.netAmount)) fail("Manual payout breakdown does not balance");
  const allowedActions = value.allowedActions.map((action) => oneOf(manualPayoutActions, action) ? action : fail("Unknown manual payout action"));
  if (new Set(allowedActions).size !== allowedActions.length) fail("Repeated manual payout action");
  const attempt = value.attempt === null ? null : parseAttempt(value.attempt);
  const dispute = value.dispute === null ? null : parseReceiptDispute(value.dispute);
  const history = value.history.map(parseHistory);
  if (new Set(history.map((step) => step.id)).size !== history.length || history.some((step, index) => index > 0 && Date.parse(step.occurredAt) > Date.parse(history[index - 1].occurredAt)))
    fail("Manual payout history must be unique and newest first");
  const has = (action: typeof manualPayoutActions[number]) => allowedActions.includes(action);
  if (summary.executionMode === "AUTO" && allowedActions.length) fail("Automatic payouts never expose manual actions");
  if (attemptActions.some(has) && (!attempt || !attempt.ownedByMe)) fail("Attempt actions belong only to the owning executor");
  if (has("VIEW_QR") && attempt?.state !== "QR_ISSUED") fail("A QR can be read only for an issued attempt");
  if (has("ISSUE_QR") && attempt?.state !== "CLAIMED") fail("Only a claimed attempt can issue a QR");
  if (has("CLAIM") && summary.status !== "PENDING") fail("Only a pending payout can be claimed");
  if (has("RETRY") && !["FAILED", "RETURNED"].includes(summary.status)) fail("Only a reconciled failed or returned payout can be retried");
  if (has("REVIEW_DISPUTE") && (!dispute || dispute.status === "RESOLVED")) fail("Dispute review needs an unresolved case");
  if (summary.executionMode === "MANUAL" && summary.status === "SUCCEEDED" && value.confirmationSource !== "MANUAL_STAFF_CONFIRMED") fail("Manual success must stay staff-confirmed");
  if (summary.hasOpenDispute !== (dispute !== null && dispute.status !== "RESOLVED")) fail("Open dispute flag does not match the case");
  return { ...summary, orderAmount, shippingFee, platformFee, platformFeeRate: feeRate(value.platformFeeRate), confirmationSource: value.confirmationSource,
    recipient: parseRecipient(value.recipient), serverTime: value.serverTime, attempt, dispute, allowedActions, history };
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
const pageOf = (response: ApiResponse<unknown>, number: number): Page<ManualPayoutSummary> => {
  if (!Array.isArray(response.data) || !response.page || response.page.number !== number || response.data.length > response.page.size || response.data.length > response.page.totalElements)
    return fail("Invalid manual payout page");
  const content = response.data.map(parseManualPayoutSummary);
  if (new Set(content.map((row) => row.id)).size !== content.length) fail("Repeated manual payout row");
  return { content, page: response.page.number, size: response.page.size, totalElements: response.page.totalElements, totalPages: response.page.totalPages };
};
const commandOptions = (options: ServiceRequestOptions, key: string): ServiceRequestOptions => {
  if (!isUuid(key)) fail("A UUID idempotency key is required");
  const headers = new AxiosHeaders(options.config?.headers); headers.set("Idempotency-Key", key);
  return { ...options, auth: true, params: undefined, config: { ...options.config, headers } };
};
const ensureIds = (...ids: string[]) => { if (ids.some((id) => !isUuid(id))) fail("A valid payout, attempt or evidence reference is required"); };
const detailFor = (data: unknown, payoutId: string, attemptId?: string) => {
  const detail = parseManualPayoutDetail(data);
  if (detail.id !== payoutId || attemptId && detail.attempt?.id !== attemptId) fail("Manual payout reference mismatch");
  return detail;
};
const command = async <T>(route: string, payoutId: string, attemptId: string | undefined, versionField: string, input: ManualCommand<T>, options: ServiceRequestOptions) => {
  if (!version(input.expectedVersion)) fail("An exact expected version is required");
  const { data } = await requestApi("POST", route, { [versionField]: input.expectedVersion, ...(input.body ?? {}) }, commandOptions(options, input.idempotencyKey));
  return detailFor(data, payoutId, attemptId);
};
const attemptRoute = (payoutId: string, attemptId: string, suffix: string) => { ensureIds(payoutId, attemptId); return `${path}/${payoutId}/attempts/${attemptId}/${suffix}`; };

export const getManualPayoutCapabilities = async (options: ServiceRequestOptions = {}) =>
  parseCapabilities((await requestApi("GET", `${path}/capabilities`, undefined, { ...options, auth: true, params: undefined })).data);

export const getManualPayouts = async (filters: ManualPayoutFilters = {}, options: ServiceRequestOptions = {}): Promise<Page<ManualPayoutSummary>> => {
  const params = validateFilters(filters);
  const response = await requestApi("GET", path, undefined, { ...options, auth: true, params, config: { ...options.config, paramsSerializer: { indexes: null } } });
  const result = pageOf(response, Number(params.page));
  if (result.content.some((row) => filters.sellerId && row.sellerId !== filters.sellerId || filters.status?.length && !filters.status.includes(row.status) ||
    filters.claimedBy === "me" && !row.claimedByMe || filters.receiptStatus && row.receiptStatus !== filters.receiptStatus || filters.hasOpenDispute && !row.hasOpenDispute ||
    filters.needsReview && !row.needsReview || row.executionMode !== "MANUAL"))
    fail("Manual payout queue does not match the requested filters");
  return result;
};
export const getManualPayoutDetail = async (payoutId: string, options: ServiceRequestOptions = {}) => {
  ensureIds(payoutId);
  return detailFor((await requestApi("GET", `${path}/${payoutId}`, undefined, { ...options, auth: true, params: undefined })).data, payoutId);
};
export const checkManualPayoutReadiness = async (payoutId: string, input: ManualCommand, options: ServiceRequestOptions = {}) => {
  ensureIds(payoutId); return command(`${path}/${payoutId}/readiness-check`, payoutId, undefined, "expectedPayoutVersion", input, options);
};
export const claimManualPayout = async (payoutId: string, input: ManualCommand, options: ServiceRequestOptions = {}) => {
  ensureIds(payoutId); return command(`${path}/${payoutId}/claims`, payoutId, undefined, "expectedPayoutVersion", input, options);
};
export const issueManualPayoutQr = async (payoutId: string, attemptId: string, input: ManualCommand, options: ServiceRequestOptions = {}) =>
  command(attemptRoute(payoutId, attemptId, "qr-issuances"), payoutId, attemptId, "expectedAttemptVersion", input, options);
export const getManualPayoutQr = async (payoutId: string, attemptId: string, options: ServiceRequestOptions = {}) =>
  requestApiBlob(attemptRoute(payoutId, attemptId, "qr"), ["image/png"], { ...options, auth: true, params: undefined });
export const releaseManualPayoutClaim = async (payoutId: string, attemptId: string, input: ManualCommand<{ reason?: string }>, options: ServiceRequestOptions = {}) =>
  command(attemptRoute(payoutId, attemptId, "release"), payoutId, attemptId, "expectedAttemptVersion", input, options);
export const uploadManualPayoutEvidence = async (payoutId: string, attemptId: string, file: File, input: ManualCommand, options: ServiceRequestOptions = {}) => {
  if (!oneOf(evidenceContentTypes, file.type) || file.size < 1 || file.size > maxEvidenceBytes) fail("Evidence must be a JPEG, PNG or PDF file up to 10 MiB");
  if (!version(input.expectedVersion)) fail("An exact expected version is required");
  const form = new FormData(); form.append("file", file, file.name); form.append("expectedAttemptVersion", String(input.expectedVersion));
  const { data } = await requestApi("POST", attemptRoute(payoutId, attemptId, "evidence"), form, commandOptions(options, input.idempotencyKey));
  return detailFor(data, payoutId, attemptId);
};
export const getManualPayoutEvidence = async (payoutId: string, attemptId: string, evidenceId: string, options: ServiceRequestOptions = {}) => {
  ensureIds(evidenceId);
  return requestApiBlob(`${attemptRoute(payoutId, attemptId, "evidence")}/${evidenceId}`, evidenceContentTypes, { ...options, auth: true, params: undefined });
};
export const confirmManualPayout = async (payoutId: string, attemptId: string, input: ManualCommand<ManualConfirmationInput>, options: ServiceRequestOptions = {}) => {
  const body = input.body;
  if (!body || !isUuid(body.sourceAccountId) || !text(body.bankTransferReference, 64) || !instant(body.transferredAt) || exactMoney(body.amount, "transferred") !== body.amount ||
    body.evidenceIds.length < 1 || body.evidenceIds.length > maxEvidenceFiles || body.evidenceIds.some((id) => !isUuid(id)))
    fail("Confirmation needs source account, exact amount, bank reference, transfer time and 1-3 evidence files");
  return command(attemptRoute(payoutId, attemptId, "confirmation"), payoutId, attemptId, "expectedAttemptVersion", input, options);
};
export const reportManualPayoutProblem = async (payoutId: string, attemptId: string, input: ManualCommand<ManualProblemInput>, options: ServiceRequestOptions = {}) => {
  if (!input.body || !text(input.body.reason.trim(), 1000) || input.body.evidenceIds.length > maxEvidenceFiles) fail("A problem report needs a reason");
  return command(attemptRoute(payoutId, attemptId, "problems"), payoutId, attemptId, "expectedAttemptVersion", input, options);
};
export const resolveManualPayout = async (payoutId: string, attemptId: string, input: ManualCommand<ManualResolutionInput>, options: ServiceRequestOptions = {}) => {
  const body = input.body;
  if (!body || !text(body.reason.trim(), 1000) || body.outcome !== "CONFIRMED_SENT" && !body.evidenceIds.length ||
    body.outcome === "CONFIRMATION_RECORDED_IN_ERROR" && (!body.disputeId || !version(body.expectedDisputeVersion)))
    fail("Resolution needs a reason, outcome-specific proof and, for a correction, the open case version");
  return command(attemptRoute(payoutId, attemptId, "resolution"), payoutId, attemptId, "expectedAttemptVersion", input, options);
};
export const reviewReceiptDispute = async (payoutId: string, attemptId: string, disputeId: string, input: ManualCommand<DisputeReviewInput>, options: ServiceRequestOptions = {}) => {
  ensureIds(disputeId);
  if (!input.body || !text(input.body.note.trim(), 1000)) fail("A dispute review needs a note");
  return command(`${attemptRoute(payoutId, attemptId, "receipt-disputes")}/${disputeId}/reviews`, payoutId, attemptId, "expectedAttemptVersion", input, options);
};
export const retryManualPayout = async (payoutId: string, input: ManualCommand<{ reason: string }>, options: ServiceRequestOptions = {}) => {
  ensureIds(payoutId);
  if (!input.body || !text(input.body.reason.trim(), 1000)) fail("A retry needs a reason");
  return command(`${path}/${payoutId}/retries`, payoutId, undefined, "expectedPayoutVersion", input, options);
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
    case 501: case 503: return "Manual payouts are not available yet. No payout was changed.";
    default: return error.detail || error.title;
  }
};
