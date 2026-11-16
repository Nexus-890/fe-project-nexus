import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { ApiError, Page } from "../types/commonResponseType";
import { bankVerificationStatuses, type SellerBankAccount, type SellerBankAccountFilters, type SellerBankAccountInput, type VerifySellerBankAccountInput } from "../types/sellerBankType";

const bankPath = "/api/v1/payments/seller-bank-accounts";
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const parseSellerBankAccount = (value: unknown): SellerBankAccount => {
  if (!isRecord(value) || !uuid(value.id) || !uuid(value.sellerId) || typeof value.bankCode !== "string" || !/^\d{6}$/.test(value.bankCode) ||
    typeof value.accountLast4 !== "string" || !/^\d{4}$/.test(value.accountLast4) || typeof value.accountHolderName !== "string" ||
    !value.accountHolderName.trim() || value.accountHolderName.length > 100 || !bankVerificationStatuses.some((status) => status === value.verificationStatus) ||
    typeof value.isDefault !== "boolean" || typeof value.active !== "boolean" ||
    !Number.isSafeInteger(value.version) || Number(value.version) < 0 ||
    ["accountNumber", "accountNumberEncrypted", "account_number", "account_number_encrypted", "recipientAccountEncrypted"].some((key) => Object.hasOwn(value, key)))
    throw createInvalidResponseError("Invalid masked seller bank account response");
  return { id: value.id, sellerId: value.sellerId, bankCode: value.bankCode, accountLast4: value.accountLast4,
    accountHolderName: value.accountHolderName, verificationStatus: value.verificationStatus as SellerBankAccount["verificationStatus"],
    isDefault: value.isDefault, active: value.active, version: Number(value.version) };
};
export const maskedSellerBankAccount = (account: Pick<SellerBankAccount, "accountLast4">) => `•••• ${account.accountLast4}`;
const parseAccounts = (value: unknown): SellerBankAccount[] => {
  if (!Array.isArray(value)) throw createInvalidResponseError("Invalid seller bank account list");
  const rows = value.map(parseSellerBankAccount);
  if (new Set(rows.map((row) => row.id)).size !== rows.length) throw createInvalidResponseError("Repeated seller bank account");
  const defaults = rows.filter((row) => row.isDefault && row.active).map((row) => row.sellerId);
  if (new Set(defaults).size !== defaults.length) throw createInvalidResponseError("Multiple active default bank accounts");
  return rows;
};
const bankInput = (input: SellerBankAccountInput): SellerBankAccountInput => {
  if (!/^\d{6}$/.test(input.bankCode) || !/^\d{4,34}$/.test(input.accountNumber) ||
    !input.accountHolderName.trim() || input.accountHolderName.trim().length > 100)
    throw createInvalidResponseError("Enter a six-digit bank BIN, account number and account holder name");
  return { bankCode: input.bankCode, accountNumber: input.accountNumber, accountHolderName: input.accountHolderName.trim() };
};

export const getSellerBankAccounts = async (options: ServiceRequestOptions = {}): Promise<SellerBankAccount[]> => {
  const rows: SellerBankAccount[] = [];
  let number = 0, pages = 1;
  do {
    const { data, page } = await requestApi("GET", `${bankPath}/me`, undefined, { ...options, auth: true, params: { page: number, size: 100 } });
    if (!page || page.number !== number) throw createInvalidResponseError("Invalid own bank account page");
    rows.push(...parseAccounts(data)); pages = page.totalPages; number++;
  } while (number < pages);
  return parseAccounts(rows);
};
export const addSellerBankAccount = async (input: SellerBankAccountInput, options: ServiceRequestOptions = {}): Promise<SellerBankAccount> => {
  const body = bankInput(input);
  const { data } = await requestApi("POST", bankPath, body, { ...options, auth: true, params: undefined });
  const account = parseSellerBankAccount(data);
  if (account.accountLast4 !== body.accountNumber.slice(-4) || account.verificationStatus !== "UNVERIFIED") throw createInvalidResponseError("Invalid new bank account response");
  return account;
};
export const updateSellerBankAccount = async (id: string, input: SellerBankAccountInput, options: ServiceRequestOptions = {}): Promise<SellerBankAccount> => {
  if (!uuid(id)) throw createInvalidResponseError("Invalid bank account reference");
  const body = bankInput(input);
  const { data } = await requestApi("PUT", `${bankPath}/${id}`, body, { ...options, auth: true, params: undefined });
  const account = parseSellerBankAccount(data);
  if (account.id !== id || account.accountLast4 !== body.accountNumber.slice(-4) ||
    account.bankCode !== body.bankCode || account.accountHolderName !== body.accountHolderName)
    throw createInvalidResponseError("Mismatched bank account update response");
  return account;
};
export const setDefaultSellerBankAccount = async (id: string, options: ServiceRequestOptions = {}): Promise<SellerBankAccount> => {
  if (!uuid(id)) throw createInvalidResponseError("Invalid bank account reference");
  const { data } = await requestApi("POST", `${bankPath}/${id}/default`, undefined, { ...options, auth: true, params: undefined });
  const account = parseSellerBankAccount(data);
  if (account.id !== id || !account.isDefault || !account.active) throw createInvalidResponseError("Bank account was not set as active default");
  return account;
};
export const getAdminBankAccounts = async (filters: SellerBankAccountFilters, options: ServiceRequestOptions = {}): Promise<Page<SellerBankAccount>> => {
  const { page, size, sellerId, verificationStatus } = filters;
  if (!Number.isSafeInteger(page) || page < 0 || !Number.isInteger(size) || size < 1 || size > 100 ||
    sellerId !== undefined && !uuid(sellerId) || verificationStatus !== undefined && !bankVerificationStatuses.includes(verificationStatus))
    throw createInvalidResponseError("Invalid seller bank account filters");
  const response = await requestApi("GET", bankPath, undefined, { ...options, auth: true, params: { page, size, sellerId, verificationStatus } });
  if (!response.page || response.page.number !== page || response.page.size !== size) throw createInvalidResponseError("Invalid seller bank account page");
  const content = parseAccounts(response.data);
  if (content.some((row) => sellerId !== undefined && row.sellerId !== sellerId || verificationStatus !== undefined && row.verificationStatus !== verificationStatus))
    throw createInvalidResponseError("Mismatched bank account filters");
  return { content, page, size, totalPages: response.page.totalPages, totalElements: response.page.totalElements };
};
export const verifySellerBankAccount = async (id: string, input: VerifySellerBankAccountInput, options: ServiceRequestOptions = {}): Promise<SellerBankAccount> => {
  if (!uuid(id) || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0 ||
    !["VERIFIED", "REJECTED"].includes(input.verificationStatus) || input.reason !== undefined && (!input.reason.trim() || input.reason.trim().length > 500) ||
    input.verificationStatus === "REJECTED" && !input.reason?.trim()) throw createInvalidResponseError("Provide a verification decision and a reason for rejection");
  const body = { verificationStatus: input.verificationStatus, expectedVersion: input.expectedVersion,
    ...(input.reason?.trim() ? { reason: input.reason.trim() } : {}) };
  const { data } = await requestApi("POST", `${bankPath}/${id}/verify`, body, { ...options, auth: true, params: undefined });
  const account = parseSellerBankAccount(data);
  if (account.id !== id || account.verificationStatus !== input.verificationStatus || account.version !== input.expectedVersion + 1)
    throw createInvalidResponseError("Mismatched bank verification response");
  return account;
};
export const sellerAccountErrorMessage = (error: ApiError) => error.status === 501 ? "Seller account services are not available yet. Please try again later." : error.detail || error.title;
