"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronRight, CircleAlert, Landmark, LoaderCircle, QrCode, RefreshCw, ShieldCheck } from "lucide-react";
import CopyableField from "../components/CopyableField";
import CountdownTimer from "../components/CountdownTimer";
import { formatVND } from "../components/formatPrice";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { initiatePayment } from "../service/paymentService";
import type { PaymentInstructions } from "../types/paymentResponseType";
import type { ApiError } from "../types/commonResponseType";
import { usePaymentStatus } from "./usePaymentStatus";

const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-border px-4 text-sm font-medium hover:bg-secondary disabled:cursor-wait disabled:opacity-50";

function CheckoutPaymentPage({ orderGroupId }: { orderGroupId: string }) {
  const { status, sessionId, error, retryProfile } = useAuth();

  return (
    <section className="mx-auto w-full max-w-[1248px] px-4 py-6 sm:px-6 lg:py-8" aria-labelledby="payment-title">
      <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-primary">Home</Link><ChevronRight size={12} aria-hidden="true" />
        <Link href="/cart" className="hover:text-primary">Cart</Link><ChevronRight size={12} aria-hidden="true" />
        <span aria-current="page" className="text-foreground">Payment</span>
      </nav>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 lg:mb-8">
        <div>
          <h1 id="payment-title" className="text-heading-32">Payment</h1>
          <p className="mt-2 text-sm text-muted-foreground">One transfer. All your shops.</p>
        </div>
        <ol aria-label="Checkout progress" className="hidden items-center gap-3 text-sm sm:flex">
          <li className="flex items-center gap-2 text-muted-foreground"><Check size={16} className="text-success" aria-hidden="true" />Order placed</li>
          <li aria-hidden="true"><ArrowRight size={14} className="text-muted-foreground" /></li>
          <li aria-current="step" className="flex items-center gap-2 font-medium text-primary"><span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs">2</span>Payment</li>
        </ol>
      </div>
      {status === "authenticated" ? <PaymentContents key={`${sessionId}:${orderGroupId}`} orderGroupId={orderGroupId} />
        : status === "restoring" || status === "authenticating" ? <p role="status" className="py-12 text-muted-foreground">Loading your account…</p>
          : status === "error" ? <div className="rounded-sm border border-border p-6"><p role="alert">{error?.detail || "Unable to load your account."}</p><button type="button" className={`${buttonClass} mt-4`} onClick={() => void retryProfile()}>Retry account</button></div>
            : <div className="rounded-sm border border-border p-6 sm:p-8">
              <h2 className="text-heading-20">Sign in to continue payment</h2>
              <p className="mt-2 text-sm text-muted-foreground">Use the account you placed this order with.</p>
              <Link href={`/sign-in?returnTo=${encodeURIComponent(`/checkout/payment/${orderGroupId}`)}`} className="mt-5 inline-flex min-h-11 items-center rounded-sm bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90">Sign in</Link>
            </div>}
    </section>
  );
}

