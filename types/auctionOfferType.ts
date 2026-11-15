/** Normalized #208 offer model. Routes follow review; the DTO awaits delivered OpenAPI. */
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
