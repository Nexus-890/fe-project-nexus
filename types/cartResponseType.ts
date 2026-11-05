import type { components } from "./commerceGeneratedType";
export type CartWireResponse = components["schemas"]["Cart"];
export type CartItem = Omit<components["schemas"]["CartItem"], "unitPrice"> & {
  unitPrice: string;
};
export type Cart = Omit<CartWireResponse, "items"> & { items: CartItem[] };
