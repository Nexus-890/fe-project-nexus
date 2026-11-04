import type { OrderStatus } from "../types/orderResponseType";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "To Pay", PAID: "Processing", SHIPPED: "Shipping",
  DELIVERED: "Delivered", COMPLETED: "Completed", CANCELED: "Cancelled",
  REFUND_REQUESTED: "Refund requested", REFUNDED: "Refunded",
};
const dotStyles: Record<OrderStatus, string> = {
  PENDING: "bg-warning", PAID: "bg-muted-foreground", SHIPPED: "bg-purple-700",
  DELIVERED: "bg-info", COMPLETED: "bg-success", CANCELED: "bg-danger",
  REFUND_REQUESTED: "bg-warning", REFUNDED: "bg-muted-foreground",
};

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotStyles[status]}`} />
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

export default OrderStatusBadge;
