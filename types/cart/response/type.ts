export interface CartItem {
  id: string;
  skuId: string;
  productId: string;
  quantity: number;
  unitPrice: string;
}

export interface Cart {
  id: string;
  userId: string;
  status: "ACTIVE";
  items: CartItem[];
}
