import type { components } from "./commerceGeneratedType";

export type OrderStatus = components["schemas"]["OrderStatus"];
export type OrderSummary = Pick<
  components["schemas"]["Order"],
  "orderId" | "orderNumber" | "createdAt" | "status"
> & {
  totalAmount: string;
  /** Awaiting #138: the delivered list DTO does not yet expose this field. */
  orderGroupId: string | null;
};
