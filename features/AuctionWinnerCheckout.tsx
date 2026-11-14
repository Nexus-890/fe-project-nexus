"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import AddressForm from "../components/AddressForm";
import { queryKeys } from "../configs/queryKeys";
import { useApiMutation, useApiQuery } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import { getProvinces, getWards } from "../service/checkoutService";
import { confirmAuctionShipping } from "../service/auctionCheckoutService";
import type { CheckoutAddress } from "../types/checkoutType";
import type { AuctionShippingConfirmation } from "../types/auctionCheckoutType";
import { formatAuctionMoney } from "./auctionRoomUtils";
import { getCheckoutDestination, getCheckoutFieldErrors, validateCheckoutAddress } from "./checkoutSchema";

const buttonClass = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-border px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50";
type ConfirmationAttempt = { address: CheckoutAddress; sessionId: number; signal: AbortSignal };

function AuctionWinnerCheckout({ orderId, currency, serverNow, paymentDueAt }: { orderId: string; currency: string; serverNow: number; paymentDueAt: string | null }) {
  const { user, requestContext, sessionId, isSessionCurrent } = useAuth();
  const [values, setValues] = useState<CheckoutAddress>(() => ({ recipientName: user?.fullName ?? "", phoneNumber: user?.phone ?? "", addressLine: user?.address ?? "", provinceCode: "", wardCode: "" }));
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutAddress, string>>>({});
  const [attempt, setAttempt] = useState<CheckoutAddress | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [confirmation, setConfirmation] = useState<AuctionShippingConfirmation | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const controller = useRef<AbortController | null>(null);
  const provinces = useApiQuery({ queryKey: queryKeys.checkout.provinces(sessionId), service: (signal) => getProvinces({ context: requestContext, signal }), meta: { requiresAuth: true } });
  const wards = useApiQuery({ queryKey: queryKeys.checkout.wards(sessionId, values.provinceCode), service: (signal) => getWards(values.provinceCode, { context: requestContext, signal }), meta: { requiresAuth: true } }, { enabled: Boolean(values.provinceCode) });
  const mutation = useApiMutation({
    execute: (input: ConfirmationAttempt) => confirmAuctionShipping(orderId, input.address, { context: requestContext, signal: input.signal }),
    isCurrent: (input) => isSessionCurrent(input.sessionId),
  }, {
    onSuccess: (result) => { setConfirmation(result); setUncertain(false); dialog.current?.close(); },
    onError: (error) => {
      if (error.kind === "aborted" || (error instanceof DOMException && error.name === "AbortError")) return;
      setUncertain(error.kind === "network" || error.kind === "invalid-response" || error.status >= 500);
      setErrors(getCheckoutFieldErrors(error));
      dialog.current?.close();
    },
  });
  useEffect(() => () => controller.current?.abort(), []);
  const deadline = confirmation && paymentDueAt
    ? Date.parse(confirmation.dueAt) < Date.parse(paymentDueAt) ? confirmation.dueAt : paymentDueAt
    : confirmation?.dueAt ?? paymentDueAt;
  const expired = Boolean(deadline && Date.parse(deadline) <= serverNow);
  const submit = () => {
    if (!attempt || mutation.isPending || expired) return;
    controller.current = new AbortController();
    mutation.mutate({ address: attempt, sessionId, signal: controller.current.signal });
  };
  const review = () => {
    const nextErrors = validateCheckoutAddress(values);
    if (!/^(0[0-9]{9}|\+84[0-9]{9})$/.test(values.phoneNumber.trim())) nextErrors.phoneNumber = "Enter a Vietnamese phone number (0xxxxxxxxx or +84xxxxxxxxx).";
    if (values.addressLine.trim().length > 255) nextErrors.addressLine = "Use 255 characters or fewer.";
    if (!/^[1-9][0-9]{0,8}$/.test(values.provinceCode.trim())) nextErrors.provinceCode = "Choose a valid province / city.";
    if (!/^[1-9][0-9]{0,8}$/.test(values.wardCode.trim())) nextErrors.wardCode = "Choose a valid ward.";
    const destination = getCheckoutDestination(values, provinces.data ?? [], wards.data ?? []);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || !destination || expired) return;
    setAttempt(values);
    dialog.current?.showModal();
  };
  if (expired) return <p role="alert" className="mt-4 text-sm text-danger">The payment deadline has passed. Shipping confirmation and payment are closed.</p>;
  if (confirmation) return <section aria-label="Confirmed auction total" className="mt-5 space-y-4 rounded-sm border border-border p-4">
    <h3 className="font-semibold">Shipping confirmed</h3>
    <dl className="space-y-2 text-sm"><div className="flex justify-between gap-4"><dt>Shipping fee</dt><dd>{formatAuctionMoney(confirmation.shippingFee, currency)}</dd></div><div className="flex justify-between gap-4 font-semibold"><dt>Total to pay</dt><dd>{formatAuctionMoney(confirmation.totalAmount, currency)}</dd></div></dl>
    <p className="text-xs text-muted-foreground">Pay by {new Date(deadline!).toLocaleString()}. The original auction payment deadline still applies.</p>
    <Link href={`/checkout/payment/${confirmation.orderGroupId}`} className={`${buttonClass} w-full bg-primary text-primary-foreground hover:bg-primary-hover`}>Continue to payment</Link>
  </section>;
  return <section aria-label="Winner checkout" className="mt-5 space-y-4">
    <p className="text-sm leading-6 text-muted-foreground">Confirm your delivery address to calculate shipping, then continue to payment.</p>
    <AddressForm values={values} errors={errors} provinces={provinces.data ?? []} wards={wards.data ?? []}
      provinceState={{ loading: provinces.isPending, error: provinces.isError ? "Unable to load provinces." : undefined }}
      wardState={{ loading: Boolean(values.provinceCode) && wards.isPending, error: wards.isError ? "Unable to load wards." : undefined }}
      onChange={(field, value) => { setValues((current) => ({ ...current, [field]: value, ...(field === "provinceCode" ? { wardCode: "" } : {}) })); setErrors({}); }}
      onRetry={(level) => void (level === "province" ? provinces.refetch() : wards.refetch())}
      onSubmit={review} busy={mutation.isPending || uncertain} />
    {mutation.error ? <div role="alert" className="text-sm leading-6 text-danger"><p>{uncertain ? "The confirmation result is unknown. Retry the same address to recover it safely." : mutation.error.code === "COMMERCE_AUCTION_HOLD_NOT_LINKED" ? "Your order is still being prepared. Retry shortly." : mutation.error.status === 404 ? "Shipping confirmation is not available yet. Your winning order is preserved." : mutation.error.detail || "Shipping confirmation failed. Try again."}</p>{uncertain ? <button type="button" onClick={submit} disabled={mutation.isPending} className={`${buttonClass} mt-3`}>Retry same address</button> : null}</div> : null}
    <dialog ref={dialog} aria-labelledby="auction-shipping-title" onCancel={(event) => { if (mutation.isPending) event.preventDefault(); }} className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-lg rounded-sm border border-border bg-background p-5 text-foreground shadow-lg backdrop:bg-black/40 sm:p-6">
      <h3 id="auction-shipping-title" className="text-lg font-semibold">Confirm shipping address</h3>
      <p className="mt-3 whitespace-pre-line text-sm leading-6">{attempt ? [attempt.recipientName, attempt.phoneNumber, attempt.addressLine, wards.data?.find((ward) => ward.code === attempt.wardCode)?.name, provinces.data?.find((province) => province.code === attempt.provinceCode)?.name].filter(Boolean).join("\n") : ""}</p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">Shipping and the payable total will be calculated for this address. Once confirmed, the address cannot be changed.</p>
      <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={() => dialog.current?.close()} disabled={mutation.isPending} className={buttonClass}>Back to address</button><button type="button" onClick={submit} disabled={mutation.isPending || expired} className={`${buttonClass} bg-primary text-primary-foreground hover:bg-primary-hover`}>{mutation.isPending ? "Confirming…" : "Confirm shipping address"}</button></div>
    </dialog>
  </section>;
}

export default AuctionWinnerCheckout;
