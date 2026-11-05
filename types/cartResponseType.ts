import type { components } from "./commerceGeneratedType";
export type CartWireResponse = components["schemas"]["Cart"];
export type CartItem = Omit<components["schemas"]["CartItem"], "unitPrice"> & {
  unitPrice: string;
};
export type Cart = Omit<CartWireResponse, "items"> & { items: CartItem[] };

/** Count-only projection used by the proposed guest API; no credentials enter state. */
export interface CartSnapshot {
  id: string;
  status: "ACTIVE";
  items: Array<{ id: string; skuId: string; quantity: number }>;
}
