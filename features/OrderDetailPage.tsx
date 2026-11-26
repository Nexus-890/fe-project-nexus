"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, CircleAlert, CircleCheck, Package, ReceiptText, RotateCcw, Truck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatVND } from "../components/formatPrice";
import { OrderPriceRows } from "../components/OrderPriceBreakdown";
import OrderStatusBadge, { ORDER_STATUS_LABELS } from "../components/OrderStatusBadge";
import ProductImage from "../components/ProductImage";
import ShipmentTracking from "../components/ShipmentTracking";
import ConfirmReceiptDialog from "../components/ConfirmReceiptDialog";
import ReceiptIssueDialog from "../components/ReceiptIssueDialog";
import OrderRating from "./OrderRating";
import OrderInvoiceButton from "./OrderInvoiceButton";
import AuctionWinnerCheckout from "./AuctionWinnerCheckout";
import { queryKeys } from "../configs/queryKeys";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { cancelOrder, confirmReceipt, getOrder, getOrderHistory, reportReceiptIssue } from "../service/orderService";
import { getOrderShipment, getShipmentTracking } from "../service/shipmentService";
import type { OrderDetail, OrderGroup, OrderStatus } from "../types/orderResponseType";
import type { ShipmentTracking as ShipmentTrackingData } from "../types/shipmentResponseType";

const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-border px-5 text-sm font-medium hover:bg-secondary disabled:opacity-50";
const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
const paidStatuses: OrderStatus[] = ["PAID", "SHIPPED", "DELIVERED", "COMPLETED"];

