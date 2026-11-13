"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ReceiptText } from "lucide-react";
import OrderStatusBadge, { ORDER_STATUS_LABELS } from "../components/OrderStatusBadge";
import { Pagination } from "../components/Pagination";
import { OrderTotalPill } from "../components/OrderPriceBreakdown";
import { ORDER_STATUSES, isOrderStatus } from "../service/orderService";
import { useOrders } from "./useOrders";
import type { OrderSummary } from "../types/orderResponseType";
import type { OrderGroup } from "../types/orderResponseType";
import { queryKeys } from "../configs/queryKeys";
import { getPaymentOutcome } from "./paymentStatusUtils";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Ho_Chi_Minh",
});
const actionStyle = "inline-flex min-h-11 items-center justify-center rounded-sm bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover";

function OrderRow({ order }: { order: OrderSummary }) {
  return (
    <tr data-testid={`order-row-${order.orderId}`} className="grid grid-cols-2 gap-4 border-t border-border p-4 first:border-t-0 xl:table-row xl:first:border-t xl:p-0">
      <th scope="row" className="col-span-2 min-w-0 text-left font-normal xl:w-[28%] xl:px-4 xl:py-6">
        <span className="mb-1 block text-xs text-muted-foreground xl:hidden">Order</span>
        <Link href={`/order/${encodeURIComponent(order.orderId)}`} className="font-mono text-sm hover:text-primary hover:underline [overflow-wrap:anywhere]">{order.orderNumber}</Link>
      </th>
      <td className="col-span-2 min-w-0 text-sm sm:col-span-1 xl:w-[22%] xl:px-4 xl:py-6">
        <span className="mb-1 block text-xs text-muted-foreground xl:hidden">Date</span>
        <time dateTime={order.createdAt}>{dateFormatter.format(new Date(order.createdAt))}</time>
      </td>
      <td className="col-span-2 min-w-0 text-sm sm:col-span-1 font-medium xl:w-[22%] xl:px-4 xl:py-6">
        <span className="mb-1 block text-xs font-normal text-muted-foreground xl:hidden">Total</span>
        <OrderTotalPill total={order.totalAmount} breakdown={order.breakdown} testId={`order-total-${order.orderId}`} />
      </td>
      <td className="col-span-2 min-w-0 xl:px-4 xl:py-6">
        <span className="mb-1 block text-xs text-muted-foreground xl:hidden">Status</span>
        <OrderStatusBadge status={order.status} />
      </td>
      <td className="col-span-2 min-w-0 xl:px-4 xl:py-4 xl:text-right">
        {order.status === "PENDING" && (order.orderGroupId ? (
          <Link href={`/checkout/payment/${encodeURIComponent(order.orderGroupId)}`} prefetch={false} className={`${actionStyle} w-full xl:w-auto xl:whitespace-nowrap`}>
            Pay Now
          </Link>
        ) : (
          <div className="space-y-1 text-left">
            <button type="button" disabled className={`${actionStyle} w-full opacity-50 xl:w-auto`}>Pay Now</button>
            <p className="text-xs text-muted-foreground">Payment link unavailable.</p>
          </div>
        ))}
      </td>
    </tr>
  );
}

