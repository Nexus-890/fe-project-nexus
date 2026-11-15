import type { components } from "./auctionGeneratedType";

export type AuctionStatus = components["schemas"]["AuctionStatus"];

/** Public detail has no buyer-specific settlement references. */
export type AuctionRoom = Omit<
  components["schemas"]["Auction"],
  "startingPrice" | "bidIncrement" | "currentPrice" | "imageUrl" | "currency" | "cancelledBy" | "cancelledReason"
> & {
  startingPrice: string;
  bidIncrement: string;
  currentPrice: string;
  imageUrl: string | null;
  currency: string;
  cancelledBy: "SELLER" | "ADMIN" | null;
  cancelledReason: string | null;
};

/** Delivered state normalized with a monotonic local clock anchor. */
export type AuctionState = {
  auctionId: string;
  currentPrice: string;
  bidIncrement: string;
  bidCount: number;
  leaderBidderName: string | null;
  endAt: string;
  status: AuctionStatus;
  serverTime: string;
  /** Monotonic timestamp and duration, independent of the buyer's wall clock. */
  receivedAt: number;
  remainingMs: number;
};

/** Normalized row from the delivered masked public history endpoint. */
export type AuctionBid = { amount: string; bidderName: string; placedAt: string };

export type MyAuctionBid = Omit<components["schemas"]["MyBid"], "amount" | "finalPrice" | "orderId" | "paymentDueAt"> & {
  amount: string;
  /** Only the authenticated recorded winner receives these fields. */
  finalPrice: string | null;
  paymentDueAt: string | null;
  orderId: string | null;
};
export type PlacedAuctionBid = Omit<components["schemas"]["BidResponse"], "currentPrice"> & { currentPrice: string };
export type AuctionBidInput = { amount: string; idempotencyKey: string };
