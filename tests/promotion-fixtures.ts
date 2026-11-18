import type { EventWrite, ManagedVoucher, PublicVoucher, VoucherWrite } from "../types/promotionType";
export const voucherId = "66000000-0000-4000-8000-000000000001";
export const buyerId = "68000000-0000-4000-8000-000000000003";
export const sellerId = "68000000-0000-4000-8000-000000000002";
export const eventId = "67000000-0000-4000-8000-000000000001";
export const at = "2026-11-17T00:00:00Z";
export const eventInput: EventWrite = { name: "Nexus November", description: "Seasonal deals", bannerUrl: "", registrationStartAt: "2026-11-01T00:00:00Z", registrationEndAt: "2026-11-20T00:00:00Z", startAt: "2026-11-21T00:00:00Z", endAt: "2026-12-01T00:00:00Z" };
export const voucherInput: VoucherWrite = { code: "NEXUS50", name: "November savings", sourceType: "PLATFORM", discountType: "FIXED", discountValue: 50000, minOrderAmount: 100000,
  fundingType: "PLATFORM", productScope: "ALL", claimStartAt: "2026-11-01T00:00:00Z", claimEndAt: "2026-12-01T00:00:00Z", validFrom: "2026-11-01T00:00:00Z", validUntil: "2026-12-31T00:00:00Z", termsText: "One use per buyer." };
export const managedVoucher = (changes = {}): ManagedVoucher => ({ voucher: { ...voucherInput, id: voucherId, status: "DRAFT", termsVersion: 1, claimCount: 0, committedUses: 0, committedDiscount: 0, createdAt: at, updatedAt: at, ...changes }, productIds: [] });
export const publicVoucher = (): PublicVoucher => {
  const { id, code, name, sourceType, discountType, discountValue, minOrderAmount, productScope, claimStartAt, claimEndAt, validFrom, validUntil, termsText } = managedVoucher().voucher;
  return { id, code, name, sourceType, discountType, discountValue, minOrderAmount, productScope, claimStartAt, claimEndAt, validFrom, validUntil, termsText };
};
export const walletEntry = () => ({ id: "68000000-0000-4000-8000-000000000005", status: "CLAIMED" as const, claimedAt: at, expiresAt: voucherInput.validUntil, voucher: publicVoucher() });
export const envelope = (data: unknown) => ({ code: 0, message: "response success", data });
export const pageEnvelope = (data: unknown[], page = 0, total = data.length) => ({ ...envelope(data), page: { number: page, size: 10, totalElements: total, totalPages: Math.ceil(total / 10) } });
