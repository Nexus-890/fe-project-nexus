/** Masked bank projection from issue #257; never retain the account number. */
export const bankVerificationStatuses = ["UNVERIFIED", "VERIFIED", "REJECTED"] as const;
export type BankVerificationStatus = typeof bankVerificationStatuses[number];
export type SellerBankAccount = {
  id: string;
  sellerId: string;
  bankCode: string;
  accountLast4: string;
  accountHolderName: string;
  verificationStatus: BankVerificationStatus;
  isDefault: boolean;
  active: boolean;
};
export type SellerBankAccountInput = {
  bankCode: string;
  accountNumber: string;
  accountHolderName: string;
};
export type VerifySellerBankAccountInput = {
  verificationStatus: "VERIFIED" | "REJECTED";
  reason?: string;
};
export type SellerBankAccountFilters = {
  sellerId?: string;
  verificationStatus?: BankVerificationStatus;
  page: number;
  size: number;
};
export type SellerBankFilters = SellerBankAccountFilters;
