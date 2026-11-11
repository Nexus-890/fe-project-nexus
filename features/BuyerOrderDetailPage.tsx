"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Download, ExternalLink, MessageSquare, Package, Truck } from "lucide-react";
import { queryKeys } from "@/configs/queryKeys";
import { useApiMutation, useApiQuery } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { cancelOrder, getOrder, getOrderHistory } from "@/service/orderService";
import type { OrderDetail, OrderGroup, OrderHistoryEntry } from "@/types/orderResponseType";
import OrderStatusBadge, { ORDER_STATUS_LABELS } from "@/components/OrderStatusBadge";
import ProductImage from "@/components/ProductImage";
import SellerRatingPreview from "@/components/SellerRatingPreview";
import { formatVND } from "@/components/formatPrice";

const control = "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50";
const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
const card = "min-w-0 rounded-sm border border-border bg-card p-5 sm:p-6";
const sampleOrder: OrderDetail = {
  orderId: "68000000-0000-4000-8000-000000000003", orderNumber: "NX-SAMPLE-0311", userId: "10000000-0000-4000-8000-000000000001",
  sellerId: "10000000-0000-4000-8000-000000000002", orderType: "STANDARD", status: "SHIPPED", createdAt: "2026-11-09T07:01:00Z", totalAmount: "931900",
  items: [{ orderItemId: "78000000-0000-4000-8000-000000000001", productId: "58000000-0000-4000-8000-000000000001", skuId: "58000000-0000-4000-8000-000000000002",
    productName: "Puma Future Rider Trainers", skuCode: "US-9", imageUrl: null, quantity: 1, unitPrice: "899900", totalPrice: "899900" }],
};
const sampleHistory: OrderHistoryEntry[] = [
  { id: "sample-placed", previousStatus: null, newStatus: "PENDING", reason: "Order placed", changedBy: sampleOrder.userId, createdAt: sampleOrder.createdAt },
  { id: "sample-paid", previousStatus: "PENDING", newStatus: "PAID", reason: "Payment confirmed — sample bank transfer", changedBy: sampleOrder.userId, createdAt: "2026-11-09T07:02:00Z" },
  { id: "sample-shipped", previousStatus: "PAID", newStatus: "SHIPPED", reason: "Picked up by GHN — sample tracking GHN-8H2K-41QZ", changedBy: sampleOrder.sellerId, createdAt: "2026-11-10T03:05:00Z" },
];

