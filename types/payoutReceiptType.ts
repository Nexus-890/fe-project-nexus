export const receiptStatuses = ["NOT_REQUESTED", "AWAITING_CONFIRMATION", "CONFIRMED", "DISPUTED"] as const;
export type ReceiptStatus = typeof receiptStatuses[number];
export const disputeStatuses = ["OPEN", "UNDER_REVIEW", "WAITING_SELLER", "RESOLVED"] as const;
export type DisputeStatus = typeof disputeStatuses[number];
export const unresolvedDisputeStatuses = ["OPEN", "UNDER_REVIEW", "WAITING_SELLER"] as const satisfies readonly DisputeStatus[];
export const disputeReasons = ["NOT_RECEIVED", "INCORRECT_AMOUNT", "CONFIRMATION_MISTAKE"] as const;
export type DisputeReason = typeof disputeReasons[number];
export const sellerReceiptActions = ["CONFIRM_RECEIPT", "DISPUTE_RECEIPT"] as const;
export type SellerReceiptAction = typeof sellerReceiptActions[number];

export type ReceiptDispute = { id: string; status: DisputeStatus; reason: DisputeReason; explanation: string; version: number; openedAt: string };
export type SellerManualAttempt = {
  attemptId: string;
  attemptNo: number;
  state: "SUCCEEDED" | "NOT_SENT" | "UNKNOWN" | "RETURNED" | "CONFIRMATION_CORRECTED" | "CLAIMED" | "QR_ISSUED";
  receiptStatus: ReceiptStatus;
  receiptVersion: number;
  staffConfirmedAt: string | null;
  sellerConfirmedAt: string | null;
  dispute: ReceiptDispute | null;
  allowedSellerActions: SellerReceiptAction[];
};
export type ReceiptDisputeInput = { reason: DisputeReason; explanation: string };
