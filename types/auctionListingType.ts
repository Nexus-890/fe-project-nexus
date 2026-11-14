import type { components } from "./auctionGeneratedType";

export type AuctionDetail = Omit<components["schemas"]["Auction"], "startingPrice" | "bidIncrement" | "currentPrice"> & {
  startingPrice: string;
  bidIncrement: string;
  currentPrice: string;
};

/** Homepage view model, projected from the auction service's public response. */
export type AuctionListing = {
  auctionId: string;
  productId: string;
  sellerId?: string;
  name: string;
  imageUrl: string | undefined;
  currentBid: string;
  bidCount: number;
  currency: string;
  closesAt: string;
};
