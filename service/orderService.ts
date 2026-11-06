import {
  createInvalidResponseError,
  isRecord,
  requestApi,
} from "../configs/api";
import { normalizeMoney } from "./catalogService";
import type { operations } from "../types/commerceGeneratedType";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { Page } from "../types/commonResponseType";
import type {
  OrderGroup,
  OrderStatus,
  OrderSummary,
} from "../types/orderResponseType";

export type OwnOrdersFilters = NonNullable<
  operations["listOwnOrders"]["parameters"]["query"]
>;

export const ORDERS_PATH = "/api/v1/orders";
export const ORDER_GROUPS_PATH = "/api/v1/orders/groups";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const ORDER_STATUSES: readonly OrderStatus[] = [
  "PENDING", "PAID", "SHIPPED", "DELIVERED", "COMPLETED", "CANCELED",
  "REFUND_REQUESTED", "REFUNDED",
];
const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_PATTERN.test(value);
const isNonBlank = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const isInstant = (value: unknown): value is string =>
  typeof value === "string" && INSTANT_PATTERN.test(value) && Number.isFinite(Date.parse(value));
const isOrderStatus = (value: unknown): value is OrderStatus =>
  typeof value === "string" && ORDER_STATUSES.some((status) => status === value);
const parseAmount = (value: unknown): string => {
  // The delivered contract uses BigDecimal JSON numbers, never money strings.
  const amount = typeof value === "number" && Number.isSafeInteger(Math.trunc(value))
    ? normalizeMoney(value) : null;
  if (amount === null || !/^\d+(?:\.\d{1,2})?$/.test(amount))
    throw createInvalidResponseError("Invalid order amount");
  return amount;
};

export const parseOrderSummary = (value: unknown): OrderSummary => {
  if (
    !isRecord(value) || !isUuid(value.orderId) ||
    !isNonBlank(value.orderNumber) || !isOrderStatus(value.status) ||
    !isInstant(value.createdAt)
  ) throw createInvalidResponseError("Invalid order summary");
  return {
    orderId: value.orderId,
    orderNumber: value.orderNumber,
    status: value.status,
    createdAt: value.createdAt,
    totalAmount: parseAmount(value.totalAmount),
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
    orderGroupId: value.orderGroupId,
    status: value.status,
    totalAmount: parseAmount(value.totalAmount),
    currency: value.currency,
    dueAt: value.dueAt,
    orders,
  };
};

/** #138 supplies this read; local simulation uses the existing OrderGroup DTO. */
export const getOrderGroup = async (
  orderGroupId: string,
  options: ServiceRequestOptions = {},
): Promise<OrderGroup> => {
  if (!isUuid(orderGroupId))
    throw createInvalidResponseError("A valid order group reference is required");
  const { data } = await requestApi<unknown>(
    "GET",
    `${ORDER_GROUPS_PATH}/${encodeURIComponent(orderGroupId)}`,
    undefined,
    { ...options, auth: true, params: undefined },
  );
  return parseOrderGroup(data, orderGroupId);
};

export const listOwnOrders = async (
  filters: OwnOrdersFilters = {},
  options: ServiceRequestOptions = {},
): Promise<Page<OrderSummary>> => {
  const { page = 0, size = 10, status } = filters;
  if (
    !Number.isSafeInteger(page) || page < 0 ||
    !Number.isSafeInteger(size) || size < 1 || size > 100 ||
    (status !== undefined && !isOrderStatus(status))
  ) throw createInvalidResponseError("Invalid order list filters");
  const response = await requestApi<unknown>("GET", ORDERS_PATH, undefined, {
    ...options, auth: true, params: { page, size, status },
  });
  if (!response.page || !Array.isArray(response.data))
    throw createInvalidResponseError("Expected order data[] with page metadata");
  return {
    content: response.data.map(parseOrderSummary),
    page: response.page.number,
    size: response.page.size,
    totalElements: response.page.totalElements,
    totalPages: response.page.totalPages,
  };
};
