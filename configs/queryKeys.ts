import type { ProductFilters } from "../types/catalogRequestType";
import type { NotificationFilters } from "../types/notificationRequestType";

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
  notification: {
    all: (sessionId: number) => ["notification", sessionId] as const,
    list: (sessionId: number, filters: NotificationFilters) =>
      ["notification", sessionId, "list", filters] as const,
    unreadCount: (sessionId: number) =>
      ["notification", sessionId, "unread-count"] as const,
  },
};
