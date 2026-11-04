"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReceiptText } from "lucide-react";
import OrderStatusBadge, { ORDER_STATUS_LABELS } from "../components/OrderStatusBadge";
import { Pagination } from "../components/Pagination";
import { formatVND } from "../components/formatPrice";
import { ORDER_STATUSES, isOrderStatus } from "../service/orderService";
import { useOrders } from "./useOrders";
import type { OrderSummary } from "../types/orderResponseType";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Ho_Chi_Minh",
});
const actionStyle = "inline-flex min-h-11 items-center justify-center rounded-sm bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover";

function OrderRow({ order }: { order: OrderSummary }) {
  return (
    <tr data-testid={`order-row-${order.orderId}`} className="grid grid-cols-2 gap-4 border-t border-border p-4 first:border-t-0 xl:table-row xl:first:border-t xl:p-0">
      <th scope="row" className="col-span-2 min-w-0 text-left font-normal xl:w-[28%] xl:px-4 xl:py-6">
        <span className="mb-1 block text-xs text-muted-foreground xl:hidden">Order</span>
        <span className="font-mono text-sm [overflow-wrap:anywhere]">{order.orderNumber}</span>
      </th>
      <td className="min-w-0 text-sm xl:w-[22%] xl:px-4 xl:py-6">
        <span className="mb-1 block text-xs text-muted-foreground xl:hidden">Date</span>
        <time dateTime={order.createdAt}>{dateFormatter.format(new Date(order.createdAt))}</time>
      </td>
      <td className="min-w-0 text-sm font-medium xl:w-[22%] xl:px-4 xl:py-6">
        <span className="mb-1 block text-xs font-normal text-muted-foreground xl:hidden">Total</span>
        <span className="tabular-nums [overflow-wrap:anywhere]">{formatVND(order.totalAmount)}</span>
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

function OrdersPage() {
  const { auth, orders, status, page, hrefFor, href } = useOrders();
  const router = useRouter();
  const signInHref = `/sign-in?returnTo=${encodeURIComponent(href)}`;
  const forbidden = orders.error?.code === "FORBIDDEN" || orders.error?.code === "COMMERCE_FORBIDDEN";
  const expired = orders.error?.code === "UNAUTHENTICATED" || orders.error?.code === "COMMERCE_UNAUTHENTICATED" || orders.error?.status === 401;
  const data = orders.data;
  return (
    <section className="mx-auto grid w-full max-w-[1248px] gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[224px_minmax(0,1fr)] lg:gap-12 lg:py-9" aria-labelledby="orders-title">
      <aside className="min-w-0">
        {auth.user && (
          <div className="mb-4 flex min-w-0 items-center gap-3 lg:mb-6">
            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-sm">
              {auth.user.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("")}
            </span>
            <span className="min-w-0 text-sm font-medium [overflow-wrap:anywhere]">{auth.user.fullName}</span>
          </div>
        )}
        <nav aria-label="Account">
          <Link href="/orders" aria-current="page" className="inline-flex min-h-11 items-center gap-3 text-sm font-medium text-primary">
            <ReceiptText size={18} aria-hidden="true" />Orders
          </Link>
        </nav>
      </aside>
      <div className="min-w-0">
        <h1 id="orders-title" className="text-heading-32">Orders</h1>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <label htmlFor="order-status" className="text-sm font-medium">Order status</label>
          <select id="order-status" value={status ?? ""} onChange={(event) => router.push(hrefFor(isOrderStatus(event.target.value) ? event.target.value : undefined))} className="min-h-11 max-w-full rounded-sm border border-border bg-background px-3 text-sm">
            <option value="">All</option>
            {ORDER_STATUSES.map((value) => <option key={value} value={value}>{ORDER_STATUS_LABELS[value]}</option>)}
          </select>
        </div>
        {auth.status === "authenticating" ? (
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
