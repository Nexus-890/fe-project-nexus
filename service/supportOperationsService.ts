import { AxiosHeaders } from "axios";
import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import { parseOrderDetail, isOrderStatus } from "./orderService";
import { SHIPMENT_STATUSES } from "./shipmentService";
import type { ApiResponse, Page } from "../types/commonResponseType";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { OrderDetail } from "../types/orderResponseType";
import type { ChangeOrderStatusInput, ManagedOrderFilters, ManagedShipment, PaymentFilters, PaymentTransaction, Refund, RefundInput, RefundResult, ShipmentFilters, ShipmentInput, ShipmentStep, ShipmentUpdate } from "../types/supportOperationsType";

const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const instant = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
const text = (v: unknown): v is string => typeof v === "string" && !!v.trim();
const nullableText = (v: unknown) => v === null || typeof v === "string";
const money = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && Number.isSafeInteger(Math.round(v * 100)) && Number(v.toFixed(2)) === v;
const shipmentStatus = (v: unknown): v is ManagedShipment["status"] => SHIPMENT_STATUSES.some((s) => s === v);
const fail = (message: string): never => { throw createInvalidResponseError(message); };
const requireId = (id: string) => { if (!uuid(id)) fail("Enter a valid UUID reference."); };
const reason = (v: string, max: number) => { if (!v.trim() || v.trim().length > max) fail(`Enter a reason of 1–${max} characters.`); return v.trim(); };
const filtersOf = <T extends { page?: number; size?: number; orderId?: string }>(filters: T) => {
  const { page = 0, size = 10 } = filters;
  if (!Number.isSafeInteger(page) || page < 0 || page > 2147483646 || !Number.isInteger(size) || size < 1 || size > 100 || filters.orderId !== undefined && !uuid(filters.orderId)) fail("Invalid list filters.");
  return { ...filters, page, size };
};
const pageOf = <T>(response: ApiResponse<unknown>, parse: (v: unknown) => T, expectedPage?: number): Page<T> => {
  if (!Array.isArray(response.data) || !response.page || expectedPage !== undefined && response.page.number !== expectedPage || response.data.length > response.page.size || response.data.length > response.page.totalElements) return fail("Invalid operations page.");
  return { content: response.data.map(parse), page: response.page.number, size: response.page.size, totalElements: response.page.totalElements, totalPages: response.page.totalPages };
};
const withKey = (key: string, options: ServiceRequestOptions): ServiceRequestOptions => {
  requireId(key);
  const headers = new AxiosHeaders(options.config?.headers); headers.set("Idempotency-Key", key);
  return { ...options, auth: true, params: undefined, config: { ...options.config, headers } };
};

