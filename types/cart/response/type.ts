/** Delivered commerce API DTOs, before UI normalization. */
export interface CartItemResponse {
  id: string;
  productId: string;
  skuId: string;
  quantity: number;
  unitPrice: number;
}

export interface CartResponse {
  id: string;
  userId: string;
  status: "ACTIVE";
  items: CartItemResponse[];
}

/** Cached UI model: decimal totals and display fallbacks are derived locally. */
export interface CartItem {
  id: string;
  skuId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  sellerId?: string;
  sellerName?: string;
  imageUrl?: string | null;
  color?: string | null;
  size?: string | null;
}

export interface Cart {
  id: string;
  userId?: string;
  status: "ACTIVE";
  items: CartItem[];
  subtotal: string;
  currency: "VND";
  updatedAt?: string;
}
