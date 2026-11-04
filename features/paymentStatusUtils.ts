import type { OrderGroup } from "../types/orderResponseType";

export const getPaymentOutcome = (group: Pick<OrderGroup, "orders"> | undefined) => {
  if (!group?.orders.length) return "pending";
  // Administrative PATCH updates each order and can leave group.status unchanged.
  if (group.orders.every((order) => order.status === "PAID")) return "paid";
  if (group.orders.every((order) => order.status === "CANCELED")) return "canceled";
  return "pending";
};