function PaymentContents({ orderGroupId }: { orderGroupId: string }) {
  const { requestContext, sessionId } = useAuth();
  const router = useRouter();
  // Initiation is idempotent for this group. Only mount and explicit refresh call
  // POST; window focus/reconnect must not silently restart payment requests.
  const payment = useApiQuery({
    queryKey: queryKeys.payment.group(sessionId, orderGroupId),
    service: (signal) => initiatePayment({ orderGroupId }, { context: requestContext, signal }),
    meta: { requiresAuth: true },
  }, { retry: false, retryOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false, refetchOnMount: "always", gcTime: 0 });
  const paymentStatus = usePaymentStatus(orderGroupId, payment.data);

  useEffect(() => {
    if (paymentStatus.outcome === "paid")
      router.replace(`/orders?payment=confirmed&groupId=${encodeURIComponent(orderGroupId)}`);
  }, [orderGroupId, paymentStatus.outcome, router]);

  if (paymentStatus.outcome === "paid") return <p role="status" className="rounded-sm border border-border p-8 text-success">Payment confirmed. Opening your orders…</p>;
  if (paymentStatus.outcome === "canceled") return <div className="rounded-sm border border-border p-6 sm:p-8">
    <CircleAlert size={28} className="mb-4 text-muted-foreground" aria-hidden="true" />
    <h2 className="text-heading-20">Payment canceled</h2>
    <p role="status" className="mt-2 text-sm text-muted-foreground">All orders in this group were canceled. Please don’t transfer using the previous instructions.</p>
    <Link href="/orders" className={`${buttonClass} mt-5`}>View your orders</Link>
  </div>;

  if (!payment.data && payment.isPending) return <div role="status" className="flex items-center gap-3 rounded-sm border border-border p-8 text-sm text-muted-foreground"><LoaderCircle size={20} className="animate-spin" aria-hidden="true" />Preparing your payment…</div>;
  if (!payment.data || payment.isError) return <PaymentError error={payment.error} pending={payment.isFetching} onRetry={() => void payment.refetch()} />;

  return <>
    {paymentStatus.error && <div role="alert" className="mb-5 rounded-sm border border-border p-4 text-sm">
      <p>{paymentStatus.error.code === "COMMERCE_ORDER_GROUP_NOT_FOUND" ? "Order group unavailable" : paymentStatus.error.status === 401 || paymentStatus.error.status === 403 ? "Payment status access required" : "Unable to check payment status"}</p>
      <p className="mt-1 text-muted-foreground">{paymentStatus.error.detail || paymentStatus.error.title}</p>
      {paymentStatus.error.errors?.length ? <ul className="mt-2 list-inside list-disc">{paymentStatus.error.errors.map((field, index) => <li key={`${field.field}:${index}`}>{field.detail}</li>)}</ul> : null}
    </div>}
    <PaymentDetails key={payment.data.receivedAt} payment={payment.data} seconds={paymentStatus.seconds} orderGroupId={orderGroupId} refreshing={payment.isFetching} onRefresh={() => void payment.refetch()} />
  </>;
}

function PaymentError({ error, pending, onRetry }: { error: ApiError | null; pending: boolean; onRetry: () => void }) {
  const unavailable = error?.code === "PAYMENT_SESSION_NOT_PAYABLE";
  const forbidden = error?.status === 401 || error?.status === 403;
  return <div className="rounded-sm border border-border p-6 sm:p-8">
    <CircleAlert size={28} className="mb-4 text-primary" aria-hidden="true" />
    <h2 className="text-heading-20">{unavailable ? "Payment unavailable" : forbidden ? "Payment access required" : "Unable to prepare payment"}</h2>
    <p role="alert" className="mt-2 break-words text-sm text-muted-foreground">{error?.detail || error?.title || "Please try again in a moment."}</p>
    {error?.errors?.length ? <ul className="mt-3 list-inside list-disc text-sm text-danger">{error.errors.map((field, index) => <li key={`${field.field}:${index}`}>{field.detail}</li>)}</ul> : null}
    {!unavailable && !forbidden && <button type="button" onClick={onRetry} disabled={pending} className={`${buttonClass} mt-5`}>{pending ? "Preparing…" : "Retry payment"}</button>}
    <Link href="/cart" className="mt-5 flex min-h-11 items-center gap-2 text-sm font-medium text-primary"><ArrowLeft size={16} aria-hidden="true" />Back to cart</Link>
  </div>;
}

