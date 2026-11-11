import type { ProductFilters } from "../types/catalogRequestType";
import type { CheckoutDestination } from "../types/checkoutType";
import type { OrderFilters } from "../types/orderRequestType";
import type { NotificationFilters } from "../types/notificationRequestType";

/** Shared cache-key registry; each feature supplies its own service to useApiQuery. */
export const queryKeys = {
  backoffice: {
    products: (sessionId: number, page: number) => ["backoffice", sessionId, "products", page] as const,
    product: (sessionId: number, id: string) => ["backoffice", sessionId, "product", id] as const,
    balances: (sessionId: number, skuId: string, warehouseId?: string) => ["backoffice", sessionId, "balances", { skuId, warehouseId }] as const,
    intake: (sessionId: number) => ["backoffice", sessionId, "intake"] as const,
  },
  seller: {
    all: (sessionId: number) => ["seller", sessionId] as const,
    products: (sessionId: number, page: number) => ["seller", sessionId, "products", page] as const,
    listings: (sessionId: number, page: number) => ["seller", sessionId, "listings", page] as const,
    productBalances: (sessionId: number, productId: string, skuIds: readonly string[]) => ["seller", sessionId, "balances", productId, skuIds] as const,
    inventory: (sessionId: number, page: number) => ["seller", sessionId, "inventory", page] as const,
    sales: (sessionId: number, page: number, status?: string) => ["seller", sessionId, "sales", { page, status }] as const,
  },
  catalog: {
    stock: (skuId: string) => ["inventory", "available", skuId] as const,
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
  checkout: {
    group: (sessionId: number, orderGroupId: string) => ["checkout", sessionId, "group", orderGroupId] as const,
    provinces: (sessionId: number) => ["checkout", sessionId, "provinces"] as const,
    districts: (sessionId: number, provinceCode: string) => ["checkout", sessionId, "districts", provinceCode] as const,
    wards: (sessionId: number, districtCode: string) => ["checkout", sessionId, "wards", districtCode] as const,
    preview: (sessionId: number, cartSignature: string, destination: CheckoutDestination | null) =>
      ["checkout", sessionId, "preview", cartSignature, destination] as const,
  },
  payment: {
    group: (sessionId: number, orderGroupId: string) =>
      ["payment", sessionId, orderGroupId] as const,
  },
  notification: {
    all: (sessionId: number) => ["notification", sessionId] as const,
    list: (sessionId: number, filters: NotificationFilters) =>
      ["notification", sessionId, "list", filters] as const,
    unreadCount: (sessionId: number) =>
      ["notification", sessionId, "unread-count"] as const,
  },
  orders: {
    detail: (sessionId: number, orderId: string) => ["orders", sessionId, "detail", orderId] as const,
    history: (sessionId: number, orderId: string) => ["orders", sessionId, "history", orderId] as const,
    list: (sessionId: number, filters: OrderFilters) =>
      ["orders", sessionId, "list", filters] as const,
    group: (sessionId: number, orderGroupId: string) =>
      ["orders", sessionId, "group", orderGroupId] as const,
    own: (sessionId: number, page: number) =>
      ["orders", sessionId, "own", { page, size: 10 }] as const,
  },
};
