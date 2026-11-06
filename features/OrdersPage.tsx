"use client";

import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatVND } from "../components/formatPrice";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { listOwnOrders } from "../service/orderService";
import type { OrderGroup } from "../types/orderResponseType";
import { getPaymentOutcome } from "./paymentStatusUtils";

const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-sm border border-border px-4 text-sm font-medium hover:bg-secondary disabled:opacity-50";

function OrdersPage({ confirmedGroupId }: { confirmedGroupId?: string }) {
  const { status, sessionId, error, retryProfile } = useAuth();
  return <section className="mx-auto w-full max-w-[1248px] px-4 py-8 sm:px-6" aria-labelledby="orders-title">
    <h1 id="orders-title" className="text-heading-32">Your orders</h1>
    {status === "authenticated" ? <OrderList key={sessionId} confirmedGroupId={confirmedGroupId} />
      : status === "authenticating" ? <p role="status" className="mt-6">Loading your account…</p>
        : status === "error" ? <div className="mt-6"><p role="alert">{error?.detail || "Unable to load your account."}</p><button type="button" className={`${buttonClass} mt-4`} onClick={() => void retryProfile()}>Retry account</button></div>
          : <Link href="/sign-in?returnTo=%2Forders" className={`${buttonClass} mt-6`}>Sign in to view orders</Link>}
  </section>;
}

function OrderList({ confirmedGroupId }: { confirmedGroupId?: string }) {
  const { requestContext, sessionId } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const orders = useApiQuery({
    queryKey: queryKeys.orders.own(sessionId, page),
    service: (signal) => listOwnOrders({ page, size: 10 }, { context: requestContext, signal }),
    meta: { requiresAuth: true },
  }, { refetchOnMount: "always" });
  // A query string alone is not payment evidence. Only this session's verified
  // terminal poll can produce the confirmation after client-side navigation.
  const confirmed = confirmedGroupId && getPaymentOutcome(queryClient.getQueryData<OrderGroup>(queryKeys.orders.group(sessionId, confirmedGroupId))) === "paid";
  return <>
    {confirmed && <div role="status" className="mt-6 rounded-sm border border-border bg-success/5 p-4 text-success">Payment confirmed. All orders in your group have been paid.</div>}
    {orders.isPending ? <p role="status" className="mt-6">Loading your orders…</p>
      : orders.isError ? <div className="mt-6"><p role="alert">{orders.error.detail || orders.error.title}</p><button type="button" className={`${buttonClass} mt-4`} onClick={() => void orders.refetch()}>Retry orders</button></div>
        : !orders.data.content.length ? <p className="mt-6 text-muted-foreground">No orders found.</p>
          : <ul className="mt-6 space-y-4">{orders.data.content.map((order) => <li key={order.orderId} className="flex flex-wrap items-center justify-between gap-4 rounded-sm border border-border bg-card p-5">
            <div><h2 className="font-medium">{order.orderNumber}</h2><p className="mt-1 text-sm text-muted-foreground">{new Date(order.createdAt).toLocaleDateString("en-GB")}</p></div>
            <div className="text-right"><p className="font-mono">{formatVND(order.totalAmount)}</p><p className="mt-1 text-sm">{order.status}</p></div>
          </li>)}</ul>}
    {orders.data && orders.data.totalPages > 1 && <nav aria-label="Order pages" className="mt-6 flex items-center gap-4">
      <button type="button" className={buttonClass} disabled={page === 0 || orders.isFetching} onClick={() => setPage((value) => value - 1)}>Previous</button>
      <span className="text-sm">Page {page + 1} of {orders.data.totalPages}</span>
      <button type="button" className={buttonClass} disabled={page + 1 >= orders.data.totalPages || orders.isFetching} onClick={() => setPage((value) => value + 1)}>Next</button>
    </nav>}
  </>;
}

export default OrdersPage;
