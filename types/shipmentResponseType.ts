import type { components } from "./shipmentGeneratedType";

export type ShipmentStatus = components["schemas"]["ShipmentStatus"];
export type ShipmentTracking = components["schemas"]["ShipmentTrackingResponse"];
export type ShipmentHistoryEntry = ShipmentTracking["history"][number];
