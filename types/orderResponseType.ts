import type { components } from "./commerceGeneratedType";

export type OrderStatus = components["schemas"]["OrderStatus"];
export type OrderWireResponse = components["schemas"]["Order"];
export type OrderGroupWireResponse = components["schemas"]["OrderGroup"];
export type OrderSummary = Pick<
  components["schemas"]["Order"],
  "orderId" | "orderNumber" | "createdAt" | "status"
> & {
  totalAmount: string;
  /** Older order responses can predate the group identifier added in #138. */
  orderGroupId: string | null;
};

export type OrderGroup = Pick<
  OrderGroupWireResponse,
  "orderGroupId" | "status" | "currency" | "dueAt"
> & { totalAmount: string; orders: OrderSummary[] };

export type OrderDetailItem = Omit<components["schemas"]["OrderItem"], "unitPrice" | "totalPrice"> & {
  unitPrice: string;
  totalPrice: string;
};

export type OrderDetail = OrderSummary & Pick<
  OrderWireResponse, "userId" | "sellerId" | "orderType"
> & {
  items: OrderDetailItem[];
};

export type OrderHistoryEntry = components["schemas"]["OrderStatusHistory"];
