import type { components } from "./auctionGeneratedType";

export type AuctionStatus = components["schemas"]["AuctionStatus"];

/** Delivered detail with normalized money and optional draft settlement references. */
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
  finalPrice: string | null;
  paymentDueAt: string | null;
  orderId: string | null;
};

/** UI model for #178's provisional state endpoint in docs/api/auction-service.yaml. */
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

/** UI model for #168's provisional masked public history endpoint. */
export type AuctionBid = { amount: string; bidderName: string; placedAt: string };

export type MyAuctionBid = Omit<components["schemas"]["MyBid"], "amount"> & { amount: string };
export type PlacedAuctionBid = Omit<components["schemas"]["BidResponse"], "currentPrice"> & { currentPrice: string };
export type AuctionBidInput = { amount: string; idempotencyKey: string };
