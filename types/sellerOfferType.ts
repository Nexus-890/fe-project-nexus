/** Normalized UI models for delivered #208. Accepted orderId is null until Commerce projects the order. */
export type SellerOfferStatus = "OFFERED" | "ACCEPTED" | "DECLINED" | "EXPIRED";
export type SellerOfferCandidate = {
  bidderId: string;
  displayName: string;
  amount: string;
};
export type SellerOffer = SellerOfferCandidate & {
  id: string;
  status: SellerOfferStatus;
  offeredAt: string;
  expiresAt: string;
  respondedAt: string | null;
  orderId: string | null;
  paymentDueAt: string | null;
};
export type SellerOfferState = {
  auctionId: string;
  canOffer: boolean;
  candidate: SellerOfferCandidate | null;
  offers: SellerOffer[];
};
