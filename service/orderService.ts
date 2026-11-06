import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import { normalizeMoney } from "./catalogService";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { Page } from "../types/commonResponseType";
import type { OrderFilters } from "../types/orderRequestType";
import type { OrderGroup, OrderStatus, OrderSummary } from "../types/orderResponseType";
import type { operations } from "../types/commerceGeneratedType";

export type OwnOrdersFilters = NonNullable<operations["listOwnOrders"]["parameters"]["query"]>;
export const ORDERS_PATH = "/api/v1/orders";
export const ORDER_GROUPS_PATH = "/api/v1/orders/groups";

export const ORDER_STATUSES = [
  "PENDING", "PAID", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELED",
  "REFUND_REQUESTED", "REFUNDED",
] as const satisfies readonly OrderStatus[];

export const isOrderStatus = (value: unknown): value is OrderStatus =>
  ORDER_STATUSES.some((status) => status === value);
const isUuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const isNonBlank = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const isInstant = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
const parseAmount = (value: unknown): string => {
  const amount = typeof value === "number" && Number.isSafeInteger(Math.trunc(value)) ? normalizeMoney(value) : null;
  if (amount === null || !/^\d+(?:\.\d{1,2})?$/.test(amount))
    throw createInvalidResponseError("Invalid order amount");
  return amount;
};

export const parseOrderSummary = (value: unknown): OrderSummary => {
  if (
    !isRecord(value) || !isUuid(value.orderId) ||
    typeof value.orderNumber !== "string" || !value.orderNumber.trim() ||
    !isInstant(value.createdAt) ||
    !isOrderStatus(value.status) || typeof value.totalAmount !== "number" ||
    (value.orderGroupId != null && !isUuid(value.orderGroupId))
  ) throw createInvalidResponseError("Invalid order");
  const totalAmount = parseAmount(value.totalAmount);
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
  const { data, page } = await requestApi<unknown>("GET", ORDERS_PATH, undefined, {
    ...options, auth: true, params: { ...filters },
  });
  if (!Array.isArray(data) || !page)
    throw createInvalidResponseError("Invalid order page");
  return {
    content: data.map(parseOrderSummary), page: page.number, size: page.size,
    totalElements: page.totalElements, totalPages: page.totalPages,
  };
};

export const parseOrderGroup = (value: unknown, orderGroupId: string): OrderGroup => {
  if (
    !isRecord(value) || !isUuid(value.orderGroupId) ||
    value.orderGroupId.toLowerCase() !== orderGroupId.toLowerCase() ||
    !isNonBlank(value.status) || typeof value.currency !== "string" ||
    !/^[A-Z]{3}$/.test(value.currency) || !isInstant(value.dueAt) ||
    !Array.isArray(value.orders) || value.orders.length === 0
  ) throw createInvalidResponseError("Invalid order group");
  const orders = value.orders.map(parseOrderSummary);
  if (new Set(orders.map((order) => order.orderId.toLowerCase())).size !== orders.length)
    throw createInvalidResponseError("Duplicate orders in group");
  return {
    orderGroupId: value.orderGroupId, status: value.status,
    totalAmount: parseAmount(value.totalAmount), currency: value.currency,
    dueAt: value.dueAt, orders,
  };
};

/** #138 supplies this read; local simulation uses the existing OrderGroup DTO. */
export const getOrderGroup = async (
  orderGroupId: string,
  options: ServiceRequestOptions = {},
): Promise<OrderGroup> => {
  if (!isUuid(orderGroupId))
    throw createInvalidResponseError("A valid order group reference is required");
  const { data } = await requestApi<unknown>("GET", `${ORDER_GROUPS_PATH}/${encodeURIComponent(orderGroupId)}`, undefined, {
    ...options, auth: true, params: undefined,
  });
  return parseOrderGroup(data, orderGroupId);
};

export const listOwnOrders = async (
  filters: OwnOrdersFilters = {},
  options: ServiceRequestOptions = {},
): Promise<Page<OrderSummary>> => {
  const { page = 0, size = 10, status } = filters;
  return getOrders({ page, size, status }, options);
};
