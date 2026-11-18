import type { SellerManualAttempt } from "./payoutReceiptType";
/** Mô hình UI dùng chuỗi thập phân; API #257 trả tiền và tỷ lệ phí dạng số JSON. */
export const payoutStatuses = ["ON_HOLD", "PENDING", "PROCESSING", "UNKNOWN", "SUCCEEDED", "FAILED", "RETURNED"] as const;
export type PayoutStatus = typeof payoutStatuses[number];
export const payoutNeedsActionStatuses = ["ON_HOLD", "UNKNOWN", "FAILED", "RETURNED"] as const satisfies readonly PayoutStatus[];
export const payoutHistoryEvents = ["CREATED", "HELD", "RELEASED", "SENT", "SUCCEEDED", "FAILED", "TIMED_OUT", "RECONCILED", "RETRIED", "RETURNED",
  "CLAIMED", "CLAIM_RELEASED", "QR_ISSUED", "STAFF_CONFIRMED", "PROBLEM_REPORTED", "CONFIRMATION_CORRECTED", "RECEIPT_CONFIRMED", "RECEIPT_DISPUTED", "DISPUTE_REVIEWED"] as const;
export type PayoutHistoryEvent = typeof payoutHistoryEvents[number];
export type SellerPayout = {
  id: string;
  orderId: string;
  sellerId: string;
  orderAmount: string;
  shippingFee: string;
  platformFeeRate: string;
  platformFee: string;
  netAmount: string;
  currency: "VND";
  status: PayoutStatus;
  attemptCount: number;
  recipientAccountLast4: string | null;
  providerReference: string | null;
  createdAt: string;
  simulated: boolean;
  executionMode: "AUTO" | "MANUAL";
  confirmationSource: "MANUAL_STAFF_CONFIRMED" | "PROVIDER_CONFIRMED" | "SIMULATED" | null;
  manualAttempt: SellerManualAttempt | null;
};
export type PayoutHistoryEntry = {
  id: string;
  event: PayoutHistoryEvent;
  fromStatus: PayoutStatus | null;
  toStatus: PayoutStatus;
  attemptNo: number;
  amount: string;
  sellerBankId: string | null;
  recipientAccountLast4: string | null;
  provider: string | null;
  providerReference: string | null;
  providerStatus: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  simulated: boolean;
  actorId: string;
  occurredAt: string;
};
export type PayoutDetail = SellerPayout & { history: PayoutHistoryEntry[] };
export type PayoutFilters = { sellerId?: string; status?: readonly PayoutStatus[]; from?: string; to?: string; page?: number; size?: number };
