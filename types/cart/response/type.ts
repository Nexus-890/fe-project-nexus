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
  status: "ACTIVE";
  items: CartItem[];
  subtotal: string;
  currency: "VND";
  updatedAt: string;
}
