import type { components } from "./catalogGeneratedType";
export type CategoryNode = components["schemas"]["CategoryTree"];
export type ProductWireResponse = components["schemas"]["Product"];
export type ProductDetailWireResponse = components["schemas"]["ProductDetail"];
/** Models after normalization; money stays a decimal string in the UI. */
export type ProductSummary = Pick<ProductWireResponse, "id" | "name" | "slug"> &
  Partial<Pick<ProductWireResponse, "categoryId" | "sellerId">> & {
    minPrice: string | null;
    status?: string;
  };
export type ProductSku = Omit<components["schemas"]["Sku"], "price"> & {
  price: string;
};
export type ProductImage = components["schemas"]["Image"];
export type ProductDetail = ProductSummary &
  Pick<ProductDetailWireResponse, "description" | "auctionEnable"> & {
    skus: ProductSku[];
    images: ProductImage[];
  };
