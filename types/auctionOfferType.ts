/** Normalized UI model for the delivered #208 schema in auctionGeneratedType.ts. */
export type AuctionOffer = {
  id: string;
  auctionId: string;
  title: string;
  imageUrl: string | null;
  currency: string;
  amount: string;
  status: "OFFERED" | "ACCEPTED" | "DECLINED" | "EXPIRED";
  offeredAt: string;
  expiresAt: string;
  orderId: string | null;
  paymentDueAt: string | null;
};
