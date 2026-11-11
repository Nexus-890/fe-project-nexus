import type { components } from "./commerceGeneratedType";

export type OrderStatus = components["schemas"]["OrderStatus"];
export type OrderWireResponse = components["schemas"]["Order"];
export type OrderGroupWireResponse = components["schemas"]["OrderGroup"];
export type OrderSummary = Pick<
  components["schemas"]["Order"],
  "orderId" | "orderNumber" | "createdAt" | "status"
> & {
  totalAmount: string;
  /** Awaiting #138: the delivered list DTO does not yet expose this field. */
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

export type OrderDetail = Omit<OrderWireResponse, "totalAmount" | "items"> & {
  totalAmount: string;
  items: OrderDetailItem[];
  orderGroupId: string | null;
};

export type OrderHistoryEntry = components["schemas"]["OrderStatusHistory"];
