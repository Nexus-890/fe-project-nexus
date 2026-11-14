import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import { normalizeMoney } from "./catalogService";
import type { ApiError, ApiResponse, Page } from "../types/commonResponseType";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import { payoutStatuses, type CreatePayoutInput, type PayableOrder, type SellerBankAccount, type SellerBankAccountInput, type SellerPayout } from "../types/payoutType";

// #261 has no delivered BE/OpenAPI yet. Keep this boundary aligned with the
// explicitly proposed docs/api/seller-payouts.openapi.yaml, without mock fallback.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (value: unknown, max = 200): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const date = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
const positiveMoney = (value: unknown): string => {
  // Reject values that would be rounded or rendered in exponent notation before display.
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > Number.MAX_SAFE_INTEGER / 100 || Number(value.toFixed(2)) !== value)
    throw createInvalidResponseError("Invalid payout amount");
  const amount = normalizeMoney(value);
  if (amount === null) throw createInvalidResponseError("Invalid payout amount");
  return amount;
};

export const parseSellerBankAccount = (value: unknown): SellerBankAccount => {
  if (!isRecord(value) || !text(value.id) || !uuid.test(value.id) || !text(value.bankCode, 32) ||
    !text(value.bankName, 100) || !text(value.accountHolder, 100) || typeof value.last4 !== "string" || !/^\d{4}$/.test(value.last4) ||
    typeof value.verified !== "boolean" || !date(value.createdAt) ||
    ["accountNumber", "bankAccountNumber", "bankAccount"].some((key) => Object.hasOwn(value, key)))
    throw createInvalidResponseError("Invalid masked bank account response");
  return { id: value.id, bankCode: value.bankCode, bankName: value.bankName, accountHolder: value.accountHolder,
    last4: value.last4, verified: value.verified, createdAt: value.createdAt };
};

export const maskedBankAccount = (account: Pick<SellerBankAccount, "last4">): string => `•••• ${account.last4}`;

const uniqueAccounts = (value: unknown): SellerBankAccount[] => {
  if (!Array.isArray(value)) throw createInvalidResponseError("Invalid bank account list");
  const accounts = value.map(parseSellerBankAccount);
  if (new Set(accounts.map((account) => account.id)).size !== accounts.length) throw createInvalidResponseError("Repeated bank account");
  return accounts;
};

export const parseSellerPayout = (value: unknown): SellerPayout => {
  if (!isRecord(value) || !text(value.id) || !uuid.test(value.id) || !text(value.orderId) || !uuid.test(value.orderId) ||
    !text(value.orderNumber, 100) || !payoutStatuses.includes(value.status as never) || !date(value.createdAt) ||
    (value.paidAt !== null && !date(value.paidAt)) || (value.reference !== null && !text(value.reference, 200)))
    throw createInvalidResponseError("Invalid payout response");
  return { id: value.id, orderId: value.orderId, orderNumber: value.orderNumber, amount: positiveMoney(value.amount),
    bankAccount: parseSellerBankAccount(value.bankAccount), status: value.status as SellerPayout["status"], createdAt: value.createdAt,
    paidAt: value.paidAt as string | null, reference: value.reference as string | null };
};

const pageOf = <T>(response: ApiResponse<unknown>, number: number, parse: (value: unknown) => T, identity: (value: T) => string): Page<T> => {
  if (!Array.isArray(response.data) || !response.page || response.page.number !== number) throw createInvalidResponseError("Invalid payout page");
  const content = response.data.map(parse);
  if (new Set(content.map(identity)).size !== content.length) throw createInvalidResponseError("Repeated payout page item");
  return { content, page: response.page.number, size: response.page.size, totalElements: response.page.totalElements, totalPages: response.page.totalPages };
};
const assertPage = (page: number): void => {
  if (!Number.isSafeInteger(page) || page < 0 || page > 2147483646) throw createInvalidResponseError("Invalid payout page number");
};

export const getSellerBankAccounts = async (options: ServiceRequestOptions = {}): Promise<SellerBankAccount[]> => {
  const { data } = await requestApi("GET", "/api/v1/sellers/me/bank-accounts", undefined, { ...options, auth: true });
  return uniqueAccounts(data);
};

export const addSellerBankAccount = async (body: SellerBankAccountInput, options: ServiceRequestOptions = {}): Promise<SellerBankAccount> => {
  if (!text(body.bankCode, 32) || !/^[A-Za-z0-9_-]+$/.test(body.bankCode.trim()) || !text(body.bankName, 100) ||
    !text(body.accountHolder, 100) || !/^\d{6,34}$/.test(body.accountNumber)) throw createInvalidResponseError("Enter valid bank and account details");
  const { data } = await requestApi("POST", "/api/v1/sellers/me/bank-accounts", {
    bankCode: body.bankCode.trim(), bankName: body.bankName.trim(), accountHolder: body.accountHolder.trim(), accountNumber: body.accountNumber,
  }, { ...options, auth: true });
  const account = parseSellerBankAccount(data);
  if (account.last4 !== body.accountNumber.slice(-4) || account.verified) throw createInvalidResponseError("Invalid newly added bank account");
  return account;
};

export const getSellerPayouts = async (page: number, options: ServiceRequestOptions = {}): Promise<Page<SellerPayout>> => {
  assertPage(page);
  return pageOf(await requestApi("GET", "/api/v1/sellers/me/payouts", undefined, { ...options, auth: true, params: { page, size: 10 } }), page, parseSellerPayout, (row) => row.id);
};

export const getPayableOrders = async (page: number, options: ServiceRequestOptions = {}): Promise<Page<PayableOrder>> => {
  assertPage(page);
  return pageOf(await requestApi("GET", "/api/v1/payouts/payable-orders", undefined, { ...options, auth: true, params: { page, size: 10 } }), page, (value) => {
    if (!isRecord(value) || !text(value.orderId) || !uuid.test(value.orderId) || !text(value.orderNumber, 100) ||
      !text(value.sellerId) || !uuid.test(value.sellerId) || !text(value.sellerName, 100) || !date(value.completedAt) ||
      value.status !== "COMPLETED" || value.payoutId !== null || value.refundStatus !== null)
      throw createInvalidResponseError("Invalid completed payable order");
    return { orderId: value.orderId, orderNumber: value.orderNumber, sellerId: value.sellerId, sellerName: value.sellerName,
      totalAmount: positiveMoney(value.totalAmount), completedAt: value.completedAt, bankAccounts: uniqueAccounts(value.bankAccounts) };
  }, (row) => row.orderId);
};

export const createSellerPayout = async (body: CreatePayoutInput, idempotencyKey: string, options: ServiceRequestOptions = {}): Promise<SellerPayout> => {
  if (!uuid.test(body.orderId) || !uuid.test(body.bankAccountId) || !uuid.test(idempotencyKey)) throw createInvalidResponseError("Invalid payout request");
  const { data } = await requestApi("POST", "/api/v1/payouts", { orderId: body.orderId, bankAccountId: body.bankAccountId }, { ...options, auth: true,
    config: { ...options.config, headers: { ...options.config?.headers, "Idempotency-Key": idempotencyKey } } });
  const result = parseSellerPayout(data);
  if (result.orderId !== body.orderId || result.bankAccount.id !== body.bankAccountId || !result.bankAccount.verified)
    throw createInvalidResponseError("Mismatched payout response");
  return result;
};

export const payoutErrorMessage = (error: ApiError): string => {
  if (error.status === 404 || error.status === 501) return "Payout services are not available yet. Please try again later.";
  if (error.status === 403) return "Your account cannot access these bank accounts or payouts.";
  return error.detail || error.title;
};
