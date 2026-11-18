import { AxiosHeaders } from "axios";
import { createInvalidResponseError, requestApi } from "../configs/api";
import { parsePayoutDetail } from "./payoutService";
import { isUuid } from "./manualPayoutService";
import { disputeReasons, type ReceiptDisputeInput } from "../types/payoutReceiptType";
import type { PayoutDetail } from "../types/payoutType";
import type { ServiceRequestOptions } from "../types/commonRequestType";

export type ReceiptCommand<T = undefined> = { idempotencyKey: string; expectedReceiptVersion: number; body?: T };

const send = async <T>(payoutId: string, attemptId: string, suffix: string, input: ReceiptCommand<T>, options: ServiceRequestOptions): Promise<PayoutDetail> => {
  if (!isUuid(payoutId) || !isUuid(attemptId) || !isUuid(input.idempotencyKey) || !Number.isSafeInteger(input.expectedReceiptVersion) || input.expectedReceiptVersion < 0)
    throw createInvalidResponseError("A payout, attempt, UUID key and receipt version are required");
  const headers = new AxiosHeaders(options.config?.headers); headers.set("Idempotency-Key", input.idempotencyKey);
  const { data } = await requestApi("POST", `/api/v1/payments/payouts/${payoutId}/manual-attempts/${attemptId}/${suffix}`,
    { expectedReceiptVersion: input.expectedReceiptVersion, ...(input.body ?? {}) }, { ...options, auth: true, params: undefined, config: { ...options.config, headers } });
  const detail = parsePayoutDetail(data);
  if (detail.id !== payoutId || detail.manualAttempt?.attemptId !== attemptId) throw createInvalidResponseError("Receipt response belongs to another payout or attempt");
  return detail;
};

export const confirmPayoutReceipt = async (payoutId: string, attemptId: string, input: ReceiptCommand, options: ServiceRequestOptions = {}) =>
  send(payoutId, attemptId, "receipt-confirmations", input, options);

export const disputePayoutReceipt = async (payoutId: string, attemptId: string, input: ReceiptCommand<ReceiptDisputeInput>, options: ServiceRequestOptions = {}) => {
  const explanation = input.body?.explanation.trim() ?? "";
  if (!input.body || !disputeReasons.includes(input.body.reason) || explanation.length < 1 || explanation.length > 1000)
    throw createInvalidResponseError("Choose a reason and explain it in 1-1000 characters");
  return send(payoutId, attemptId, "receipt-disputes", { ...input, body: { reason: input.body.reason, explanation } }, options);
};
