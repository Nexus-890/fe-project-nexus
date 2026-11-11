import type { components as catalog } from "./catalogGeneratedType";
import type { components as auction } from "./auctionGeneratedType";
import type { components as inventory } from "./inventoryGeneratedType";
import type { ProductDetail } from "./catalogResponseType";
import type { OrderSummary } from "./orderResponseType";

export type SellerProductInput = catalog["schemas"]["UpdateProduct"];
export type SellerSkuInput = catalog["schemas"]["WriteSku"];
export type SellerProductStatus = catalog["schemas"]["ChangeProductStatus"]["status"];
export type SellerAuctionInput = auction["schemas"]["CreateAuctionRequest"];
export type SellerAuction = Omit<auction["schemas"]["Auction"], "startingPrice" | "currentPrice" | "bidIncrement"> & {
  startingPrice: string; currentPrice: string; bidIncrement: string;
};
export type SellerStock = inventory["schemas"]["Stock"];
export type SellerBalance = inventory["schemas"]["Balance"];
export type SellerProductListing = ProductDetail & { maxPrice: string | null };
/** Presentation-only preview fields; the stock API returns available only. */
export type SellerPreviewProduct = ProductDetail & { stock: number; reserved: number; unavailable: number; sold: number; updated: string };
export type SellerSale = OrderSummary & {
  buyerId: string;
  recipientName?: string | null;
  phoneNumber?: string | null;
  itemCount: number;
  itemNames: string[];
  saleItems?: { id: string; name: string; skuCode: string; quantity: number }[];
};
