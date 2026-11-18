import type { ProductFilters } from "../types/catalogRequestType";
import type { CheckoutDestination } from "../types/checkoutType";
import type { OrderFilters } from "../types/orderRequestType";
import type { NotificationFilters } from "../types/notificationRequestType";
import type { SellerAuctionFilters } from "../types/sellerAuctionType";
import type { AuctionStatus } from "../types/auctionRoomType";
import type { PayoutFilters } from "../types/payoutType";
import type { SellerBankFilters } from "../types/sellerBankType";
import type { ManualPayoutFilters } from "../types/manualPayoutType";

/** Shared cache-key registry; each feature supplies its own service to useApiQuery. */
export const queryKeys = {
  promotions: {
    root: (sessionId: number) => ["promotions", sessionId] as const,
    list: (sessionId: number, area: string, filters: object = {}) => ["promotions", sessionId, area, filters] as const,
    publicRoot: ["claimable-vouchers"] as const,
    public: (filters: object) => ["claimable-vouchers", filters] as const,
    selection: (sessionId: number) => ["voucher-selection", sessionId] as const,
  },
  operations: {
    root: (sessionId: number) => ["order-operations", sessionId] as const,
    list: (sessionId: number, area: string, filters: object) => ["order-operations", sessionId, area, filters] as const,
  },
  admin: {
    root: (sessionId: number) => ["admin", sessionId] as const,
    users: (sessionId: number, filters: object) => ["admin", sessionId, "users", filters] as const,
    user: (sessionId: number, id: string) => ["admin", sessionId, "user", id] as const,
    roles: (sessionId: number) => ["admin", sessionId, "roles"] as const,
    events: (sessionId: number, filters: object) => ["admin", sessionId, "events", filters] as const,
    event: (sessionId: number, id: string) => ["admin", sessionId, "event", id] as const,
    audit: (sessionId: number, filters: object) => ["admin", sessionId, "audit", filters] as const,
    health: (sessionId: number) => ["admin", sessionId, "health"] as const,
    brokers: (sessionId: number) => ["admin", sessionId, "brokers"] as const,
    sellerApplications: (sessionId: number, filters: object) => ["admin", sessionId, "seller-applications", filters] as const,
    sellerApplication: (sessionId: number) => ["account", sessionId, "seller-application"] as const,
  },
  reputation: {
    seller: (sessionId: number, sellerId: string) => ["reputation", sessionId, "seller", sellerId] as const,
    orderRating: (sessionId: number, sellerId: string, buyerId: string, orderId: string) =>
      ["rating", sessionId, "order", sellerId, buyerId, orderId] as const,
  },
  account: {
    addresses: (sessionId: number) => ["account", sessionId, "addresses"] as const,
    sellerApplication: (sessionId: number) => ["account", sessionId, "seller-application"] as const,
    phoneVerification: (sessionId: number) => ["account", sessionId, "phone-verification"] as const,
  },
  backoffice: {
    categories: (sessionId: number) => ["admin-categories", sessionId] as const,
    category: (sessionId: number, id: string) => ["admin-categories", sessionId, id] as const,
    warehouses: (sessionId: number) => ["admin-warehouses", sessionId] as const,
    warehouse: (sessionId: number, id: string) => ["admin-warehouses", sessionId, id] as const,
    movements: (sessionId: number, skuId: string, warehouseId: string | undefined, page: number) => ["backoffice", sessionId, "movements", { skuId, warehouseId, page }] as const,
    systemConfigs: (sessionId: number) => ["admin-system-configs", sessionId] as const,
    products: (sessionId: number, page: number) => ["backoffice", sessionId, "products", page] as const,
    product: (sessionId: number, id: string) => ["backoffice", sessionId, "product", id] as const,
    balances: (sessionId: number, skuId: string, warehouseId?: string) => ["backoffice", sessionId, "balances", { skuId, warehouseId }] as const,
    intake: (sessionId: number) => ["backoffice", sessionId, "intake"] as const,
    payouts: (sessionId: number, filters?: PayoutFilters) => filters === undefined ? ["backoffice", sessionId, "payouts"] as const : ["backoffice", sessionId, "payouts", filters] as const,
    bankAccounts: (sessionId: number, filters?: SellerBankFilters) => filters === undefined ? ["backoffice", sessionId, "bank-accounts"] as const : ["backoffice", sessionId, "bank-accounts", filters] as const,
    manualPayouts: (sessionId: number, filters?: ManualPayoutFilters) => filters === undefined ? ["manual-payouts", sessionId] as const : ["manual-payouts", sessionId, "queue", filters] as const,
    manualPayoutCapabilities: (sessionId: number) => ["manual-payouts", sessionId, "capabilities"] as const,
    manualPayout: (sessionId: number, id: string) => ["manual-payouts", sessionId, "detail", id] as const,
  },
  seller: {
    all: (sessionId: number) => ["seller", sessionId] as const,
    products: (sessionId: number, page: number) => ["seller", sessionId, "products", page] as const,
    listings: (sessionId: number, page: number, status?: string) => ["seller", sessionId, "listings", { page, status }] as const,
    productBalances: (sessionId: number, productId: string, skuIds: readonly string[]) => ["seller", sessionId, "balances", productId, skuIds] as const,
    sales: (sessionId: number, page: number, status?: string, from?: string, to?: string) => ["seller", sessionId, "sales", { page, status, from, to }] as const,
    offers: (sessionId: number, auctionId: string) => ["seller", sessionId, "offers", auctionId] as const,
    auctionRoot: (sessionId: number) => ["seller", sessionId, "auctions"] as const,
    auctions: (sessionId: number, filters: SellerAuctionFilters) => ["seller", sessionId, "auctions", filters] as const,
    auction: (sessionId: number, id?: string) => ["seller", sessionId, "auctions", "detail", id] as const,
    auctionProducts: (sessionId: number, page: number) => ["seller", sessionId, "auction-products", page] as const,
    auctionProduct: (sessionId: number, id: string) => ["seller", sessionId, "auction-product", id] as const,
    bankAccounts: (sessionId: number) => ["seller", sessionId, "bank-accounts"] as const,
    profile: (sessionId: number) => ["seller", sessionId, "profile"] as const,
    payouts: (sessionId: number, page?: number, filters?: PayoutFilters) => page === undefined ? ["seller", sessionId, "payouts"] as const : ["seller", sessionId, "payouts", { page, ...filters }] as const,
    payoutDetail: (sessionId: number, id: string) => ["seller", sessionId, "payout-detail", id] as const,
  },

  auctions: {
    list: (status: string, page: number) => ["auctions", "list", status, page] as const,
    own: (sessionId: number, page: number) => ["auction-bids", sessionId, "list", page] as const,
    offers: (sessionId: number, page: number) => ["auction-offers", sessionId, page] as const,
    active: ["auctions", "active"] as const,
    manage: {
      lists: (sessionId: number) => ["auctions", "manage", sessionId, "list"] as const,
      list: (sessionId: number, status: AuctionStatus, page: number) => ["auctions", "manage", sessionId, "list", { status, page }] as const,
      detail: (sessionId: number, id: string) => ["auctions", "manage", sessionId, id, "detail"] as const,
      state: (sessionId: number, id: string) => ["auctions", "manage", sessionId, id, "state"] as const,
      bids: (sessionId: number, id: string, page: number) => ["auctions", "manage", sessionId, id, "bids", page] as const,
    },
    detail: (id: string) => ["auctions", id, "detail"] as const,
    state: (id: string) => ["auctions", id, "state"] as const,
    bids: (id: string, page: number) => ["auctions", id, "bids", page] as const,
    mine: (sessionId: number, id: string) => ["auction-bids", sessionId, id] as const,
  },
  catalog: {
    stock: (skuId: string) => ["inventory", "available", skuId] as const,
    stockLevels: (skuIds: string[]) => ["inventory", "available", "batch", [...new Set(skuIds)].sort()] as const,
    cartProducts: (productIds: string[]) =>
      ["catalog", "cart-products", productIds] as const,
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
  shipping: {
    provinces: () => ["shipping", "provinces"] as const,
    wards: (provinceCode: string) => ["shipping", "wards", provinceCode] as const,
  },
  checkout: {
    group: (sessionId: number, orderGroupId: string) => ["checkout", sessionId, "group", orderGroupId] as const,
    provinces: (sessionId: number) => ["checkout", sessionId, "provinces"] as const,
    wards: (sessionId: number, provinceCode: string) => ["checkout", sessionId, "wards", provinceCode] as const,
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
    shipment: (sessionId: number, orderId: string) =>
      ["orders", sessionId, "shipment", orderId] as const,
    detail: (sessionId: number, orderId: string) =>
      ["orders", sessionId, "detail", orderId] as const,
    history: (sessionId: number, orderId: string) =>
      ["orders", sessionId, "history", orderId] as const,
    list: (sessionId: number, filters: OrderFilters) =>
      ["orders", sessionId, "list", filters] as const,
    group: (sessionId: number, orderGroupId: string) =>
      ["orders", sessionId, "group", orderGroupId] as const,
    own: (sessionId: number, page: number) =>
      ["orders", sessionId, "own", { page, size: 10 }] as const,
  },
};
