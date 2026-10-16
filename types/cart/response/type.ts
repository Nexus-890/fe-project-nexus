export interface CartItem {
  id: string;
  skuId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
}

export interface Cart {
  id: string;
  status: "ACTIVE";
  items: CartItem[];
  subtotal: string;
  currency: "VND";
  updatedAt: string;
}
