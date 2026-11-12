"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Check, CircleAlert, CircleCheck, Package, ReceiptText, RotateCcw, Truck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatVND } from "../components/formatPrice";
import OrderStatusBadge, { ORDER_STATUS_LABELS } from "../components/OrderStatusBadge";
import ProductImage from "../components/ProductImage";
import { queryKeys } from "../configs/queryKeys";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { cancelOrder, getOrder, getOrderHistory } from "../service/orderService";
import type { OrderDetail, OrderGroup, OrderStatus } from "../types/orderResponseType";

const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-border px-5 text-sm font-medium hover:bg-secondary disabled:opacity-50";
const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
const paidStatuses: OrderStatus[] = ["PAID", "SHIPPED", "DELIVERED", "COMPLETED"];

function OrderProgress({ status }: { status: OrderStatus }) {
  const steps: OrderStatus[] = ["PENDING", "PAID", "SHIPPED", "DELIVERED"];
  const active = status === "COMPLETED" ? 3 : steps.indexOf(status);
  if (active < 0) return null;
  return <ol aria-label="Order progress" className="mt-5 flex items-start justify-between gap-2 border-t border-border pt-5">
    {steps.map((step, index) => <li key={step} aria-current={active === index ? "step" : undefined} className={`flex flex-1 flex-col items-center gap-2 text-center text-xs ${index <= active ? "text-primary" : "text-muted-foreground"}`}>
      <span className={`flex size-6 items-center justify-center rounded-full border ${index <= active ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{index < active ? <Check size={13} aria-hidden="true" /> : index + 1}</span>
      {index === 0 ? "Placed" : step === "PAID" ? "Paid" : step === "SHIPPED" ? "Shipped" : "Delivered"}
    </li>)}
  </ol>;
}

function OrderReceipt({ order }: { order: OrderDetail }) {
  return <aside className="min-w-0 rounded-sm border border-border bg-card p-5 sm:p-6" aria-label="Order receipt">
    <h2 className="text-base font-semibold">Order summary</h2>
    <dl className="mt-5 space-y-3 text-sm">
      <div className="flex justify-between gap-5"><dt className="text-muted-foreground">Order</dt><dd className="break-all text-right font-mono">{order.orderNumber}</dd></div>
      <div className="flex justify-between gap-5"><dt className="text-muted-foreground">Placed</dt><dd className="text-right"><time dateTime={order.createdAt}>{dateFormatter.format(new Date(order.createdAt))}</time></dd></div>
      <div className="flex justify-between gap-5"><dt className="text-muted-foreground">Items</dt><dd>{order.items.reduce((sum, item) => sum + item.quantity, 0)}</dd></div>
      <div className="flex justify-between gap-5"><dt className="text-muted-foreground">Order type</dt><dd>{order.orderType === "AUCTION" ? "Auction" : "Shop purchase"}</dd></div>
      <div className="flex justify-between gap-5"><dt className="text-muted-foreground">Status</dt><dd><OrderStatusBadge status={order.status} /></dd></div>
      <div className="flex justify-between gap-5 border-t border-border pt-4 font-semibold"><dt>Total</dt><dd className="font-mono tabular-nums text-primary">{formatVND(order.totalAmount)}</dd></div>
    </dl>
    <OrderProgress status={order.status} />
  </aside>;
}

function OrderContents({ orderId, result }: { orderId: string; result: boolean }) {
  const auth = useAuth();
  const client = useQueryClient();
  const [reason, setReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reasonError, setReasonError] = useState(false);
  const order = useApiQuery({
    queryKey: queryKeys.orders.detail(auth.sessionId, orderId), meta: { requiresAuth: true },
    service: (signal) => getOrder(orderId, { context: auth.requestContext, signal }),
  }, { retry: false });
  const history = useApiQuery({
    queryKey: queryKeys.orders.history(auth.sessionId, orderId), meta: { requiresAuth: true },
    service: (signal) => getOrderHistory(orderId, { context: auth.requestContext, signal }),
  }, { enabled: !result && order.isSuccess, retry: false });
  const cancellation = useApiMutation<OrderGroup, { reason: string; sessionId: number }>({
    mutationKey: ["orders", auth.sessionId, "cancel", orderId],
    isCurrent: (variables) => auth.isSessionCurrent(variables.sessionId),
    execute: (variables) => cancelOrder(orderId, variables.reason, { context: auth.requestContext }),
    invalidateKey: [["orders", auth.sessionId], ["payment", auth.sessionId], queryKeys.cart.me(auth.sessionId)],
  }, { onSuccess: (group) => {
    client.setQueryData(queryKeys.orders.group(auth.sessionId, group.orderGroupId), group);
    setCancelOpen(false);
    setReason("");
  }, onError: async (error, variables) => {
    if (error.status === 409 && auth.isSessionCurrent(variables.sessionId)) {
      await client.invalidateQueries({ queryKey: ["orders", variables.sessionId], refetchType: "active" });
    }
  } });

  if (order.isPending) return <p role="status" className="py-12 text-muted-foreground">Loading your order…</p>;
  if (!order.data || order.isError) {
    const forbidden = order.error?.status === 403;
    const expired = order.error?.status === 401;
    const missing = order.error?.status === 404;
    return <div className="rounded-sm border border-border bg-card p-6">
      <ReceiptText size={28} className="text-primary" aria-hidden="true" />
      <h1 id="order-detail-title" className="mt-4 text-heading-24">{forbidden ? "You cannot view this order" : missing ? "Order not found" : "Unable to load your order"}</h1>
      <p role="alert" className="mt-3 break-words text-sm text-muted-foreground">{order.error?.detail || order.error?.title || "Please try again."}</p>
      {cancellation.error && <p role="alert" className="mt-3 break-words text-sm text-danger">{cancellation.error.detail || cancellation.error.title}</p>}
      <div className="mt-5 flex flex-wrap gap-3">
        {expired ? <Link href={`/sign-in?returnTo=${encodeURIComponent(result ? `/checkout/result/${orderId}` : `/order/${orderId}`)}`} className={buttonClass}>Sign in</Link> : !forbidden && !missing && <button type="button" className={buttonClass} onClick={() => void order.refetch()}>Retry order</button>}
        <Link href="/orders" className={buttonClass}><ArrowLeft size={16} aria-hidden="true" />All orders</Link>
      </div>
    </div>;
  }
  const current = order.data;
  const paid = paidStatuses.includes(current.status);
  const pending = current.status === "PENDING";
  const reasonMessage = reasonError ? "Enter a cancellation reason of up to 500 characters." : cancellation.error?.fieldErrors?.reason?.join(" ");
  const refund = current.status === "REFUNDED" ? "Refunded" : current.status === "REFUND_REQUESTED" ? "Refund requested" :
    current.status === "CANCELED" && history.data?.some((entry) => entry.previousStatus === "PAID" || entry.newStatus === "PAID") ? "Awaiting refund" : null;

  return <>
    <div className="grid min-w-0 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
      <div className="min-w-0">
        <p className={`flex items-center gap-2 text-sm ${paid ? "text-success" : pending ? "text-warning-foreground" : "text-muted-foreground"}`}>
          {paid ? <CircleCheck size={18} aria-hidden="true" /> : <CircleAlert size={18} aria-hidden="true" />}
          {paid ? "Payment received" : pending ? "Awaiting payment" : ORDER_STATUS_LABELS[current.status]}
        </p>
        <h1 id="order-detail-title" className="mt-3 text-heading-32 [overflow-wrap:anywhere]">Order {current.orderNumber}{result && pending ? " isn’t paid yet" : ""}</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{paid ? "Thank you for your purchase. Follow your order’s progress here and keep your order reference for support." : pending ? "Your order has been placed and is waiting for payment. Complete your bank transfer using the payment instructions for your order group." : "Check your order details and its latest status below."}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {current.orderGroupId && pending && <Link href={`/checkout/payment/${encodeURIComponent(current.orderGroupId)}`} className="inline-flex min-h-11 items-center rounded-sm bg-primary px-5 text-sm font-medium text-primary-foreground">Pay now</Link>}
          {result && <Link href={`/order/${encodeURIComponent(current.orderId)}`} className="inline-flex min-h-11 items-center rounded-sm bg-primary px-5 text-sm font-medium text-primary-foreground">View Order</Link>}
          <Link href="/" className={buttonClass}>Continue Shopping</Link>
          {!result && current.canCancel && <button type="button" aria-expanded={cancelOpen} aria-controls="cancel-order-form" onClick={() => {
            cancellation.reset();
            setReasonError(false);
            setCancelOpen((open) => !open);
          }} className={`${buttonClass} text-danger`} disabled={cancellation.isPending}>Cancel order</button>}
        </div>
        {cancelOpen && current.canCancel && <form id="cancel-order-form" className="mt-6 rounded-sm border border-border bg-card p-5" onSubmit={(event) => {
          event.preventDefault();
          if (cancellation.isPending) return;
          if (!reason.trim() || reason.trim().length > 500) { setReasonError(true); return; }
          setReasonError(false);
          cancellation.mutate({ reason, sessionId: auth.sessionId });
        }}>
          <label htmlFor="cancel-reason" className="text-sm font-medium">Why do you want to cancel?</label>
          <p id="cancel-order-help" className="mt-2 text-xs leading-5 text-muted-foreground">{pending ? "This cancels every pending order in this payment group. Items from the other orders return to your cart." : "This cancels only this order. Your payment will enter the refund process; the other orders are unchanged."}</p>
          <textarea id="cancel-reason" value={reason} onChange={(event) => setReason(event.target.value)} required maxLength={500} disabled={cancellation.isPending} aria-invalid={!!reasonMessage} aria-describedby={`cancel-order-help${reasonMessage ? " cancel-reason-error" : ""}`} className="mt-3 min-h-24 w-full rounded-sm border border-input bg-background p-3 text-sm" />
          {reasonMessage && <p id="cancel-reason-error" role="alert" className="mt-2 text-sm text-danger">{reasonMessage}</p>}
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="submit" disabled={cancellation.isPending} className={`${buttonClass} border-danger bg-danger text-danger-foreground hover:bg-danger/90`}>{cancellation.isPending ? "Canceling…" : "Confirm cancellation"}</button>
            <button type="button" disabled={cancellation.isPending} className={buttonClass} onClick={() => { setCancelOpen(false); cancellation.reset(); }}>Keep order</button>
          </div>
        </form>}
        {cancellation.error && <p role="alert" className="mt-4 text-sm text-danger">{cancellation.error.detail || cancellation.error.title}</p>}
        {cancellation.isSuccess && <p role="status" className="mt-4 text-sm text-success">Your cancellation request was processed.</p>}
        {refund && <section aria-label="Refund status" className="mt-6 rounded-sm border border-border bg-muted p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold"><RotateCcw size={18} aria-hidden="true" />Refund status</h2>
          <p role="status" className="mt-3 text-sm font-medium">{refund}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{refund === "Refunded" ? "Your refund has been completed." : refund === "Refund requested" ? "Your refund request is being processed. Check back here for updates." : "Your paid order has been cancelled. We are waiting for the refund process to start."}</p>
          {refund !== "Refunded" && <button type="button" className={`${buttonClass} mt-4`} disabled={order.isFetching || history.isFetching} onClick={() => void Promise.all([order.refetch(), history.refetch()])}>{order.isFetching || history.isFetching ? "Refreshing…" : "Refresh refund status"}</button>}
        </section>}
      </div>
      <OrderReceipt order={current} />
    </div>
    {!result && <div className="mt-10 grid min-w-0 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="min-w-0 rounded-sm border border-border p-5 sm:p-6" aria-label="Order items">
        <h2 className="flex items-center gap-2 text-heading-20"><Package size={20} aria-hidden="true" />Your items</h2>
        <ul className="mt-5 divide-y divide-border">{current.items.map((item) => <li key={item.orderItemId} className="flex min-w-0 gap-4 py-5 first:pt-0">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted"><ProductImage src={item.imageUrl ?? undefined} alt={item.productName} productName={item.productName} /></div>
          <div className="min-w-0 flex-1"><Link href={`/products/${encodeURIComponent(item.productId)}`} className="text-sm font-medium hover:text-primary [overflow-wrap:anywhere]">{item.productName}</Link><p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">{item.skuCode}</p><p className="mt-2 text-xs text-muted-foreground">Qty {item.quantity} · {formatVND(item.unitPrice)} each</p><p className="mt-2 font-mono text-sm font-semibold text-primary [overflow-wrap:anywhere]">{formatVND(item.totalPrice)}</p></div>
        </li>)}</ul>
      </section>
      <section className="rounded-sm border border-border p-5 sm:p-6" aria-label="Order history"><h2 className="flex items-center gap-2 text-base font-semibold"><Truck size={18} aria-hidden="true" />Order timeline</h2>
        {history.isPending ? <p role="status" className="mt-4 text-sm text-muted-foreground">Loading updates…</p> : history.isError ? <div className="mt-4 text-sm"><p role="alert">{history.error.detail || "Unable to load updates."}</p><button type="button" onClick={() => void history.refetch()} className={`${buttonClass} mt-3`}>Retry updates</button></div> : <ol className="mt-5 space-y-6">{history.data?.map((entry) => <li key={entry.id} className="border-l-2 border-primary pl-4"><p className="text-sm font-medium">{ORDER_STATUS_LABELS[entry.newStatus]}</p><time dateTime={entry.createdAt} className="mt-1 block text-xs text-muted-foreground">{dateFormatter.format(new Date(entry.createdAt))}</time>{entry.reason && <p className="mt-2 break-words text-xs leading-5 text-muted-foreground">{entry.reason}</p>}</li>)}</ol>}
        {history.isSuccess && !history.data.length && <p className="mt-4 text-sm text-muted-foreground">No updates yet.</p>}
      </section>
    </div>}
    <Link href="/orders" className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm hover:text-primary"><ArrowLeft size={16} aria-hidden="true" />All orders</Link>
  </>;
}

function OrderDetailPage({ orderId, result = false }: { orderId: string; result?: boolean }) {
  const auth = useAuth();
  const returnTo = result ? `/checkout/result/${orderId}` : `/order/${orderId}`;
  return <section className="mx-auto w-full max-w-[1248px] px-4 py-10 sm:px-6 lg:py-14" aria-labelledby="order-detail-title">
    {auth.status === "authenticated" ? <OrderContents key={`${auth.sessionId}:${orderId}`} orderId={orderId} result={result} /> : auth.status === "anonymous" ? <div className="rounded-sm border border-border p-8"><ReceiptText size={30} className="text-primary" aria-hidden="true" /><h1 id="order-detail-title" className="mt-4 text-heading-24">Sign in to view your order</h1><Link href={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`} className={`${buttonClass} mt-5`}>Sign in</Link></div> : auth.status === "error" ? <div className="rounded-sm border border-border p-6"><p role="alert">{auth.error?.detail || "Unable to load your account."}</p><button type="button" onClick={() => void auth.retryProfile()} className={`${buttonClass} mt-4`}>Retry account</button></div> : <p role="status" className="py-12 text-muted-foreground">Loading your account…</p>}
  </section>;
}

export default OrderDetailPage;
