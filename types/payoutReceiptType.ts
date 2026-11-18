import type { components } from "./paymentGeneratedType";

type Schemas = components["schemas"];

export const receiptStatuses = ["NOT_REQUESTED", "AWAITING_CONFIRMATION", "CONFIRMED", "DISPUTED"] as const satisfies readonly Schemas["PayoutReceiptStatus"][];
export type ReceiptStatus = Schemas["PayoutReceiptStatus"];
export const disputeStatuses = ["OPEN", "UNDER_REVIEW", "WAITING_SELLER", "RESOLVED"] as const satisfies readonly Schemas["PayoutReviewStatus"][];
export type DisputeStatus = Schemas["PayoutReviewStatus"];
export const unresolvedDisputeStatuses = ["OPEN", "UNDER_REVIEW", "WAITING_SELLER"] as const satisfies readonly DisputeStatus[];
export const disputeReasons = ["NOT_RECEIVED", "INCORRECT_AMOUNT", "CONFIRMATION_MISTAKE"] as const satisfies readonly Schemas["SellerPayoutDisputeRequest"]["reason"][];
export type DisputeReason = Schemas["SellerPayoutDisputeRequest"]["reason"];
export const sellerReceiptActions = ["CONFIRM_RECEIPT", "OPEN_DISPUTE"] as const satisfies readonly Schemas["ManualReceiptView"]["allowedActions"][number][];
export type SellerReceiptAction = typeof sellerReceiptActions[number];

export type ReceiptDispute = { id: string; status: DisputeStatus; reason: DisputeReason };
export type SellerManualReceipt = {
  attemptId: string;
  attemptState: Schemas["ManualPayoutAttemptState"];
  receiptStatus: ReceiptStatus;
  receiptVersion: number;
  hasOpenDispute: boolean;
  allowedActions: SellerReceiptAction[];
  dispute: ReceiptDispute | null;
};
export type ReceiptDisputeInput = { reason: DisputeReason; explanation: string };
