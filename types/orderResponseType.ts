import type { components } from "./commerceGeneratedType";

export type OrderStatus = components["schemas"]["OrderStatus"];
export type OrderWireResponse = components["schemas"]["Order"];
export type OrderGroupWireResponse = components["schemas"]["OrderGroup"];

/** Fields consumed by payment status and the order list, with display money. */
export type OrderSummary = Pick<
  OrderWireResponse,
  "orderId" | "orderNumber" | "status" | "createdAt"
> & { totalAmount: string };

export type OrderGroup = Pick<
  OrderGroupWireResponse,
  "orderGroupId" | "status" | "currency" | "dueAt"
> & { totalAmount: string; orders: OrderSummary[] };