function OrderPresentation({ order, history, sample = false, children }: { order: OrderDetail; history?: OrderHistoryEntry[]; sample?: boolean; children?: ReactNode }) {
  return <>
    <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="mb-3 text-xs text-muted-foreground"><Link href="/orders" className="hover:text-primary">Orders</Link><span aria-hidden="true"> › </span>{order.orderNumber}</p><div className="flex flex-wrap items-center gap-3"><h1 id="order-detail-title" className="break-words text-heading-32">Order {order.orderNumber}</h1><OrderStatusBadge status={order.status} /></div></div>
      <div className="flex flex-wrap gap-2"><button type="button" disabled className={control} title="Invoice download API is not available"><Download size={16} aria-hidden="true" />Download Invoice</button><button type="button" disabled className={control} title="Refund operations require support access; buyer refund requests are unavailable">Request Refund</button></div></div>
    {sample && <p className="mt-5 rounded-sm border border-border bg-muted p-4 text-sm leading-6"><strong>Sample preview.</strong> Order, delivery, address and payment information below are illustrative. They do not represent a real transaction.</p>}
    <div className="mt-7 grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-6"><section className={card} aria-label="Delivery status"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-heading-20">Delivery Status</h2><button type="button" disabled className="inline-flex min-h-9 items-center gap-2 text-xs text-muted-foreground" title="Carrier tracking API is not available"><ExternalLink size={14} aria-hidden="true" />Track on GHN</button></div>
        {history ? history.length ? <ol className="mt-5">{[...history].reverse().map((entry, index) => <li key={entry.id} className="relative ml-2 border-l border-border pb-7 pl-6 last:border-0 last:pb-0"><span className={`absolute -left-2 top-0.5 size-4 rounded-full border-4 ${index === 0 ? "border-info bg-card" : "border-foreground bg-foreground"}`} aria-hidden="true" /><div className="flex flex-wrap justify-between gap-2"><h3 className="text-sm font-medium">{ORDER_STATUS_LABELS[entry.newStatus]}</h3><time dateTime={entry.createdAt} className="text-xs text-muted-foreground">{dateFormat.format(new Date(entry.createdAt))}</time></div><p className="mt-1 break-words text-sm leading-6 text-muted-foreground">{entry.reason}</p></li>)}</ol> : <p className="mt-5 text-sm text-muted-foreground">No order updates yet.</p> : <p role="status" className="mt-5 text-sm text-muted-foreground">Loading order updates…</p>}
        <p className="mt-6 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">{sample ? "Sample delivery timeline. Live carrier events are unavailable." : "This timeline shows recorded order status changes. Live carrier tracking is not available."}</p></section>
        <section className={card} aria-label="Order items"><h2 className="text-heading-20">Items</h2><ul className="mt-5 divide-y divide-border">{order.items.map((item) => <li key={item.orderItemId} className="flex min-w-0 items-start gap-4 py-4 first:pt-0 last:pb-0"><div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted"><ProductImage compact src={item.imageUrl ?? undefined} alt={item.productName} productName={item.productName} /></div><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{item.productName}</p><p className="mt-2 break-words text-xs leading-5 text-muted-foreground">{item.skuCode} · Qty {item.quantity}</p><p className="mt-1 text-xs text-muted-foreground">{formatVND(item.unitPrice)} each</p></div><p className="max-w-[40%] break-words text-right font-mono text-sm font-medium">{formatVND(item.totalPrice)}</p></li>)}</ul></section>
        <div className="rounded-sm border border-border p-4"><SellerRatingPreview orderNumber={order.orderNumber} /><p className="mt-2 text-xs text-muted-foreground">Ratings require the pending rating API. The preview does not submit feedback.</p></div>
      </div>
      <aside className="min-w-0 space-y-4"><section className={card}><h2 className="text-heading-20">Payment</h2><dl className="mt-5 space-y-4 text-sm"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Items</dt><dd>{order.items.reduce((sum, item) => sum + item.quantity, 0)}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Order total</dt><dd className="break-words text-right font-mono font-medium">{formatVND(order.totalAmount)}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Method</dt><dd>{sample ? "Bank transfer (sample)" : "Not provided"}</dd></div></dl><p className="mt-4 text-xs leading-5 text-muted-foreground">{sample ? "Sample subtotal 899.900 ₫ + shipping 32.000 ₫." : "The order API does not expose shipping fees or payment method."}</p></section>
        <section className={card}><h2 className="text-heading-20">Ship To</h2><p className="mt-4 text-sm leading-6 text-muted-foreground">{sample ? "Sample buyer · District 5, Ho Chi Minh City" : "Shipping address is not included in the delivered order response."}</p></section>
        <section className={card}><h2 className="text-heading-20">Need Help?</h2><button type="button" disabled className={`${control} mt-4 w-full`} title="Seller messaging API is not available"><MessageSquare size={16} aria-hidden="true" />Contact Seller</button><p className="mt-3 text-xs leading-5 text-muted-foreground">Seller messaging, invoices and buyer refund requests are unavailable. Refund operations require support access.</p>{children}</section>
      </aside>
    </div>
  </>;
}

function LiveOrder({ orderId }: { orderId: string }) {
  const auth = useAuth();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const order = useApiQuery({ queryKey: queryKeys.orders.detail(auth.sessionId, orderId), meta: { requiresAuth: true }, service: (signal) => getOrder(orderId, { context: auth.requestContext, signal }) });
  const history = useApiQuery({ queryKey: queryKeys.orders.history(auth.sessionId, orderId), meta: { requiresAuth: true }, service: (signal) => getOrderHistory(orderId, { context: auth.requestContext, signal }) }, { enabled: order.isSuccess });
  const cancellation = useApiMutation<OrderGroup, { sessionId: number; controller: AbortController }>({
    execute: ({ controller }) => cancelOrder(orderId, reason, { context: auth.requestContext, signal: controller.signal }),
    isCurrent: ({ sessionId, controller }) => auth.isSessionCurrent(sessionId) && !controller.signal.aborted,
    invalidateKey: [["orders", auth.sessionId], ["payment", auth.sessionId]],
  }, { onSuccess: () => { setCancelOpen(false); setReason(""); } });
  if (order.isPending) return <p role="status" className="py-12 text-muted-foreground">Loading your order…</p>;
  if (order.isError || !order.data) return <div className={card}><h1 id="order-detail-title" className="text-heading-24">Unable to load your order</h1><p role="alert" className="mt-3 text-sm">{order.error?.detail || "Please try again."}</p><button type="button" className={`${control} mt-5`} onClick={() => void order.refetch()}>Retry order</button></div>;
  const canCancel = order.data.status === "PENDING" || order.data.status === "PAID";
  return <><OrderPresentation order={order.data} history={history.data}>
    <button type="button" disabled={!canCancel || cancellation.isPending} onClick={() => setCancelOpen(!cancelOpen)} className={`${control} mt-4 w-full text-danger`}>Cancel Order</button>
    {!canCancel && <p className="mt-2 text-xs leading-5 text-muted-foreground">Only pending or paid orders can be cancelled.</p>}
    {cancelOpen && <form className="mt-4" onSubmit={(event) => { event.preventDefault(); if (!reason.trim() || cancellation.isPending) return; const controller = new AbortController(); pending.current = controller; cancellation.mutate({ controller, sessionId: auth.sessionId }); }}>
      <p className="mb-3 text-xs leading-5 text-muted-foreground">For a pending purchase, cancellation affects every pending order in the payment group.</p><label htmlFor="cancel-reason" className="text-sm font-medium">Reason for cancellation</label><textarea id="cancel-reason" required maxLength={500} value={reason} disabled={cancellation.isPending} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-24 w-full rounded-sm border border-input bg-background p-3 text-sm" /><button type="submit" disabled={cancellation.isPending || !reason.trim()} className={`${control} mt-3 w-full text-danger`}>{cancellation.isPending ? "Cancelling…" : "Confirm cancellation"}</button>
    </form>}
    {cancellation.isError && cancellation.error.kind !== "aborted" && <p role="alert" className="mt-3 text-sm text-danger">{cancellation.error.detail || "Cancellation failed."}</p>}
    {cancellation.isSuccess && <p role="status" className="mt-3 text-sm text-success">Cancellation processed by the server.</p>}
  </OrderPresentation>
    {history.isError && <div className="mt-5"><p role="alert" className="text-sm text-danger">{history.error.detail || "Unable to load order updates."}</p><button type="button" onClick={() => void history.refetch()} className={`${control} mt-3`}>Retry updates</button></div>}
  </>;
}

function BuyerOrderDetailPage({ orderId, sample = false }: { orderId?: string; sample?: boolean }) {
  const auth = useAuth();
  return <section className="min-w-0 pb-12" aria-labelledby="order-detail-title">{sample ? <OrderPresentation sample order={sampleOrder} history={sampleHistory} /> : auth.status === "authenticated" && orderId ? <LiveOrder key={`${auth.sessionId}:${orderId}`} orderId={orderId} /> : auth.status === "anonymous" ? <><Package size={30} aria-hidden="true" className="text-primary" /><h1 id="order-detail-title" className="mt-4 text-heading-24">Sign in to view your order</h1><Link href={`/sign-in?returnTo=${encodeURIComponent(`/orders/${orderId ?? ""}`)}`} className={`${control} mt-5`}>Sign in</Link></> : auth.status === "error" ? <><p role="alert">{auth.error?.detail || "Unable to load your account."}</p><button type="button" className={`${control} mt-4`} onClick={() => void auth.retryProfile()}>Retry account</button></> : <p role="status">Loading your account…</p>}
    <Link href="/orders" className="mt-7 inline-flex min-h-11 items-center gap-2 text-sm hover:text-primary"><Truck size={16} aria-hidden="true" />All orders</Link>
  </section>;
}

export default BuyerOrderDetailPage;
