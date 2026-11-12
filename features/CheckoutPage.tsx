"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, LockKeyhole, QrCode, Truck } from "lucide-react";
import AddressForm from "../components/AddressForm";
import CheckoutSummary from "./CheckoutSummary";
import CheckoutOrderFeedback from "./CheckoutOrderFeedback";
import { formatVND } from "../components/formatPrice";
import { createCanceledError, createInvalidResponseError } from "../configs/api";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getCheckoutPreview, getProvinces, getWards } from "../service/checkoutService";
import type { CheckoutAddress } from "../types/checkoutType";
import type { CartItem } from "../types/cartResponseType";
import type { UserResponse } from "../types/authResponseType";
import { getCheckoutDestination, getCheckoutFieldErrors, previewMatchesCart, validateCheckoutAddress } from "./checkoutSchema";
import { useCart } from "./useCart";
import { useCheckout } from "./useCheckout";

const retryClass = "mt-4 min-h-11 min-w-11 rounded-sm border border-border px-4 text-sm font-medium hover:bg-secondary";

function CheckoutPage() {
  const router = useRouter();
  const { status, user, sessionId, error, retryProfile } = useAuth();
  useEffect(() => {
    if (status === "anonymous") router.replace("/sign-in?returnTo=%2Fcheckout");
  }, [status, router]);

  return (
    <section className="mx-auto w-full max-w-[1248px] px-4 py-8 sm:px-6 lg:py-9" aria-labelledby="checkout-title">
      <h1 id="checkout-title" className="text-heading-32">Checkout</h1>
      {status === "authenticated" && user ? <CheckoutCart key={sessionId} user={user} /> : status === "error" ? (
        <div className="mt-6 rounded-sm border border-border p-6">
          <p role="alert">{error?.detail || "Unable to load your account. Please try again."}</p>
          <button type="button" onClick={() => void retryProfile()} className={retryClass}>Retry account</button>
        </div>
      ) : <p role="status" className="py-12 text-muted-foreground">{status === "anonymous" ? "Opening sign in…" : "Loading your account…"}</p>}
    </section>
  );
}

function CheckoutCart({ user }: { user: UserResponse }) {
  const router = useRouter();
  const { cart, pending } = useCart();
  // A committed order consumes the active cart, even if its POST response was
  // lost. A reconnect/refetch must not discard the key needed to recover it.
  const [attemptItems, setAttemptItems] = useState<CartItem[] | null>(null);
  const empty = !attemptItems && cart.isSuccess && !cart.isFetching && cart.data.items.length === 0;
  useEffect(() => {
    if (empty && !pending) router.replace("/cart");
  }, [empty, pending, router]);

  if (cart.isError && !attemptItems) return (
    <div className="mt-6 rounded-sm border border-border p-6">
      <p role="alert">{cart.error.detail || "Unable to load your cart. Please try again."}</p>
      <button type="button" onClick={() => void cart.refetch()} className={retryClass}>Retry cart</button>
    </div>
  );
  if ((!cart.data || empty || pending) && !attemptItems) return <p role="status" className="py-12 text-muted-foreground">{empty ? "Opening your cart…" : "Loading your cart…"}</p>;
  const items = cart.data?.items.length ? cart.data.items : attemptItems ?? [];
  return <CheckoutContents user={user} items={items} onAttemptStart={() => setAttemptItems(items)} />;
}