export const getManagedOrders = async (filters: ManagedOrderFilters, options: ServiceRequestOptions = {}): Promise<Page<OrderDetail>> => {
  const params = filtersOf(filters);
  if (filters.userId !== undefined && !uuid(filters.userId) || filters.sellerId !== undefined && !uuid(filters.sellerId) || filters.status !== undefined && !isOrderStatus(filters.status) || filters.orderType !== undefined && !["STANDARD", "AUCTION"].includes(filters.orderType) || [filters.from, filters.to].some((v) => v !== undefined && !instant(v)) || filters.from && filters.to && Date.parse(filters.from) > Date.parse(filters.to)) fail("Invalid order filters.");
  return pageOf(await requestApi("GET", "/api/v1/orders/manage", undefined, { ...options, auth: true, params }), parseOrderDetail, params.page);
};
export const changeManagedOrderStatus = async (id: string, body: ChangeOrderStatusInput, options: ServiceRequestOptions = {}): Promise<OrderDetail> => {
  requireId(id); if (!isOrderStatus(body.status)) fail("Invalid order status.");
  const { data } = await requestApi("PATCH", `/api/v1/orders/${id}/status`, { status: body.status, reason: reason(body.reason, 500) }, { ...options, auth: true, params: undefined });
  const order = parseOrderDetail(data); if (order.orderId !== id) fail("Order reference mismatch."); return order;
};
export const parsePaymentTransaction = (v: unknown): PaymentTransaction => {
  if (!isRecord(v) || !uuid(v.transactionId) || !uuid(v.orderGroupId) || !text(v.provider) || !nullableText(v.providerReference) || !money(v.amount) || v.currency !== "VND" || !["NORMAL", "REFUND"].includes(String(v.type)) || !["PENDING", "SUCCESS", "FAILED", "UNRECONCILED"].includes(String(v.status)) || !instant(v.receivedAt)) return fail("Invalid payment transaction.");
  return { transactionId: v.transactionId, orderGroupId: v.orderGroupId, provider: v.provider, providerReference: v.providerReference as string | null, amount: v.amount, currency: v.currency, type: v.type as PaymentTransaction["type"], status: v.status as PaymentTransaction["status"], receivedAt: v.receivedAt };
};
export const getManagedPayments = async (filters: PaymentFilters, options: ServiceRequestOptions = {}): Promise<Page<PaymentTransaction>> => {
  const params = filtersOf(filters);
  if (filters.status !== undefined && !["PENDING", "SUCCESS", "FAILED", "UNRECONCILED"].includes(filters.status)) fail("Invalid payment status.");
  // The order lookup is a complete list; backend ignores status/page when orderId is present.
  return pageOf(await requestApi("GET", "/api/v1/payments", undefined, { ...options, auth: true, params }), parsePaymentTransaction, params.orderId ? undefined : params.page);
};
export const parseRefund = (v: unknown): Refund => {
  if (!isRecord(v) || !uuid(v.refundId) || !uuid(v.orderId) || !money(v.amount) || v.amount <= 0 || v.currency !== "VND" || !["REQUESTED", "COMPLETED"].includes(String(v.status)) || !text(v.reason) || !instant(v.requestedAt) || !(v.completedAt === null || instant(v.completedAt))) return fail("Invalid refund.");
  return { refundId: v.refundId, orderId: v.orderId, amount: v.amount, currency: v.currency, status: v.status as Refund["status"], reason: v.reason, requestedAt: v.requestedAt, completedAt: v.completedAt as string | null };
};
export const getOrderRefunds = async (orderId: string, options: ServiceRequestOptions = {}): Promise<Refund[]> => {
  requireId(orderId); const response = await requestApi("GET", "/api/v1/refunds", undefined, { ...options, auth: true, params: { orderId } });
  const rows = pageOf(response, parseRefund).content;
  if (rows.length > 1 || rows.some((row) => row.orderId !== orderId)) fail("Refund order reference mismatch."); return rows;
};
export const requestOrderRefund = async (body: RefundInput, key: string, options: ServiceRequestOptions = {}): Promise<RefundResult> => {
  requireId(body.orderId); if (body.amount !== undefined && (!money(body.amount) || body.amount <= 0)) fail("Enter a positive amount with at most two decimal places.");
  const { data } = await requestApi("POST", "/api/v1/refunds", { ...body, reason: reason(body.reason, 500) }, withKey(key, options));
  if (!isRecord(data) || !uuid(data.refundId) || !["REQUESTED", "COMPLETED"].includes(String(data.status))) return fail("Invalid refund request result.");
  return { refundId: data.refundId, status: data.status as Refund["status"] };
};
export const completeOrderRefund = async (id: string, options: ServiceRequestOptions = {}): Promise<Refund> => {
  requireId(id); const { data } = await requestApi("POST", `/api/v1/refunds/${id}/complete`, undefined, { ...options, auth: true, params: undefined });
  const refund = parseRefund(data); if (refund.refundId !== id || refund.status !== "COMPLETED") fail("Refund completion reference mismatch."); return refund;
};
export const parseManagedShipment = (v: unknown): ManagedShipment => {
  if (!isRecord(v) || ![v.id, v.orderId, v.warehouseId, v.buyerId].every(uuid) || !text(v.carrier) || !nullableText(v.serviceType) || !nullableText(v.trackingCode) || !shipmentStatus(v.status) || !money(v.shippingFee) || !isRecord(v.shippingInfo) || !instant(v.createdAt) || !instant(v.updatedAt) || !Number.isSafeInteger(v.version) || Number(v.version) < 0) return fail("Invalid shipment.");
  return { id: v.id as string, orderId: v.orderId as string, warehouseId: v.warehouseId as string, buyerId: v.buyerId as string, carrier: v.carrier, serviceType: v.serviceType as string | null, trackingCode: v.trackingCode as string | null, status: v.status, shippingFee: v.shippingFee, shippingInfo: v.shippingInfo, createdAt: v.createdAt, updatedAt: v.updatedAt, version: Number(v.version) };
};
export const getManagedShipments = async (filters: ShipmentFilters, options: ServiceRequestOptions = {}): Promise<Page<ManagedShipment>> => {
  const params = filtersOf(filters); if (params.status !== undefined && !shipmentStatus(params.status)) fail("Invalid shipment status.");
  return pageOf(await requestApi("GET", "/api/v1/shipments", undefined, { ...options, auth: true, params }), parseManagedShipment, params.page);
};
export const createManagedShipment = async (body: ShipmentInput, key: string, options: ServiceRequestOptions = {}): Promise<ManagedShipment> => {
  requireId(body.orderId); if (body.warehouseId != null) requireId(body.warehouseId);
  if ([body.carrier, body.serviceType].some((v) => v != null && (!/^\S{1,40}$/.test(v)))) fail("Carrier and service type must be 1–40 non-space characters.");
  const { data } = await requestApi("POST", "/api/v1/shipments", body, withKey(key, options));
  const row = parseManagedShipment(data); if (row.orderId !== body.orderId) fail("Shipment order reference mismatch."); return row;
};
export const updateManagedShipment = async (id: string, body: ShipmentUpdate, override: boolean, options: ServiceRequestOptions = {}): Promise<ManagedShipment> => {
  requireId(id); if (!shipmentStatus(body.status)) fail("Invalid shipment status.");
  const { data } = await requestApi(override ? "POST" : "PATCH", `/api/v1/shipments/${id}/${override ? "override" : "status"}`, { status: body.status, reason: reason(body.reason, 255) }, { ...options, auth: true, params: undefined });
  const row = parseManagedShipment(data); if (row.id !== id) fail("Shipment reference mismatch."); return row;
};
export const getManagedShipmentHistory = async (id: string, page: number, options: ServiceRequestOptions = {}): Promise<Page<ShipmentStep>> => {
  requireId(id); const params = filtersOf({ page, size: 10 });
  return pageOf(await requestApi("GET", `/api/v1/shipments/${id}/history`, undefined, { ...options, auth: true, params }), (v) => {
    if (!isRecord(v) || !uuid(v.id) || !shipmentStatus(v.status) || !nullableText(v.description) || !["SYSTEM", "CARRIER_WEBHOOK", "POLLER", "MANUAL"].includes(String(v.source)) || !nullableText(v.carrierEventId) || !(v.changedBy === null || uuid(v.changedBy)) || !instant(v.changedAt)) return fail("Invalid shipment history.");
    return { id: v.id, status: v.status, description: v.description as string | null, source: v.source as ShipmentStep["source"], carrierEventId: v.carrierEventId as string | null, changedBy: v.changedBy as string | null, changedAt: v.changedAt };
  }, page);
};
