import type { ProductFilters } from "../types/catalogRequestType";

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
  payment: {
    group: (sessionId: number, orderGroupId: string) =>
      ["payment", sessionId, orderGroupId] as const,
  },
  orders: {
    group: (sessionId: number, orderGroupId: string) =>
      ["orders", sessionId, "group", orderGroupId] as const,
    own: (sessionId: number, page: number) =>
      ["orders", sessionId, "own", { page, size: 10 }] as const,
  },
};