function OrderProgress({ status }: { status: OrderStatus }) {
  const steps: OrderStatus[] = ["PENDING", "PAID", "SHIPPED", "DELIVERED", "COMPLETED"];
  const active = steps.indexOf(status);
  if (active < 0) return null;
  return <ol aria-label="Order progress" className="mt-5 flex items-start justify-between gap-2 border-t border-border pt-5">
    {steps.map((step, index) => <li key={step} aria-current={active === index ? "step" : undefined} className={`flex min-w-0 flex-1 flex-col items-center gap-2 break-words text-center text-[10px] ${index <= active ? "text-primary" : "text-muted-foreground"}`}>
      <span className={`flex size-6 items-center justify-center rounded-full border ${index <= active ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{index < active ? <Check size={13} aria-hidden="true" /> : index + 1}</span>
      <span className="w-full min-w-0 [overflow-wrap:anywhere]">{index === 0 ? "Placed" : step === "PAID" ? "Paid" : step === "SHIPPED" ? "Shipped" : step === "DELIVERED" ? "Delivered" : "Completed"}</span>
    </li>)}
  </ol>;
}

function OrderReceipt({ order, showProgress }: { order: OrderDetail; showProgress: boolean }) {
  return <aside className="min-w-0 rounded-sm border border-border bg-card p-5 sm:p-6" aria-label="Order receipt">
    <h2 className="text-base font-semibold">Payment</h2>
    <dl className="mt-5 space-y-3 text-sm">
      <div className="flex justify-between gap-5"><dt className="text-muted-foreground">Order</dt><dd className="break-all text-right font-mono">{order.orderNumber}</dd></div>
      <div className="flex justify-between gap-5"><dt className="text-muted-foreground">Placed</dt><dd className="text-right"><time dateTime={order.createdAt}>{dateFormatter.format(new Date(order.createdAt))}</time></dd></div>
      <div className="flex justify-between gap-5"><dt className="text-muted-foreground">Items</dt><dd>{order.items.reduce((sum, item) => sum + item.quantity, 0)}</dd></div>
      <div className="flex justify-between gap-5"><dt className="text-muted-foreground">Order type</dt><dd>{order.orderType === "AUCTION" ? "Auction" : "Shop purchase"}</dd></div>
      <div className="flex justify-between gap-5"><dt className="text-muted-foreground">Status</dt><dd data-testid="order-receipt-status"><OrderStatusBadge status={order.status} /></dd></div>
    </dl>
    <dl className="mt-4 border-t border-border pt-4 text-sm">
      <div data-testid="order-receipt-total" className="flex justify-between gap-5 font-semibold"><dt>Total</dt><dd className="font-mono tabular-nums text-primary">{formatVND(order.totalAmount)}</dd></div>
      {order.breakdown && <OrderPriceRows breakdown={order.breakdown} muted />}
      {order.vouchers?.map((v) => <div key={v.code} className="mt-2 flex flex-wrap justify-between gap-2 text-xs"><dt className="break-all font-mono">{v.code}</dt><dd>−{formatVND(String(v.discountAmount))}</dd></div>)}
    </dl>
    {showProgress && <OrderProgress status={order.status} />}
  </aside>;
}

function OrderContents({ orderId, result }: { orderId: string; result: boolean }) {
  const auth = useAuth();
  const client = useQueryClient();
  const [reason, setReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [addressOpenedAt, setAddressOpenedAt] = useState<number | null>(null);
  const [reasonError, setReasonError] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const order = useApiQuery({
    queryKey: queryKeys.orders.detail(auth.sessionId, orderId), meta: { requiresAuth: true },
    service: (signal) => getOrder(orderId, { context: auth.requestContext, signal }),
  }, {
    retry: false,
    refetchInterval: (query) => !result && query.state.data?.status === "DELIVERED" ? 30_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const history = useApiQuery({
    queryKey: queryKeys.orders.history(auth.sessionId, orderId), meta: { requiresAuth: true },
    service: (signal) => getOrderHistory(orderId, { context: auth.requestContext, signal }),
  }, { enabled: !result && order.isSuccess, retry: false });
  const shipment = useApiQuery({
    queryKey: queryKeys.orders.shipment(auth.sessionId, orderId), meta: { requiresAuth: true },
    service: (signal) => {
      const cached = client.getQueryData<ShipmentTrackingData | null>(queryKeys.orders.shipment(auth.sessionId, orderId));
      const options = { context: auth.requestContext, signal };
      return cached ? getShipmentTracking(cached.shipmentId, orderId, options) : getOrderShipment(orderId, options);
    },
  }, {
    enabled: !result && order.isSuccess,
    // Read every order once; refresh only an existing, active shipment on an active order.
    refetchInterval: (query) =>
      !result && order.isSuccess && (order.data.status === "PAID" || order.data.status === "SHIPPED") &&
      query.state.status === "success" && query.state.data &&
      !["DELIVERED", "RETURNED", "CANCELLED"].includes(query.state.data.status) ? 30_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
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
  const receipt = useApiMutation<OrderDetail, { sessionId: number }>({
    mutationKey: ["orders", auth.sessionId, "confirm-receipt", orderId],
    isCurrent: (variables) => auth.isSessionCurrent(variables.sessionId),
    execute: () => confirmReceipt(orderId, { context: auth.requestContext }),
    invalidateKey: [["orders", auth.sessionId]],
  }, {
    onSuccess: (completed) => {
      client.setQueryData(queryKeys.orders.detail(auth.sessionId, orderId), completed);
      setReceiptOpen(false);
    },
    onError: async (error, variables) => {
      if (error.status === 409 && auth.isSessionCurrent(variables.sessionId))
        await client.invalidateQueries({ queryKey: ["orders", variables.sessionId], refetchType: "active" });
    },
  });
  const receiptIssue = useApiMutation<OrderDetail, { reason: string; sessionId: number }>({
    mutationKey: ["orders", auth.sessionId, "receipt-issue", orderId],
    isCurrent: (variables) => auth.isSessionCurrent(variables.sessionId),
    execute: (variables) => reportReceiptIssue(orderId, variables.reason, { context: auth.requestContext }),
    invalidateKey: [["orders", auth.sessionId]],
  }, {
    onSuccess: (held) => { client.setQueryData(queryKeys.orders.detail(auth.sessionId, orderId), held); setIssueOpen(false); },
    onError: async (error, variables) => {
      if (error.status === 409 && auth.isSessionCurrent(variables.sessionId))
        await client.invalidateQueries({ queryKey: ["orders", variables.sessionId], refetchType: "active" });
    },
  });

  useEffect(() => {
    if (!result && order.data?.status === "COMPLETED")
      void Promise.all([
        queryKeys.orders.history(auth.sessionId, orderId),
        ["orders", auth.sessionId, "list"],
        ["orders", auth.sessionId, "own"],
        ["orders", auth.sessionId, "group"],
      ].map((queryKey) => client.invalidateQueries({ queryKey, refetchType: "active" })));
  }, [auth.sessionId, client, order.data?.status, orderId, result]);

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
    {!result && <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap gap-2 text-xs text-muted-foreground"><Link href="/orders" className="hover:text-primary">Orders</Link><span aria-hidden="true">›</span><span className="font-mono [overflow-wrap:anywhere]">{current.orderNumber}</span></nav>}
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 id="order-detail-title" className="text-heading-32 [overflow-wrap:anywhere]">Order {current.orderNumber}{result && pending ? " isn’t paid yet" : ""}</h1>
      <OrderStatusBadge status={current.status} />
    </div>
    <div className={`grid min-w-0 items-start gap-6 ${result ? "lg:grid-cols-[minmax(0,1fr)_380px]" : "xl:grid-cols-[minmax(0,1fr)_280px]"}`}>
      <div className="min-w-0 space-y-6">
        {result && <p className={`flex items-center gap-2 text-sm ${paid ? "text-success" : pending ? "text-warning-foreground" : "text-muted-foreground"}`}>
          {paid ? <CircleCheck size={18} aria-hidden="true" /> : <CircleAlert size={18} aria-hidden="true" />}
          {paid ? "Payment received" : pending ? "Awaiting payment" : ORDER_STATUS_LABELS[current.status]}
        </p>}
        {result && <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{paid ? "Thank you for your purchase. Follow your order’s progress here and keep your order reference for support." : pending ? "Your order has been placed and is waiting for payment. Complete your bank transfer using the payment instructions for your order group." : "Check your order details and its latest status below."}</p>}
        {!result && current.status === "DELIVERED" && <section aria-label="Confirm order receipt" className="rounded-sm border border-border bg-card p-5 sm:p-6">
          <h2 className="text-heading-20">Your order has been delivered</h2>
          {current.receiptIssueReportedAt ? <div role="status" className="mt-3 rounded-sm border border-warning bg-warning/5 p-4 text-sm">
            <p className="font-medium">Problem reported. Order completion is paused.</p>
            <p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">{current.receiptIssueReason}</p>
            <p className="mt-2 text-xs text-muted-foreground">Reported <time dateTime={current.receiptIssueReportedAt}>{dateFormatter.format(new Date(current.receiptIssueReportedAt))}</time>. The order stays open until the issue is resolved.</p>
          </div> : <>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Check your items before confirming that you received them. Your order stays open until you confirm or the confirmation period ends.</p>
          {current.deliveredAt && <p className="mt-3 text-sm text-muted-foreground">Delivered <time dateTime={current.deliveredAt}>{dateFormatter.format(new Date(current.deliveredAt))}</time></p>}
          {current.autoCompleteAt ? <p className="mt-2 text-sm text-muted-foreground">Automatically completes on <time dateTime={current.autoCompleteAt}>{dateFormatter.format(new Date(current.autoCompleteAt))}</time> if no issue is reported.</p> : <p className="mt-2 text-sm text-muted-foreground">The automatic completion date is not available yet.</p>}
          {auth.user?.id === current.userId && <div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={receipt.isPending || receiptIssue.isPending} onClick={() => { receipt.reset(); setReceiptOpen(true); }} className="inline-flex min-h-11 items-center rounded-sm bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50">Order received</button><button type="button" disabled={receipt.isPending || receiptIssue.isPending} onClick={() => { receiptIssue.reset(); setIssueOpen(true); }} className={buttonClass}>Report a problem</button></div>}
          </>}
        </section>}
        {!result && receiptOpen && current.status === "DELIVERED" && !current.receiptIssueReportedAt && <ConfirmReceiptDialog orderNumber={current.orderNumber} pending={receipt.isPending} error={receipt.error?.detail || receipt.error?.title} onClose={() => { if (!receipt.isPending) setReceiptOpen(false); }} onConfirm={() => { if (!receipt.isPending) receipt.mutate({ sessionId: auth.sessionId }); }} />}
        {!result && issueOpen && current.status === "DELIVERED" && !current.receiptIssueReportedAt && <ReceiptIssueDialog pending={receiptIssue.isPending} error={receiptIssue.error?.detail || receiptIssue.error?.title} onClose={() => { if (!receiptIssue.isPending) setIssueOpen(false); }} onReport={(reason) => { if (!receiptIssue.isPending) receiptIssue.mutate({ reason, sessionId: auth.sessionId }); }} />}
        {!result && receiptIssue.error && current.status !== "DELIVERED" && <p role="alert" className="text-sm text-danger">{receiptIssue.error.detail || receiptIssue.error.title}</p>}
        {!result && receipt.isSuccess && <p role="status" className="text-sm text-success">Receipt confirmed. Your order is completed.</p>}
        {!result && receipt.error && (!receiptOpen || current.status !== "DELIVERED") && <p role="alert" className="text-sm text-danger">{receipt.error.detail || receipt.error.title}</p>}
        {!result && <OrderRating key={current.orderId} order={current} />}
        <div className="mt-6 flex flex-wrap gap-3">
          {current.orderGroupId && pending && !current.awaitingShippingAddress && <Link href={`/checkout/payment/${encodeURIComponent(current.orderGroupId)}`} className="inline-flex min-h-11 items-center rounded-sm bg-primary px-5 text-sm font-medium text-primary-foreground">Pay now</Link>}
          {pending && current.awaitingShippingAddress && auth.user?.id === current.userId && <button type="button" aria-expanded={addressOpenedAt !== null} onClick={() => setAddressOpenedAt(Date.now())} className="inline-flex min-h-11 items-center rounded-sm bg-primary px-5 text-sm font-medium text-primary-foreground">Confirm address and pay</button>}
          {result && <Link href={`/order/${encodeURIComponent(current.orderId)}`} className="inline-flex min-h-11 items-center rounded-sm bg-primary px-5 text-sm font-medium text-primary-foreground">View Order</Link>}
          <Link href="/" className={buttonClass}>Continue Shopping</Link>
          {!result && current.status === "COMPLETED" && auth.user?.id === current.userId && <OrderInvoiceButton orderId={current.orderId} orderNumber={current.orderNumber} />}
          {!result && current.canCancel && <button type="button" aria-expanded={cancelOpen} aria-controls="cancel-order-form" onClick={() => {
            cancellation.reset();
            setReasonError(false);
            setCancelOpen((open) => !open);
          }} className={`${buttonClass} text-danger`} disabled={cancellation.isPending}>Cancel order</button>}
        </div>
        {addressOpenedAt !== null && pending && current.awaitingShippingAddress && <div className="mt-6"><AuctionWinnerCheckout key={current.orderId} orderId={current.orderId} currency="VND" paymentDueAt={null} serverNow={addressOpenedAt} idPrefix={`order-${current.orderId}`} /></div>}
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
    {!result && (shipment.isPending ? <p role="status" className="mt-10 text-sm text-muted-foreground">Checking shipping updates…</p> : shipment.isError ? <div className="mt-10 rounded-sm border border-border p-5"><p role="alert" className="text-sm text-danger">{shipment.error.detail || "Unable to load shipping updates."}</p><button type="button" className={`${buttonClass} mt-3`} onClick={() => void shipment.refetch()}>Retry shipping updates</button></div> : shipment.data ? <ShipmentTracking shipment={shipment.data} /> : null)}
    {!result && <div className="grid min-w-0 items-start gap-6">
      <section className="rounded-sm border border-border p-5 sm:p-6" aria-label="Order history"><h2 className="flex items-center gap-2 text-base font-semibold"><Truck size={18} aria-hidden="true" />Order timeline</h2>
        {history.isPending ? <p role="status" className="mt-4 text-sm text-muted-foreground">Loading updates…</p> : history.isError ? <div className="mt-4 text-sm"><p role="alert">{history.error.detail || "Unable to load updates."}</p><button type="button" onClick={() => void history.refetch()} className={`${buttonClass} mt-3`}>Retry updates</button></div> : <ol className="mt-5 space-y-6">{history.data?.map((entry) => <li key={entry.id} className="border-l-2 border-primary pl-4"><p className="text-sm font-medium">{ORDER_STATUS_LABELS[entry.newStatus]}</p><time dateTime={entry.createdAt} className="mt-1 block text-xs text-muted-foreground">{dateFormatter.format(new Date(entry.createdAt))}</time>{entry.reason && <p className="mt-2 break-words text-xs leading-5 text-muted-foreground">{entry.reason}</p>}</li>)}</ol>}
        {history.isSuccess && !history.data.length && <p className="mt-4 text-sm text-muted-foreground">No updates yet.</p>}
      </section>
      <section className="min-w-0 rounded-sm border border-border p-5 sm:p-6" aria-label="Order items">
        <h2 className="flex items-center gap-2 text-heading-20"><Package size={20} aria-hidden="true" />Your items</h2>
        <ul className="mt-5 divide-y divide-border">{current.items.map((item) => <li key={item.orderItemId} className="flex min-w-0 gap-4 py-5 first:pt-0">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted"><ProductImage src={item.imageUrl ?? undefined} alt={item.productName} productName={item.productName} /></div>
          <div className="min-w-0 flex-1"><Link href={`/products/${encodeURIComponent(item.productId)}`} className="text-sm font-medium hover:text-primary [overflow-wrap:anywhere]">{item.productName}</Link>{item.skuCode && <p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">{item.skuCode}</p>}<p className="mt-2 text-xs text-muted-foreground">Qty {item.quantity} · {formatVND(item.unitPrice)} each</p><p className="mt-2 font-mono text-sm font-semibold text-primary [overflow-wrap:anywhere]">{formatVND(item.totalPrice)}</p></div>
        </li>)}</ul>
      </section>
    </div>}
      </div>
      <OrderReceipt order={current} showProgress={result} />
    </div>
    <Link href="/orders" className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm hover:text-primary"><ArrowLeft size={16} aria-hidden="true" />All orders</Link>
  </>;
}

function OrderDetailPage({ orderId, result = false }: { orderId: string; result?: boolean }) {
  const auth = useAuth();
  const returnTo = result ? `/checkout/result/${orderId}` : `/order/${orderId}`;
  return <section className={result ? "mx-auto w-full max-w-[1248px] px-4 py-10 sm:px-6 lg:py-14" : "min-w-0 pb-8"} aria-labelledby="order-detail-title">
    {auth.status === "authenticated" ? <OrderContents key={`${auth.sessionId}:${orderId}`} orderId={orderId} result={result} /> : auth.status === "anonymous" ? <div className="rounded-sm border border-border p-8"><ReceiptText size={30} className="text-primary" aria-hidden="true" /><h1 id="order-detail-title" className="mt-4 text-heading-24">Sign in to view your order</h1><Link href={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`} className={`${buttonClass} mt-5`}>Sign in</Link></div> : auth.status === "error" ? <div className="rounded-sm border border-border p-6"><p role="alert">{auth.error?.detail || "Unable to load your account."}</p><button type="button" onClick={() => void auth.retryProfile()} className={`${buttonClass} mt-4`}>Retry account</button></div> : <p role="status" className="py-12 text-muted-foreground">Loading your account…</p>}
  </section>;
}

export default OrderDetailPage;
