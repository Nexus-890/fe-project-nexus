/** Mô hình tài khoản đã che số; version gắn quyết định duyệt với dữ liệu admin đã xem. */
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
  version: number;
};
export type SellerBankAccountInput = {
  bankCode: string;
  accountNumber: string;
  accountHolderName: string;
};
export type VerifySellerBankAccountInput = {
  verificationStatus: "VERIFIED" | "REJECTED";
  expectedVersion: number;
  reason?: string;
};
export type SellerBankAccountFilters = {
  sellerId?: string;
  verificationStatus?: BankVerificationStatus;
  page: number;
  size: number;
};
export type SellerBankFilters = SellerBankAccountFilters;
