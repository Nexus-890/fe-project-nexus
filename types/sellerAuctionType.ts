import type { components } from "./auctionGeneratedType";

export type SellerAuctionStatus = components["schemas"]["AuctionStatus"];
export type SellerAuctionInput = components["schemas"]["CreateAuctionRequest"];
export type SellerAuctionUpdate = components["schemas"]["UpdateAuctionRequest"];
/** Numeric wire money is normalized before it reaches seller tables and forms. */
export type SellerAuction = Omit<components["schemas"]["Auction"], "startingPrice" | "currentPrice" | "bidIncrement"> & {
  startingPrice: string;
  currentPrice: string;
  bidIncrement: string;
};
export type SellerAuctionFilters = { status?: SellerAuctionStatus; page?: number; size?: number };
