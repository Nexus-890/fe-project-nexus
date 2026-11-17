import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import { normalizeMoney } from "./catalogService";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { Page } from "../types/commonResponseType";
import type { OrderFilters } from "../types/orderRequestType";
import type { OrderDetail, OrderDetailItem, OrderGroup, OrderHistoryEntry, OrderPriceBreakdown, OrderStatus, OrderSummary } from "../types/orderResponseType";
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
const parseBreakdown = (value: Record<string, unknown>): OrderPriceBreakdown | null => {
  const fields = [value.subtotal, value.shippingFee, value.discountAmount, value.taxAmount];
  if (fields.every((field) => field == null)) return null;
  const [subtotal, shippingFee, discountAmount, taxAmount] = fields.map(parseAmount);
  return { subtotal, shippingFee, discountAmount, taxAmount };
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
    createdAt: value.createdAt, status: value.status, totalAmount, breakdown: parseBreakdown(value),
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

export const parseOrderDetail = (value: unknown): OrderDetail => {
  const summary = parseOrderSummary(value);
  if (!isRecord(value) || !isUuid(value.userId) || !isUuid(value.sellerId) ||
    (value.orderType !== "STANDARD" && value.orderType !== "AUCTION") || !Array.isArray(value.items) ||
    (value.canCancel !== undefined && typeof value.canCancel !== "boolean") ||
    (value.deliveredAt != null && !isInstant(value.deliveredAt)) ||
    (value.autoCompleteAt != null && !isInstant(value.autoCompleteAt)) ||
    (value.receiptIssueReportedAt != null && !isInstant(value.receiptIssueReportedAt)) ||
    (value.receiptIssueReason != null && (!isNonBlank(value.receiptIssueReason) || value.receiptIssueReason.length > 500)) ||
    ((value.receiptIssueReason == null) !== (value.receiptIssueReportedAt == null)))
    throw createInvalidResponseError("Invalid order details");
  const items: OrderDetailItem[] = value.items.map((item) => {
    if (!isRecord(item) || !isUuid(item.orderItemId) || !isUuid(item.productId) || !isUuid(item.skuId) ||
      !isNonBlank(item.productName) || !isNonBlank(item.skuCode) ||
      (item.imageUrl !== null && typeof item.imageUrl !== "string") ||
      !Number.isSafeInteger(item.quantity) || Number(item.quantity) < 1)
      throw createInvalidResponseError("Invalid order item");
    return {
      orderItemId: item.orderItemId, productId: item.productId, skuId: item.skuId,
      productName: item.productName, skuCode: item.skuCode, imageUrl: item.imageUrl as string | null,
      quantity: Number(item.quantity), unitPrice: parseAmount(item.unitPrice), totalPrice: parseAmount(item.totalPrice),
    };
  });
  if (new Set(items.map((item) => item.orderItemId)).size !== items.length)
    throw createInvalidResponseError("Duplicate order items");
  // Older responses remain readable but cannot authorize a cancellation action.
  return { ...summary, userId: value.userId, sellerId: value.sellerId, orderType: value.orderType,
    items, canCancel: value.canCancel === true,
    deliveredAt: value.deliveredAt == null ? null : value.deliveredAt as string,
    autoCompleteAt: value.autoCompleteAt == null ? null : value.autoCompleteAt as string,
    receiptIssueReason: value.receiptIssueReason == null ? null : value.receiptIssueReason as string,
    receiptIssueReportedAt: value.receiptIssueReportedAt == null ? null : value.receiptIssueReportedAt as string };
};

export const getOrder = async (orderId: string, options: ServiceRequestOptions = {}): Promise<OrderDetail> => {
  if (!isUuid(orderId)) throw createInvalidResponseError("A valid order reference is required");
  const { data } = await requestApi<unknown>("GET", `${ORDERS_PATH}/${encodeURIComponent(orderId)}`, undefined, {
    ...options, auth: true, params: undefined,
  });
  const order = parseOrderDetail(data);
  if (order.orderId.toLowerCase() !== orderId.toLowerCase()) throw createInvalidResponseError("Order reference mismatch");
  return order;
};

export const getOrderHistory = async (orderId: string, options: ServiceRequestOptions = {}): Promise<OrderHistoryEntry[]> => {
  if (!isUuid(orderId)) throw createInvalidResponseError("A valid order reference is required");
  const { data } = await requestApi<unknown>("GET", `${ORDERS_PATH}/${encodeURIComponent(orderId)}/history`, undefined, {
    ...options, auth: true, params: undefined,
  });
  if (!Array.isArray(data)) throw createInvalidResponseError("Invalid order history");
  return data.map((entry) => {
    if (!isRecord(entry) || !isUuid(entry.id) || (entry.changedBy !== null && !isUuid(entry.changedBy)) || !isInstant(entry.createdAt) ||
      !isOrderStatus(entry.newStatus) || (entry.previousStatus !== null && !isOrderStatus(entry.previousStatus)) ||
      (entry.reason !== null && typeof entry.reason !== "string")) throw createInvalidResponseError("Invalid order history entry");
    return { id: entry.id, changedBy: entry.changedBy as string | null, createdAt: entry.createdAt,
      newStatus: entry.newStatus, previousStatus: entry.previousStatus as OrderStatus | null, reason: entry.reason };
  });
};

export const cancelOrder = async (orderId: string, reason: string, options: ServiceRequestOptions = {}): Promise<OrderGroup> => {
  if (!isUuid(orderId) || !reason.trim() || reason.trim().length > 500)
    throw createInvalidResponseError("Enter a cancellation reason of up to 500 characters");
  const { data } = await requestApi<unknown>("POST", `${ORDERS_PATH}/${encodeURIComponent(orderId)}/cancel`, { reason: reason.trim() }, {
    ...options, auth: true, params: undefined,
  });
  if (!isRecord(data) || !isUuid(data.orderGroupId)) throw createInvalidResponseError("Invalid canceled order group");
  const group = parseOrderGroup(data, data.orderGroupId);
  if (!group.orders.some((order) => order.orderId.toLowerCase() === orderId.toLowerCase()))
    throw createInvalidResponseError("Canceled order reference mismatch");
  return group;
};

/** The backend owns the locked receipt transition, history and completion outbox event. */
export const confirmReceipt = async (orderId: string, options: ServiceRequestOptions = {}): Promise<OrderDetail> => {
  if (!isUuid(orderId)) throw createInvalidResponseError("A valid order reference is required");
  const { data } = await requestApi<unknown>("POST", `${ORDERS_PATH}/${encodeURIComponent(orderId)}/confirm-receipt`, undefined, {
    ...options, auth: true, params: undefined,
  });
  const order = parseOrderDetail(data);
  if (order.orderId.toLowerCase() !== orderId.toLowerCase() || order.status !== "COMPLETED")
    throw createInvalidResponseError("Receipt confirmation did not return the completed order");
  return order;
};

export const reportReceiptIssue = async (orderId: string, reason: string, options: ServiceRequestOptions = {}): Promise<OrderDetail> => {
  if (!isUuid(orderId) || !reason.trim() || reason.trim().length > 500)
    throw createInvalidResponseError("Enter a receipt issue reason of up to 500 characters");
  const { data } = await requestApi<unknown>("POST", `${ORDERS_PATH}/${encodeURIComponent(orderId)}/receipt-issue`, { reason: reason.trim() }, {
    ...options, auth: true, params: undefined,
  });
  const order = parseOrderDetail(data);
  if (order.orderId.toLowerCase() !== orderId.toLowerCase() || order.status !== "DELIVERED" || !order.receiptIssueReportedAt)
    throw createInvalidResponseError("Receipt issue did not return the held delivered order");
  return order;
};