function PaymentDetails({ payment, seconds, orderGroupId, refreshing, onRefresh }: { payment: PaymentInstructions; seconds: number; orderGroupId: string; refreshing: boolean; onRefresh: () => void }) {
  const [qrFailed, setQrFailed] = useState(false);
  const expired = seconds === 0;

  return <>
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8">
      <div className="min-w-0 rounded-sm border border-border bg-card p-4 sm:p-6 lg:p-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-heading-20"><QrCode size={20} className="text-primary" aria-hidden="true" />Scan to pay</h2>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">VietQR</span>
        </div>
        {expired ? <div role="status" className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
          <CircleAlert size={40} className="text-muted-foreground" aria-hidden="true" />
          <h3 className="mt-4 text-heading-24">Payment expired</h3>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">The payment window has ended. Please don’t transfer using these instructions.</p>
        </div> : qrFailed ? <div role="alert" className="flex min-h-64 flex-col items-center justify-center gap-3 text-center"><QrCode size={40} className="text-muted-foreground" aria-hidden="true" /><p className="text-sm">Couldn’t load the QR code.</p><p className="max-w-xs text-xs text-muted-foreground">Use the transfer details or refresh to try again.</p></div> : <div className="mx-auto w-full max-w-64 rounded-sm border border-border bg-white p-3">
          {/* Render the provider QR directly: optimization/re-encoding can damage its modules. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={payment.qrImageUrl} alt="Payment QR code" width={256} height={256} onError={() => setQrFailed(true)} className="aspect-square h-auto w-full object-contain" />
        </div>}
        <p className="my-5 text-center text-sm text-muted-foreground">{expired ? "Refresh to check the latest payment availability." : "Open your banking app and scan this code."}</p>
        <CountdownTimer seconds={seconds} />
        <p role="status" className="mt-4 text-center text-xs text-muted-foreground">{expired ? "This QR code is no longer available." : "Awaiting your bank transfer"}</p>
      </div>
      <div className="min-w-0 rounded-sm border border-border bg-card p-5 sm:p-6 lg:p-8">
        <div className="flex items-center gap-2"><Landmark size={20} className="text-primary" aria-hidden="true" /><h2 className="text-heading-20">Bank transfer details</h2></div>
        <p className="mt-2 text-sm text-muted-foreground">Pay the full order group in one transfer.</p>
        <dl className="mt-3 divide-y divide-border">
          <CopyableField label="Amount" value={formatVND(payment.amount) ?? payment.amount} copyValue={payment.amount} disabled={expired} prominent />
          <CopyableField label="Bank account" value={payment.bankAccount} disabled={expired} />
          <CopyableField label="Transfer memo" value={payment.transferContent} disabled={expired} />
        </dl>
        <div className="mt-3 flex items-start gap-3 rounded-sm bg-primary/5 p-4 text-sm">
          <CircleAlert size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
          <p>Copy the exact amount and transfer memo so your payment can be matched to your order.</p>
        </div>
        <dl className="mt-5 space-y-3 text-xs">
          <div><dt className="text-muted-foreground">Payment reference</dt><dd className="mt-1 select-text font-mono [overflow-wrap:anywhere]">{payment.memoCode}</dd></div>
          <div><dt className="text-muted-foreground">Order group reference</dt><dd data-testid="payment-order-group-id" className="mt-1 select-text font-mono [overflow-wrap:anywhere]">{orderGroupId}</dd></div>
        </dl>
        <button type="button" onClick={onRefresh} disabled={refreshing} className={`${buttonClass} mt-5 w-full`}><RefreshCw size={16} className={refreshing ? "animate-spin" : ""} aria-hidden="true" />{refreshing ? "Refreshing payment…" : "Refresh payment"}</button>
        <p className="mt-2 text-center text-xs text-muted-foreground">Refresh keeps the same payment reference.</p>
      </div>
    </div>
    <div className="mt-8 grid gap-6 rounded-sm bg-muted p-5 sm:grid-cols-3 sm:p-6">
      {[{ title: "Open your banking app", detail: "Scan the QR code or enter the bank account manually." }, { title: "Check your transfer", detail: "Keep the amount and memo exactly as shown above." }, { title: "Complete in time", detail: "Send your transfer before the countdown ends." }].map((step, index) => <div key={step.title} className="flex items-start gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-card font-mono text-xs">{index + 1}</span><div><h3 className="text-sm font-medium">{step.title}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{step.detail}</p></div></div>)}
    </div>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <Link href="/cart" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium hover:text-primary"><ArrowLeft size={16} aria-hidden="true" />Back to cart</Link>
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck size={16} aria-hidden="true" />Pay directly through your banking app</p>
    </div>
  </>;
}

export default CheckoutPaymentPage;
