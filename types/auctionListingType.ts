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
