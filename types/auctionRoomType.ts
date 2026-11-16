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
  cancelledBy: NonNullable<components["schemas"]["Auction"]["cancelledBy"]> | null;
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
/** Biên nhận bất biến của yêu cầu; QUEUED chưa có nghĩa là giá bid đã được chấp nhận. */
export type QueuedAuctionBid = components["schemas"]["BidResponse"];
/** Kết quả riêng của người đặt bid; giá tiền được chuẩn hóa thành chuỗi thập phân. */
export type AuctionBidResult =
  | (QueuedAuctionBid & { amount: string })
  | { bidId: string; status: "PLACED" | "OUTBID" | "WON"; requestedAt: string; amount: string; currentPrice: string; leaderBidderId: string }
  | { bidId: string; status: "CANCELLED"; requestedAt: string; amount: string }
  | { bidId: string; status: "REJECTED"; requestedAt: string; amount: string; reason: string; minimum: string | null };
export type AuctionBidInput = { amount: string; idempotencyKey: string };
export type AuctionUpdateRequest = components["schemas"]["UpdateAuctionRequest"];
export type AuctionUpdateInput = Omit<AuctionUpdateRequest, "startingPrice" | "bidIncrement"> & { startingPrice: string; bidIncrement: string };
export type AuctionCancelRequest = components["schemas"]["CancelAuctionRequest"];