function OrdersPage({ confirmedGroupId }: { confirmedGroupId?: string }) {
  const { auth, orders, status, page, hrefFor, href } = useOrders();
  const router = useRouter();
  const queryClient = useQueryClient();
  // URL flags are not evidence: only the current session's verified poll can confirm payment.
  const confirmed = auth.status === "authenticated" && confirmedGroupId &&
    getPaymentOutcome(queryClient.getQueryData<OrderGroup>(queryKeys.orders.group(auth.sessionId, confirmedGroupId))) === "paid";
  const signInHref = `/sign-in?returnTo=${encodeURIComponent(href)}`;
  const forbidden = orders.error?.code === "FORBIDDEN" || orders.error?.code === "COMMERCE_FORBIDDEN";
  const expired = orders.error?.code === "UNAUTHENTICATED" || orders.error?.code === "COMMERCE_UNAUTHENTICATED" || orders.error?.status === 401;
  const data = orders.data;
  return (
    <section className="min-w-0 pb-8" aria-labelledby="orders-title">
      <div className="min-w-0">
        <h1 id="orders-title" className="text-heading-32">Orders</h1>
        {confirmed && <div role="status" className="mt-6 rounded-sm border border-border bg-success/5 p-4 text-success">Payment confirmed. All orders in your group have been paid.</div>}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <label htmlFor="order-status" className="text-sm font-medium">Order status</label>
          <select id="order-status" value={status ?? ""} onChange={(event) => router.push(hrefFor(isOrderStatus(event.target.value) ? event.target.value : undefined))} className="min-h-11 max-w-full rounded-sm border border-border bg-background px-3 text-sm">
            <option value="">All</option>
            {ORDER_STATUSES.map((value) => <option key={value} value={value}>{ORDER_STATUS_LABELS[value]}</option>)}
          </select>
        </div>
        {auth.status === "restoring" || auth.status === "authenticating" ? (
          <p role="status" className="py-12 text-muted-foreground">Loading your account…</p>
        ) : auth.status === "error" ? (
          <div className="py-8">
            <p role="alert" className="break-words">{auth.error?.detail || "Unable to load your account."}</p>
            <button type="button" onClick={() => void auth.retryProfile()} className="mt-4 min-h-11 rounded-sm border border-border px-4 text-sm">Retry account</button>
          </div>
        ) : auth.status !== "authenticated" ? (
          <div className="py-12 text-center">
            <h2 className="text-heading-20">Sign in to view your orders</h2>
            <Link href={signInHref} className={`${actionStyle} mt-6`}>Sign in</Link>
          </div>
        ) : orders.isPending ? (
          <p role="status" className="py-12 text-muted-foreground">Loading your orders…</p>
        ) : orders.isError ? (
          <div className="py-8">
            <h2 className="text-heading-20">{forbidden ? "You cannot view these orders" : "Unable to load your orders"}</h2>
            <p role="alert" className="mt-2 text-sm [overflow-wrap:anywhere]">{orders.error.detail || orders.error.title}</p>
            {expired ? <Link href={signInHref} className={`${actionStyle} mt-4`}>Sign in</Link> : !forbidden && (
              <button type="button" onClick={() => void orders.refetch()} className="mt-4 min-h-11 rounded-sm border border-border px-4 text-sm">Retry orders</button>
            )}
          </div>
        ) : data && (
          <>
            {data.content.length === 0 ? (
              <div role="status" className="py-12 text-center">
                <ReceiptText size={36} aria-hidden="true" className="mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-heading-20">No orders found</h2>
                <p className="mt-2 text-sm text-muted-foreground">{status ? "There are no orders with this status." : "Your orders will appear here after a purchase."}</p>
              </div>
            ) : (
              <table className="mt-6 block w-full rounded-sm border border-border text-left xl:table xl:table-fixed">
                <caption className="sr-only">Your orders</caption>
                <thead className="hidden bg-muted text-xs font-normal text-muted-foreground xl:table-header-group">
                  <tr><th scope="col" className="w-[28%] px-4 py-3 font-normal">Order</th><th scope="col" className="w-[22%] px-4 py-3 font-normal">Date</th><th scope="col" className="w-[22%] px-4 py-3 font-normal">Total</th><th scope="col" className="px-4 py-3 font-normal">Status</th><th scope="col" className="w-32 px-4 py-3"><span className="sr-only">Payment</span></th></tr>
                </thead>
                <tbody className="block xl:table-row-group">{data.content.map((order) => <OrderRow key={order.orderId} order={order} />)}</tbody>
              </table>
            )}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">{data.content.length ? `Showing ${data.page * data.size + 1}–${data.page * data.size + data.content.length} of ${data.totalElements} orders` : `${data.totalElements} orders`}</p>
              <Pagination ariaLabel="Order pagination" page={page} totalPages={data.totalPages} hrefForPage={(value) => hrefFor(status, value)} />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export default OrdersPage;
