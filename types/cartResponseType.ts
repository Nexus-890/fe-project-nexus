import type { components } from "./commerceGeneratedType";
export type CartWireResponse = components["schemas"]["Cart"];
export type CartItem = Omit<components["schemas"]["CartItem"], "unitPrice"> & {
  unitPrice: string;
  lineTotal: string;
  productName: string;
  sellerId?: string;
  sellerName?: string;
  imageUrl?: string | null;
  color?: string | null;
  size?: string | null;
};
/** UI model derives decimal totals and display fallbacks from the compact DTO. */
export type Cart = Omit<CartWireResponse, "items"> & {
  items: CartItem[];
  subtotal: string;
  currency: "VND";
  updatedAt?: string;
};
