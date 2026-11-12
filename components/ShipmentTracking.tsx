import { Check, Clock3, Truck } from "lucide-react";
import CopyableField from "./CopyableField";
import type { ShipmentStatus, ShipmentTracking as ShipmentTrackingData } from "../types/shipmentResponseType";

const statusLabels: Record<ShipmentStatus, string> = {
  CREATED: "Shipment created", PENDING_TRACKING: "Preparing shipment", PICKING: "Picking items",
  PACKED: "Packed", READY_TO_SHIP: "Ready to ship", SHIPPED: "Shipped", IN_TRANSIT: "In transit",
  OUT_FOR_DELIVERY: "Out for delivery", DELIVERED: "Delivered", DELIVERY_FAILED: "Delivery attempt failed",
  RETURNING: "Returning to sender", RETURNED: "Returned", CANCELLED: "Shipment cancelled",
};
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh",
});

function ShipmentTracking({ shipment }: { shipment: ShipmentTrackingData }) {
  const needsAttention = ["DELIVERY_FAILED", "RETURNING", "RETURNED", "CANCELLED"].includes(shipment.status);
  return (
    <section aria-label="Shipment tracking" className="mt-10 min-w-0 rounded-sm border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-heading-20"><Truck size={21} className="text-primary" aria-hidden="true" />Shipment tracking</h2>
        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${needsAttention ? "border-warning text-warning-foreground" : shipment.status === "DELIVERED" ? "border-success text-success" : "border-border bg-muted text-foreground"}`}>
          {statusLabels[shipment.status]}
        </span>
      </div>
      <div className="mt-5 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:gap-10">
        <dl className="min-w-0 divide-y divide-border rounded-sm border border-border px-4">
          <div className="py-4"><dt className="text-sm text-muted-foreground">Carrier</dt><dd className="mt-2 break-words text-sm font-medium">{shipment.carrier}</dd></div>
          {shipment.trackingCode ? <CopyableField label="Tracking code" value={shipment.trackingCode} /> : <div className="py-4"><dt className="text-sm text-muted-foreground">Tracking code</dt><dd className="mt-2 text-sm text-muted-foreground">The carrier hasn’t assigned a tracking code yet.</dd></div>}
        </dl>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Shipping updates</h3>
          {shipment.history.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No shipping updates yet.</p> : (
            <ol aria-label="Shipment status history" className="mt-5">
              {shipment.history.map((entry, index) => {
                const latest = index === shipment.history.length - 1;
                return <li key={entry.id} aria-current={latest ? "step" : undefined} className={`relative ml-3 border-l pb-6 pl-7 last:border-transparent last:pb-0 ${latest ? "border-transparent" : "border-border"}`}>
                  <span className={`absolute -left-3 top-0 flex size-6 items-center justify-center rounded-full border ${latest ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}>
                    {latest ? <Truck size={13} aria-hidden="true" /> : <Check size={13} aria-hidden="true" />}
                  </span>
                  <p className={`text-sm font-medium ${latest ? "text-primary" : "text-foreground"}`}>{statusLabels[entry.status]}</p>
                  <time dateTime={entry.createdAt} className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 size={12} aria-hidden="true" />{dateFormatter.format(new Date(entry.createdAt))}</time>
                  {entry.description && <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">{entry.description}</p>}
                </li>;
              })}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}

export default ShipmentTracking;
