import { AxiosHeaders } from "axios";
import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import { normalizeMoney } from "./catalogService";
import type { ApiError, ApiResponse, Page } from "../types/commonResponseType";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import { payoutHistoryEvents, payoutStatuses, type PayoutDetail, type PayoutFilters, type PayoutHistoryEntry, type PayoutStatus, type SellerPayout } from "../types/payoutType";
import { disputeReasons, disputeStatuses, receiptStatuses, sellerReceiptActions, type ReceiptDispute, type SellerManualReceipt, type SellerReceiptAction } from "../types/payoutReceiptType";
import { manualAttemptStates } from "../types/manualPayoutType";

// API #257 đã triển khai; admin list vẫn thuộc #261.
const path = "/api/v1/payments/payouts";
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const text = (value: unknown, max = 500): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const instant = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
const status = (value: unknown): value is PayoutStatus => payoutStatuses.some((entry) => entry === value);
const nullableText = (value: unknown) => value === null || text(value);
const last4 = (value: unknown): value is string | null => value === null || typeof value === "string" && /^\d{4}$/.test(value);
const money = (value: unknown): string => {
  const normalized = normalizeMoney(value);
  if (normalized === null || !/^\d{1,17}\.\d{2}$/.test(normalized) ||
    typeof value === "number" && (Number(normalized) !== value || BigInt(normalized.replace(".", "")) > BigInt(Number.MAX_SAFE_INTEGER)))
    throw createInvalidResponseError("Invalid payout decimal amount");
  return normalized;
};
const feeRate = (value: unknown): string => {
  const normalized = typeof value === "number" && Number.isFinite(value) ? String(value) : value;
  if (typeof normalized !== "string" || !/^(?:0(?:\.\d{1,4})?|1(?:\.0{1,4})?)$/.test(normalized))
    throw createInvalidResponseError("Invalid payout platform fee rate");
  return normalized;
};
const minor = (value: string) => BigInt(value.replace(".", ""));

export const parseSellerPayout = (value: unknown): SellerPayout => {
  if (!isRecord(value) || !uuid(value.id) || !uuid(value.orderId) || !uuid(value.sellerId) || value.currency !== "VND" || !status(value.status) ||
    !Number.isSafeInteger(value.attemptCount) || Number(value.attemptCount) < 0 || !last4(value.recipientAccountLast4) ||
    !(value.providerReference == null || text(value.providerReference, 200)) || !instant(value.createdAt) ||
    typeof value.simulated !== "boolean" ||
    ["accountNumber", "recipientAccountNumber", "recipientAccountEncrypted"].some((key) => Object.hasOwn(value, key)))
    throw createInvalidResponseError("Invalid payout response");
  const orderAmount = money(value.orderAmount), shippingFee = money(value.shippingFee), platformFee = money(value.platformFee), netAmount = money(value.netAmount);
  const platformFeeRate = feeRate(value.platformFeeRate);
  if (minor(netAmount) <= BigInt(0) || minor(orderAmount) - minor(shippingFee) - minor(platformFee) !== minor(netAmount))
    throw createInvalidResponseError("Payout amount breakdown does not balance");
  const executionMode = value.executionMode === undefined ? "AUTO" : value.executionMode;
  const confirmationSource = value.confirmationSource ?? null;
  if (executionMode !== "AUTO" && executionMode !== "MANUAL" || ![null, "MANUAL_STAFF_CONFIRMED", "BANK_VERIFIED", "PROVIDER_CONFIRMED", "SIMULATED"].includes(confirmationSource as string | null))
    throw createInvalidResponseError("Invalid payout execution mode");
  if (["SUCCEEDED", "RETURNED"].includes(value.status) &&
    (Number(value.attemptCount) < 1 || value.recipientAccountLast4 === null || executionMode === "AUTO" && !text(value.providerReference, 200)))
    throw createInvalidResponseError("Confirmed payout requires an attempted transfer, receiving account and provider reference");
  const manual = value.manual == null ? null : parseSellerManualReceipt(value.manual);
  if (manual && executionMode !== "MANUAL") throw createInvalidResponseError("Receipt actions exist only for manual payouts");
  return { id: value.id, orderId: value.orderId, sellerId: value.sellerId, orderAmount, shippingFee, platformFeeRate,
    platformFee, netAmount, currency: "VND", status: value.status, attemptCount: Number(value.attemptCount), recipientAccountLast4: value.recipientAccountLast4,
    providerReference: value.providerReference == null ? null : value.providerReference, createdAt: value.createdAt, simulated: value.simulated,
    executionMode, confirmationSource: confirmationSource as SellerPayout["confirmationSource"], manual };
};

