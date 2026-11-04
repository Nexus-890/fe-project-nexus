import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import { normalizeMoney } from "./catalogService";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { Page } from "../types/commonResponseType";
import type { OrderFilters } from "../types/orderRequestType";
import type { OrderStatus, OrderSummary } from "../types/orderResponseType";

export const ORDER_STATUSES = [
  "PENDING", "PAID", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELED",
  "REFUND_REQUESTED", "REFUNDED",
] as const satisfies readonly OrderStatus[];

export const isOrderStatus = (value: unknown): value is OrderStatus =>
  ORDER_STATUSES.some((status) => status === value);
const isUuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export const parseOrderSummary = (value: unknown): OrderSummary => {
  if (
    !isRecord(value) || !isUuid(value.orderId) ||
    typeof value.orderNumber !== "string" || !value.orderNumber.trim() ||
    typeof value.createdAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T/.test(value.createdAt) || !Number.isFinite(Date.parse(value.createdAt)) ||
    !isOrderStatus(value.status) || typeof value.totalAmount !== "number" ||
    (value.orderGroupId != null && !isUuid(value.orderGroupId))
  ) throw createInvalidResponseError("Invalid order");
  const totalAmount = normalizeMoney(value.totalAmount);
  if (totalAmount === null || !/^\d+(?:\.\d{1,2})?$/.test(totalAmount))
    throw createInvalidResponseError("Invalid order total");
  return {
    orderId: value.orderId, orderNumber: value.orderNumber,
    createdAt: value.createdAt, status: value.status, totalAmount,
    orderGroupId: value.orderGroupId == null ? null : value.orderGroupId as string,
  };
};

export const getOrders = async (
  filters: OrderFilters,
  options: ServiceRequestOptions = {},
): Promise<Page<OrderSummary>> => {
  if (!Number.isSafeInteger(filters.page) || filters.page < 0 || filters.page > 2147483646 ||
    !Number.isInteger(filters.size) || filters.size < 1 || filters.size > 100 ||
    (filters.status !== undefined && !isOrderStatus(filters.status)))
    throw createInvalidResponseError("Invalid order filters");
  const { data, page } = await requestApi<unknown>("GET", "/api/v1/orders", undefined, {
    ...options, auth: true, params: { ...filters },
  });
  if (!Array.isArray(data) || !page)
    throw createInvalidResponseError("Invalid order page");
  return {
    content: data.map(parseOrderSummary), page: page.number, size: page.size,
    totalElements: page.totalElements, totalPages: page.totalPages,
  };
};
