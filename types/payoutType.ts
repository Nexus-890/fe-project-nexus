/** Normalized UI models for the proposed #261 contract; no full account number is retained. */
export type SellerBankAccount = {
  id: string;
  bankCode: string;
  bankName: string;
  accountHolder: string;
  last4: string;
  verified: boolean;
  createdAt: string;
};
export type SellerBankAccountInput = {
  bankCode: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
};
export const payoutStatuses = ["PENDING", "PROCESSING", "PAID", "FAILED"] as const;
export type PayoutStatus = typeof payoutStatuses[number];
export type SellerPayout = {
  id: string;
  orderId: string;
  orderNumber: string;
  bankAccount: SellerBankAccount;
  amount: string;
  status: PayoutStatus;
  createdAt: string;
  paidAt: string | null;
  reference: string | null;
};
export type PayableOrder = {
  orderId: string;
  orderNumber: string;
  sellerId: string;
  sellerName: string;
  totalAmount: string;
  completedAt: string;
  bankAccounts: SellerBankAccount[];
};
export type CreatePayoutInput = { orderId: string; bankAccountId: string };