export const parseSellerManualReceipt = (value: unknown): SellerManualReceipt => {
  if (!isRecord(value) || !uuid(value.attemptId) || !manualAttemptStates.some((state) => state === value.attemptState) ||
    !receiptStatuses.some((state) => state === value.receiptStatus) || !Number.isSafeInteger(value.receiptVersion) || Number(value.receiptVersion) < 0 ||
    typeof value.hasOpenDispute !== "boolean" || !Array.isArray(value.allowedActions) ||
    ["evidence", "notes", "explanation", "recipientAccountNumber", "accountNumber"].some((key) => Object.hasOwn(value, key)))
    throw createInvalidResponseError("Invalid seller receipt state");
  const actions = value.allowedActions.map((action) => { if (!sellerReceiptActions.some((entry) => entry === action)) throw createInvalidResponseError("Unknown seller receipt action"); return action as SellerReceiptAction; });
  const dispute = value.dispute == null ? null : parseReceiptDispute(value.dispute);
  if (new Set(actions).size !== actions.length || actions.length && value.attemptState !== "SUCCEEDED" || actions.includes("CONFIRM_RECEIPT") && value.receiptStatus === "CONFIRMED" ||
    value.hasOpenDispute && (!dispute || dispute.status === "RESOLVED"))
    throw createInvalidResponseError("Seller receipt actions do not match the attempt");
  return { attemptId: value.attemptId, attemptState: value.attemptState as SellerManualReceipt["attemptState"], receiptStatus: value.receiptStatus as SellerManualReceipt["receiptStatus"],
    receiptVersion: Number(value.receiptVersion), hasOpenDispute: value.hasOpenDispute, allowedActions: actions, dispute };
};

const parseReceiptDispute = (value: unknown): ReceiptDispute => {
  if (!isRecord(value) || !uuid(value.id) || !disputeStatuses.some((entry) => entry === value.status) || !disputeReasons.some((entry) => entry === value.reason))
    throw createInvalidResponseError("Invalid receipt dispute");
  return { id: value.id, status: value.status as ReceiptDispute["status"], reason: value.reason as ReceiptDispute["reason"] };
};

export const parsePayoutHistoryEntry = (value: unknown): PayoutHistoryEntry => {
  if (!isRecord(value) || !uuid(value.id) || !payoutHistoryEvents.some((event) => event === value.event) || !(value.fromStatus === null || status(value.fromStatus)) || !status(value.toStatus) ||
    !Number.isSafeInteger(value.attemptNo) || Number(value.attemptNo) < 0 || !(value.sellerBankId === null || uuid(value.sellerBankId)) || !last4(value.recipientAccountLast4) ||
    ![value.provider, value.providerReference, value.providerStatus, value.errorCode, value.errorMessage].every(nullableText) ||
    typeof value.simulated !== "boolean" || !uuid(value.actorId) || !instant(value.occurredAt) ||
    ["accountNumber", "recipientAccountNumber", "recipientAccountEncrypted"].some((key) => Object.hasOwn(value, key)))
    throw createInvalidResponseError("Invalid payout history step");
  return { id: value.id, event: value.event as PayoutHistoryEntry["event"], fromStatus: value.fromStatus, toStatus: value.toStatus,
    attemptNo: Number(value.attemptNo), amount: money(value.amount), sellerBankId: value.sellerBankId, recipientAccountLast4: value.recipientAccountLast4,
    provider: value.provider as string | null, providerReference: value.providerReference as string | null, providerStatus: value.providerStatus as string | null,
    errorCode: value.errorCode as string | null, errorMessage: value.errorMessage as string | null, simulated: value.simulated, actorId: value.actorId, occurredAt: value.occurredAt };
};

