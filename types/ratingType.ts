/** Provisional #212/#213 frontend contract; rating-service has no delivered OpenAPI yet. */
export type CreateRatingRequest = {
  orderId: string;
  toUserId: string;
  score: number;
  comment: string | null;
};

export type Rating = CreateRatingRequest & {
  id: string;
  fromUserId: string;
  createdAt: string;
};

export type SellerReputation = {
  userId: string;
  score: number;
  trustLevel: "NEW" | "BASIC" | "TRUSTED" | "TOP";
  totalTransaction: number;
  successfulTransaction: number;
  failedTransaction: number;
};