function CheckoutContents({ user, items, onAttemptStart }: { user: UserResponse; items: CartItem[]; onAttemptStart: () => void }) {
  const { requestContext, sessionId, isSessionCurrent } = useAuth();
  const [values, setValues] = useState<CheckoutAddress>(() => ({
    recipientName: user.fullName, phoneNumber: user.phone, addressLine: user.address ?? "",
    provinceCode: "", wardCode: "",
  }));
  const [submitted, setSubmitted] = useState(false);
  const [reviewedAddress, setReviewedAddress] = useState<string | null>(null);
  const meta = { requiresAuth: true };
  const provinces = useApiQuery({
    queryKey: queryKeys.checkout.provinces(sessionId), meta,
    service: (signal) => getProvinces({ context: requestContext, signal }),
  }, { retry: false });
  const wards = useApiQuery({
    queryKey: queryKeys.checkout.wards(sessionId, values.provinceCode), meta,
    service: (signal) => getWards(values.provinceCode, { context: requestContext, signal }),
  }, { enabled: Boolean(values.provinceCode), retry: false });

  const destination = getCheckoutDestination(values,
    provinces.isError ? [] : provinces.data ?? [],
    wards.isError ? [] : wards.data ?? []);
  const cartSignature = JSON.stringify(items);
  const preview = useApiQuery({
    queryKey: queryKeys.checkout.preview(sessionId, cartSignature, destination), meta,
    service: async (signal) => {
      if (!destination || !isSessionCurrent(sessionId)) throw createCanceledError();
      const quote = await getCheckoutPreview(destination, { context: requestContext, signal });
      if (!isSessionCurrent(sessionId)) throw createCanceledError();
      if (!previewMatchesCart(quote, items))
        throw createInvalidResponseError("Your cart has changed. Return to your cart and review the items before continuing.");
      return quote;
    },
  }, {
    enabled: Boolean(destination) && !provinces.isError && !wards.isError,
    retry: false, staleTime: 0, gcTime: 0,
  });
  const quote = destination && !preview.isFetching && !preview.isError ? preview.data : undefined;
  const addressReady = destination !== null;
  const canContinue = Boolean(quote && quote.shippingFee !== null && !quote.issues.length);
  const ready = reviewedAddress === JSON.stringify(destination) && addressReady;
  const order = useCheckout(destination, ready && canContinue, onAttemptStart);
  const serverErrors = {
    ...getCheckoutFieldErrors(destination ? preview.error : null),
    ...getCheckoutFieldErrors(order.error),
  };
  const errors = { ...(submitted ? validateCheckoutAddress(values) : {}), ...serverErrors };
  const issue = quote?.issues[0];
  const quoteError = destination ? preview.error?.detail || preview.error?.title : undefined;

  const changeAddress = (field: keyof CheckoutAddress, value: string) => {
    if (order.addressLocked) return;
    order.resetAfterEdit();
    setReviewedAddress(null);
    setValues((previous) => ({
      ...previous, [field]: value,
      ...(field === "provinceCode" ? { wardCode: "" } : {}),
    }));
  };
  const reviewAddress = () => {
    setSubmitted(true);
    const currentErrors = { ...validateCheckoutAddress(values), ...serverErrors };
    const firstError = Object.keys(currentErrors)[0];
    if (firstError) requestAnimationFrame(() => document.getElementById(`checkout-${firstError}`)?.focus());
    if (addressReady && !firstError) setReviewedAddress(JSON.stringify(destination));
  };

  return (
    <>
      <p className="mt-2 text-sm text-muted-foreground">Confirm your delivery address and review your order.</p>
      <ol className="my-7 grid grid-cols-4 gap-2 text-xs sm:gap-4 sm:text-sm" aria-label="Checkout progress">
        {["Shipping", "Delivery", "Payment", "Review"].map((step, index) => (
          <li key={step} aria-current={index === 0 ? "step" : undefined} className="flex min-w-0 flex-wrap items-center gap-2">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${index === 0 ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>{index === 0 && ready ? <Check size={14} aria-hidden="true" /> : index + 1}</span>
            <span>{step}</span><span className="hidden h-px flex-1 bg-border sm:block" aria-hidden="true" />
          </li>
        ))}
      </ol>
      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
        <div className="min-w-0 space-y-6">
          <AddressForm
            busy={order.addressLocked}
            values={values} errors={errors}
            provinces={provinces.data ?? []} wards={wards.data ?? []}
            provinceState={{ loading: provinces.isFetching, error: provinces.error?.detail || provinces.error?.title }}
            wardState={{ loading: wards.isFetching, error: wards.error?.detail || wards.error?.title }}
            onChange={changeAddress} onSubmit={reviewAddress}
            onRetry={(level) => { void (level === "province" ? provinces : wards).refetch(); }}
          />
          {ready && <p role="status" className="rounded-sm border border-border bg-muted p-4 text-sm">Address ready. Review the delivery fee and order total below.</p>}
          <section className="rounded-sm border border-border bg-card p-4 sm:p-6" aria-labelledby="delivery-title">
            <h2 id="delivery-title" className="text-sm font-semibold">2. Delivery</h2>
            <div className={`mt-4 flex items-start gap-3 rounded-sm border p-4 ${canContinue ? "border-primary" : "border-border"}`}>
              <Truck size={20} className="shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1 text-sm"><p className="font-medium">GHN delivery</p><p className="mt-1 text-xs leading-5 text-muted-foreground">The delivery fee is calculated for your selected address.</p></div>
              {canContinue && <span className="max-w-[45%] break-words text-right font-mono text-sm tabular-nums">{formatVND(quote!.shippingFee)}</span>}
            </div>
          </section>
          <section className="rounded-sm border border-border bg-card p-4 sm:p-6" aria-labelledby="payment-title">
            <h2 id="payment-title" className="text-sm font-semibold">3. Payment</h2>
            <div className="mt-4 flex gap-3 rounded-sm border border-primary p-4">
              <QrCode size={22} className="shrink-0" aria-hidden="true" /><div className="text-sm"><p className="font-medium">Bank transfer (VietQR)</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Scan a QR code with your banking app · processed by SePay</p></div>
            </div>
            <CheckoutOrderFeedback error={order.error} conflict={order.conflict} items={items} pending={order.pending} canConfirm={ready && canContinue} uncertain={order.uncertain} onConfirm={order.confirmPrice} />
            <button type="button" disabled={order.pending || order.blocked || (!order.canRetry && (!ready || !canContinue || Boolean(Object.keys(serverErrors).length)))} onClick={order.placeOrder} aria-busy={order.pending} aria-describedby="checkout-payment-note" className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-sm bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"><LockKeyhole size={16} aria-hidden="true" />{order.pending ? "Placing order…" : "Place order"}</button>
            <p id="checkout-payment-note" className="mt-3 text-xs leading-5 text-muted-foreground">Place one purchase for all shops, then continue to a single payment for your order group.</p>
          </section>
          <Link href="/cart" className="inline-flex min-h-11 min-w-11 items-center gap-2 text-sm hover:text-primary"><ArrowLeft size={16} aria-hidden="true" />Back to Cart</Link>
        </div>
        <CheckoutSummary items={items} preview={quote} loading={Boolean(destination) && preview.isFetching} error={quoteError || (issue ? "Some items need your attention. Return to your cart before continuing." : undefined)} onRetry={() => void preview.refetch()} addressReady={addressReady} />
      </div>
    </>
  );
}

export default CheckoutPage;