export const parsePayoutDetail = (value: unknown): PayoutDetail => {
  const payout = parseSellerPayout(value);
  if (!isRecord(value) || !Array.isArray(value.history)) throw createInvalidResponseError("Missing payout history");
  const history = value.history.map(parsePayoutHistoryEntry);
  if (new Set(history.map((step) => step.id)).size !== history.length)
    throw createInvalidResponseError("Payout history must be unique");
  return { ...payout, history };
};

const pageOf = (response: ApiResponse<unknown>, number: number): Page<SellerPayout> => {
  if (!Array.isArray(response.data) || !response.page || response.page.number !== number || response.data.length > response.page.size || response.data.length > response.page.totalElements)
    throw createInvalidResponseError("Invalid payout page");
  const content = response.data.map(parseSellerPayout);
  if (new Set(content.map((row) => row.id)).size !== content.length) throw createInvalidResponseError("Repeated payout page item");
  return { content, page: response.page.number, size: response.page.size, totalElements: response.page.totalElements, totalPages: response.page.totalPages };
};
const validateFilters = (filters: PayoutFilters) => {
  const { page = 0, size = 10, sellerId, status: statuses, from, to } = filters;
  if (!Number.isSafeInteger(page) || page < 0 || page > 2147483646 || !Number.isInteger(size) || size < 1 || size > 100 || sellerId !== undefined && !uuid(sellerId) ||
    statuses !== undefined && (!Array.isArray(statuses) || new Set(statuses).size !== statuses.length || statuses.some((item) => !status(item))) ||
    from !== undefined && !instant(from) || to !== undefined && !instant(to) || from && to && Date.parse(from) > Date.parse(to))
    throw createInvalidResponseError("Invalid payout filters");
  return { page, size, sellerId, status: statuses, from, to };
};

export const getSellerPayouts = async (page = 0, options: ServiceRequestOptions = {}): Promise<Page<SellerPayout>> => {
  const filters = validateFilters({ page });
  return pageOf(await requestApi("GET", `${path}/me`, undefined, { ...options, auth: true, params: { page: filters.page, size: filters.size } }), filters.page);
};
export const getAdminPayouts = async (filters: PayoutFilters = {}, options: ServiceRequestOptions = {}): Promise<Page<SellerPayout>> => {
  const params = validateFilters(filters);
  const response = await requestApi("GET", path, undefined, { ...options, auth: true, params,
    config: { ...options.config, paramsSerializer: { indexes: null } } });
  const result = pageOf(response, params.page);
  if (result.content.some((row) => params.sellerId && row.sellerId !== params.sellerId || params.status?.length && !params.status.includes(row.status)))
    throw createInvalidResponseError("Payout list does not match the requested filters");
  return result;
};
export const getPayoutDetail = async (id: string, options: ServiceRequestOptions = {}): Promise<PayoutDetail> => {
  if (!uuid(id)) throw createInvalidResponseError("A valid payout reference is required");
  const { data } = await requestApi("GET", `${path}/${id}`, undefined, { ...options, auth: true, params: undefined });
  const result = parsePayoutDetail(data);
  if (result.id !== id) throw createInvalidResponseError("Payout reference mismatch");
  return result;
};
export const retryPayout = async (id: string, idempotencyKey: string, options: ServiceRequestOptions = {}): Promise<PayoutDetail> => {
  if (!uuid(id) || !uuid(idempotencyKey)) throw createInvalidResponseError("A valid payout reference and retry key are required");
  const headers = new AxiosHeaders(options.config?.headers); headers.set("Idempotency-Key", idempotencyKey);
  const { data } = await requestApi("POST", `${path}/${id}/retry`, undefined, { ...options, auth: true, params: undefined, config: { ...options.config, headers } });
  const result = parsePayoutDetail(data);
  if (result.id !== id) throw createInvalidResponseError("Payout retry reference mismatch");
  return result;
};
export const payoutErrorMessage = (error: ApiError): string => error.status === 404 || error.status === 501 ? "This payout or payout service is unavailable. Refresh the list or try again later." :
  error.status === 403 ? "Your account cannot access these payouts." : error.detail || error.title;
