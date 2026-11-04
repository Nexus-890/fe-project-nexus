"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { formatVND } from "../components/formatPrice";
import { queryKeys } from "../configs/queryKeys";
import { useAuth } from "../hooks/useAuth";
import type { CheckoutOrderGroup } from "../types/checkoutType";

/** Group handoff for #151; QR initiation and payment polling belong to #152. */
function CheckoutPaymentPage({ orderGroupId }: { orderGroupId: string }) {
  const { status, sessionId, error, retryProfile } = useAuth();
  const client = useQueryClient();
  const router = useRouter();
  const group = status === "authenticated"
    ? client.getQueryData<CheckoutOrderGroup>(queryKeys.checkout.group(sessionId, orderGroupId))
    : undefined;
  useEffect(() => {
    if (status === "anonymous") router.replace(`/sign-in?returnTo=${encodeURIComponent(`/checkout/payment/${orderGroupId}`)}`);
    if (status === "authenticated") void client.invalidateQueries({ queryKey: queryKeys.cart.me(sessionId), exact: true });
  }, [status, sessionId, client, router, orderGroupId]);

  return (
    <section className="mx-auto w-full max-w-2xl space-y-5 px-4 py-8 sm:px-6" aria-labelledby="payment-page-title">
      <h1 id="payment-page-title" className="text-heading-32">Payment</h1>
      {status === "authenticated" ? <>
        <p>{group ? "Your order has been placed. All shops are included in one payment group." : "Keep your order group reference for payment."}</p>
        <dl className="space-y-4 rounded-sm border border-border bg-card p-5 text-sm [overflow-wrap:anywhere]">
          <div><dt className="text-muted-foreground">Order group reference</dt><dd className="mt-1 font-mono" data-testid="payment-order-group-id">{orderGroupId}</dd></div>
          {group && <>
            <div><dt className="text-muted-foreground">Orders</dt><dd>{group.orders.length}</dd></div>
            <div><dt className="text-muted-foreground">Group total</dt><dd className="font-mono tabular-nums">{formatVND(group.totalAmount)}</dd></div>
          </>}
        </dl>
        <p role="status" className="text-sm text-muted-foreground">QR payment is not available on this page yet. Save the reference above to continue payment when it becomes available.</p>
        <Link href="/cart" className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline">Back to cart</Link>
      </> : status === "error" ? <>
        <p role="alert">{error?.detail || "Unable to load your account."}</p>
        <button type="button" className="min-h-11 rounded-sm border border-border px-4" onClick={() => void retryProfile()}>Retry account</button>
      </> : <p role="status">Loading your account…</p>}
    </section>
  );
}

export default CheckoutPaymentPage;
