import type { ProductFilters } from "../types/catalog/request/type";

/** Shared cache-key registry; each feature supplies its own service to useApiQuery. */
export const queryKeys = {
  catalog: {
    tree: ["catalog", "category-tree"] as const,
    products: (filters: ProductFilters) => ["catalog", "products", filters] as const,
  },
  auth: {
    me: (sessionId: number) => ["auth", sessionId, "me"] as const,
  },
};
