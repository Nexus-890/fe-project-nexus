import type { ProductFilters } from "../types/catalogRequestType";
import type { OrderFilters } from "../types/orderRequestType";

/** Shared cache-key registry; each feature supplies its own service to useApiQuery. */
export const queryKeys = {
  catalog: {
    tree: ["catalog", "category-tree"] as const,
    products: (filters: ProductFilters) =>
      ["catalog", "products", filters] as const,
    product: (productId: string) => ["catalog", "product", productId] as const,
  },
  auth: {
    me: (sessionId: number) => ["auth", sessionId, "me"] as const,
  },
  cart: {
    me: (sessionId: number) => ["cart", sessionId, "me"] as const,
  },
  orders: {
    list: (sessionId: number, filters: OrderFilters) =>
      ["orders", sessionId, "list", filters] as const,
  },
};
