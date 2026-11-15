import type { components as catalog } from "./catalogGeneratedType";
import type { components as inventory } from "./inventoryGeneratedType";
import type { ProductDetail } from "./catalogResponseType";
import type { OrderSummary } from "./orderResponseType";

export type SellerProductInput = catalog["schemas"]["CreateProduct"];
export type SellerProductUpdate = catalog["schemas"]["UpdateProduct"];
export type SellerSkuInput = catalog["schemas"]["WriteSku"];
export type SellerProductStatus = catalog["schemas"]["ChangeProductStatus"]["status"];
export type SellerBalance = inventory["schemas"]["Balance"];
export type SellerProductListing = ProductDetail;
export type SellerSale = OrderSummary & {
  buyerId: string;
  recipientName: string | null;
  phoneNumber: string | null;
  saleItems: { id: string; name: string; skuCode: string; quantity: number }[];
};
