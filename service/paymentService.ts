import {
  createInvalidResponseError,
  isRecord,
  requestApi,
} from "../configs/api";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { InitiatePaymentRequest } from "../types/paymentRequestType";
import type { PaymentInstructions } from "../types/paymentResponseType";

export const INITIATE_PAYMENT_PATH = "/api/v1/payments";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const isInstant = (value: unknown): value is string =>
  typeof value === "string" && INSTANT_PATTERN.test(value) && Number.isFinite(Date.parse(value));
const isQrImageUrl = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
};

export const parsePaymentInstructions = (
  value: unknown,
): Omit<PaymentInstructions, "receivedAt" | "remainingMs"> => {
  if (
    !isRecord(value) ||
    typeof value.sessionId !== "string" || !UUID_PATTERN.test(value.sessionId) ||
    !isQrImageUrl(value.qrImageUrl) ||
    typeof value.bankAccount !== "string" || !value.bankAccount.trim() ||
    typeof value.amount !== "number" || !Number.isSafeInteger(value.amount) ||
    value.amount < 1 || value.amount > 9_999_999_999_999 ||
    typeof value.memoCode !== "string" || !/^[A-Z0-9]{1,32}$/.test(value.memoCode) ||
    typeof value.transferContent !== "string" || !value.transferContent.trim() ||
    value.transferContent.length > 1024 || /[\u0000-\u001f\u007f]/.test(value.transferContent) ||
    !isInstant(value.expiresAt) || !isInstant(value.serverNow)
  ) {
    throw createInvalidResponseError("Invalid payment instructions or server time");
  }
  return {
    sessionId: value.sessionId,
    qrImageUrl: value.qrImageUrl,
    bankAccount: value.bankAccount,
    amount: String(value.amount),
    memoCode: value.memoCode,
    // Keep the provider's full description verbatim, including any bank prefix.
    transferContent: value.transferContent,
    expiresAt: value.expiresAt,
    serverNow: value.serverNow,
  };
};

/** A repeat POST reads the existing group session, preserving its amount and memo. */
export const initiatePayment = async (
  input: InitiatePaymentRequest,
  options: ServiceRequestOptions = {},
): Promise<PaymentInstructions> => {
  if (!UUID_PATTERN.test(input.orderGroupId))
    throw createInvalidResponseError("A valid order group reference is required");
  const startedAt = performance.now();
  const { data } = await requestApi<unknown>(
    "POST",
    INITIATE_PAYMENT_PATH,
    { orderGroupId: input.orderGroupId },
    { ...options, auth: true },
  );
  const payment = parsePaymentInstructions(data);
  const receivedAt = performance.now();
  // Subtract the whole round trip conservatively; never use the buyer's wall clock.
  const remainingMs = Math.max(0,
    Date.parse(payment.expiresAt) - Date.parse(payment.serverNow) - (receivedAt - startedAt),
  );
  return { ...payment, receivedAt, remainingMs };
};
