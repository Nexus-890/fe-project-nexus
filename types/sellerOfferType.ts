/** Normalized UI models for the proposed #208 contract in docs/api/seller-offers.openapi.yaml. */
export type SellerOfferStatus = "OPEN" | "ACCEPTED" | "DECLINED" | "EXPIRED";
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
  version: number;
  canOffer: boolean;
  candidate: SellerOfferCandidate | null;
  offers: SellerOffer[];
};
