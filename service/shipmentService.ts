import { createInvalidResponseError, isRecord, requestApi } from "../configs/api";
import type { ServiceRequestOptions } from "../types/commonRequestType";
import type { ShipmentHistoryEntry, ShipmentStatus, ShipmentTracking } from "../types/shipmentResponseType";

export const SHIPMENTS_PATH = "/api/v1/shipments";
export const SHIPMENT_STATUSES = [
  "CREATED", "PENDING_TRACKING", "PICKING", "PACKED", "READY_TO_SHIP", "SHIPPED",
  "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "DELIVERY_FAILED", "RETURNING", "RETURNED", "CANCELLED",
] as const satisfies readonly ShipmentStatus[];

const isUuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const isNonBlank = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const isStatus = (value: unknown): value is ShipmentStatus => SHIPMENT_STATUSES.some((status) => status === value);
const isInstant = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
const sameId = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();

const parseHistoryEntry = (value: unknown): ShipmentHistoryEntry => {
  if (!isRecord(value) || !isUuid(value.id) || !isStatus(value.status) ||
    (value.description !== null && typeof value.description !== "string") || !isInstant(value.createdAt))
    throw createInvalidResponseError("Invalid shipment history");
  return { id: value.id, status: value.status, description: value.description, createdAt: value.createdAt };
};

/** Resolve the buyer's shipment by order, then read its persisted tracking history. */
export const getOrderShipment = async (
  orderId: string,
  options: ServiceRequestOptions = {},
): Promise<ShipmentTracking | null> => {
  if (!isUuid(orderId)) throw createInvalidResponseError("A valid order reference is required");
  const { data: shipments, page } = await requestApi<unknown>("GET", SHIPMENTS_PATH, undefined, {
    ...options, auth: true, params: { orderId, page: 0, size: 1 },
  });
  if (!Array.isArray(shipments) || !page || shipments.length > 1 || page.totalElements !== shipments.length)
    throw createInvalidResponseError("Invalid order shipment list");
  // Only a successful empty, ownership-filtered list means that there is no shipment.
  if (shipments.length === 0) return null;
  const shipment: unknown = shipments[0];
  if (!isRecord(shipment) || !isUuid(shipment.id) || !isUuid(shipment.orderId) || !sameId(shipment.orderId, orderId))
    throw createInvalidResponseError("Invalid order shipment");
  const { data } = await requestApi<unknown>("GET", `${SHIPMENTS_PATH}/${encodeURIComponent(shipment.id)}/tracking`, undefined, {
    ...options, auth: true, params: undefined,
  });
  if (!isRecord(data) || !isUuid(data.shipmentId) || !sameId(data.shipmentId, shipment.id) ||
    !isUuid(data.orderId) || !sameId(data.orderId, orderId) || !isNonBlank(data.carrier) ||
    (data.trackingCode !== null && !isNonBlank(data.trackingCode)) || !isStatus(data.status) || !Array.isArray(data.history))
    throw createInvalidResponseError("Invalid shipment tracking");
  const history = data.history.map(parseHistoryEntry);
  if (new Set(history.map((entry) => entry.id.toLowerCase())).size !== history.length)
    throw createInvalidResponseError("Duplicate shipment history");
  // The API orders by the full database timestamp; Date.parse loses sub-millisecond precision.
  return {
    shipmentId: data.shipmentId, orderId: data.orderId, carrier: data.carrier,
    trackingCode: data.trackingCode, status: data.status, history,
  };
};
