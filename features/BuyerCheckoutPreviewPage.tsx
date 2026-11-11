"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Check, CircleCheck, CreditCard, MapPin, Package, Plus, QrCode, ShieldCheck, Store, Truck } from "lucide-react";
import CartLine from "../components/CartLine";
import ProductImage from "../components/ProductImage";
import { formatVND } from "../components/formatPrice";
import { useBuyerPreview } from "../providers/BuyerPreviewProvider";
import { createBuyerPreviewState, getBuyerPreviewAmounts, previewDeliveryOptions, previewPaymentOptions, type BuyerPreviewState } from "./buyerPreviewState";
import { multiplyCartMoney } from "./cartUtils";

type Stage = "cart" | "checkout" | "paid" | "unpaid" | "detail";
type Outcome = "paid" | "unpaid";
const orderNumber = "NX-260929-0042";
const actionClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-border px-5 text-sm font-medium hover:bg-secondary";
const primaryClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary-hover";

function PreviewNotice({ stage }: { stage: Stage }) {
  return <div className="mb-7 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-info/30 bg-info/5 px-4 py-3 text-xs leading-5">
    <p><strong>Design preview</strong> · Sample data. No order or payment will be created.</p>
    <nav aria-label="Preview screens" className="flex flex-wrap gap-x-4 gap-y-2">
      {([{ stage: "cart", label: "Cart", href: "/cart/preview" }, { stage: "checkout", label: "Checkout", href: "/checkout/preview" }, { stage: "paid", label: "Paid", href: "/checkout/result/preview?state=paid" }, { stage: "unpaid", label: "Unpaid", href: "/checkout/result/preview?state=unpaid" }] as const).map((item) =>
        <Link key={item.stage} href={item.href} aria-current={stage === item.stage ? "page" : undefined} className={`inline-flex min-h-11 items-center ${stage === item.stage ? "font-semibold text-primary" : "text-muted-foreground hover:text-primary"}`}>{item.label}</Link>)}
    </nav>
  </div>;
}

function SampleItems({ state }: { state: BuyerPreviewState }) {
  const { quantity } = getBuyerPreviewAmounts(state);
  return <section className="rounded-sm border border-border p-5 sm:p-6" aria-label="Sample order items">
    <h2 className="text-sm font-semibold">{quantity} items</h2>
    <ul className="mt-4 divide-y divide-border">{state.items.map((item) => <li key={item.id} data-testid={`preview-item-${item.id}`} className="flex min-w-0 flex-wrap gap-3 py-4 first:pt-0 last:pb-0">
      <div className="size-12 shrink-0 overflow-hidden rounded-sm bg-muted"><ProductImage src={item.imageUrl ?? undefined} alt={item.productName} productName={item.productName} /></div>
      <div className="min-w-0 flex-1 text-xs"><p className="font-medium [overflow-wrap:anywhere]">{item.productName}</p><p className="mt-1 text-muted-foreground">{[item.color, item.size].filter(Boolean).join(" · ")}</p><p className="mt-1 text-muted-foreground">Qty {item.quantity}</p></div>
      <p className="max-w-full text-xs font-medium [overflow-wrap:anywhere]">{formatVND(multiplyCartMoney(item.unitPrice, item.quantity))}</p>
    </li>)}</ul>
    {!state.items.length && <p className="mt-4 text-sm text-muted-foreground">Your sample order has no items.</p>}
  </section>;
}

function SampleAmounts({ state, prefix = "preview" }: { state: BuyerPreviewState; prefix?: string }) {
  const { subtotal, shipping, discount, total, quantity } = getBuyerPreviewAmounts(state);
  return <dl className="mt-5 space-y-4 text-sm">
    <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Subtotal ({quantity} items)</dt><dd data-testid={`${prefix}-subtotal`} className="font-mono tabular-nums [overflow-wrap:anywhere]">{formatVND(subtotal)}</dd></div>
    <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Discount</dt><dd data-testid={`${prefix}-discount`} className="font-mono text-info [overflow-wrap:anywhere]">−{formatVND(discount)}</dd></div>
    <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Estimated shipping</dt><dd data-testid={`${prefix}-shipping`} className="font-mono [overflow-wrap:anywhere]">{formatVND(shipping)}</dd></div>
    <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Tax</dt><dd className="font-mono">{formatVND("0.00")}</dd></div>
    <div className="flex items-baseline justify-between gap-4 border-t border-border pt-4"><dt className="font-medium">Total</dt><dd data-testid={`${prefix}-total`} className="font-mono text-xl font-semibold text-primary [overflow-wrap:anywhere]">{formatVND(total)}</dd></div>
  </dl>;
}

function SampleReceipt({ state, outcome }: { state: BuyerPreviewState; outcome: Outcome }) {
  const address = state.addresses.find(({ id }) => id === state.selectedAddress)!;
  const delivery = previewDeliveryOptions.find(({ id }) => id === state.delivery)!;
  const payment = previewPaymentOptions.find(({ id }) => id === state.payment)!;
  return <aside className="min-w-0 rounded-sm border border-border p-5 sm:p-6" aria-label="Sample order receipt">
    <h2 className="text-base font-semibold">Order summary</h2>
    <dl className="mt-5 space-y-4 text-xs">
      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Order</dt><dd className="font-mono">{orderNumber}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Status</dt><dd>{outcome === "paid" ? "Paid · sample" : "Awaiting payment · sample"}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Payment</dt><dd data-testid="receipt-payment" className="text-right">{payment.title}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Ship to</dt><dd data-testid="receipt-address" className="min-w-0 max-w-[70%] text-right leading-5 [overflow-wrap:anywhere]">{address.label}<br />{address.line}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Delivery</dt><dd data-testid="receipt-delivery" className="text-right">{delivery.title}<br />{delivery.estimate}</dd></div>
      {state.couponApplied && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Sample voucher</dt><dd data-testid="receipt-voucher">NEXUS10</dd></div>}
    </dl>
    <SampleAmounts state={state} prefix="receipt" />
    {outcome === "paid" && <ol aria-label="Order progress" className="mt-5 flex justify-between gap-2 border-t border-border pt-4 text-xs">{["Placed", "Paid", "Shipped", "Delivered"].map((step, index) => <li key={step} className={`flex items-center gap-1 ${index < 2 ? "text-primary" : "text-muted-foreground"}`}><span className={`flex size-4 items-center justify-center rounded-full border ${index < 2 ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{index < 2 ? <Check size={10} aria-hidden="true" /> : index + 1}</span>{step}</li>)}</ol>}
    <p className="mt-4 text-xs leading-5 text-muted-foreground">Sample delivery dates, fees and payment status. This receipt reflects your preview selections only.</p>
  </aside>;
}

function BuyerCheckoutPreviewPage({ stage, outcome = "paid" }: { stage: Stage; outcome?: Outcome }) {
  const { state, setState, ready } = useBuyerPreview();
  const [couponNotice, setCouponNotice] = useState("");
  const [addingAddress, setAddingAddress] = useState(false);
  const [newAddress, setNewAddress] = useState("");
  const { quantity } = getBuyerPreviewAmounts(state);
  const sellers = [...new Set(state.items.map(({ sellerId }) => sellerId))];
  const isResult = stage === "paid" || stage === "unpaid";
  const resultOutcome: Outcome = stage === "unpaid" ? "unpaid" : stage === "paid" ? "paid" : outcome;
  const sampleDetailHref = `/order/preview?state=${resultOutcome}`;
  const setChoice = <K extends keyof BuyerPreviewState>(key: K, value: BuyerPreviewState[K]) => setState((current) => ({ ...current, [key]: value }));

  if (!ready) return <section className="mx-auto max-w-[1248px] px-4 py-8 sm:px-6"><p role="status">Loading your sample choices…</p></section>;

  const voucher = <form onSubmit={(event) => {
    event.preventDefault();
    const valid = state.coupon.trim().toUpperCase() === "NEXUS10";
    setState((current) => ({ ...current, coupon: current.coupon.trim().toUpperCase(), couponApplied: valid }));
    setCouponNotice(valid ? "Sample voucher applied." : "Try the sample code NEXUS10.");
  }} className="rounded-sm border border-border p-5">
    <label htmlFor="preview-coupon" className="text-sm font-semibold">Discount Code</label>
    <div className="mt-3 flex gap-2"><input id="preview-coupon" placeholder="NEXUS10" maxLength={32} value={state.coupon} onChange={(event) => { setState((current) => ({ ...current, coupon: event.target.value, couponApplied: false })); setCouponNotice(""); }} className="min-h-11 min-w-0 flex-1 rounded-sm border border-input px-3 text-sm" /><button type="submit" className="min-h-11 rounded-sm border border-border px-3 text-xs hover:bg-secondary">Apply Code</button></div>
    <button type="button" className="mt-1 min-h-11 text-xs text-info" onClick={() => setChoice("coupon", "NEXUS10")}>NEXUS10 · Sample voucher</button>
    {couponNotice || state.couponApplied ? <p role="status" className="mt-1 text-xs text-muted-foreground">{couponNotice || "Sample voucher applied."}</p> : null}
  </form>;

  const summary = <div className="space-y-5">
    {stage === "checkout" && <SampleItems state={state} />}
    {voucher}
    <section className="rounded-sm border border-border p-5 sm:p-6"><h2 className="text-base font-semibold">Order Summary</h2><SampleAmounts state={state} />
      {state.items.length > 0 ? <Link href={stage === "cart" ? "/checkout/preview" : `/checkout/result/preview?state=${state.payment === "card" ? "unpaid" : "paid"}`} className={`${primaryClass} mt-5 w-full`}>{stage === "cart" ? "Proceed to Checkout" : <><ShieldCheck size={16} aria-hidden="true" />Preview payment result</>}</Link> : <Link href="/" className={`${primaryClass} mt-5 w-full`}>Continue shopping</Link>}
      <p className="mt-3 text-xs leading-5 text-muted-foreground">These sample prices show the checkout layout. No real purchase is made in this preview.</p>
    </section>
  </div>;

  return <section className="mx-auto w-full max-w-[1248px] px-4 py-8 sm:px-6 lg:py-10">
    <PreviewNotice stage={stage} />
    {isResult ? <div className="grid min-w-0 items-start gap-10 py-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16">
      <div className="min-w-0"><p className={`flex items-center gap-2 text-sm ${stage === "paid" ? "text-info" : "text-danger"}`}><CircleCheck size={16} aria-hidden="true" />{stage === "paid" ? "Payment received" : "Card declined"}</p>
        <h1 className="mt-3 max-w-xl text-heading-32">Order {orderNumber}{stage === "unpaid" ? " isn’t paid yet" : ""}</h1>
        <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">{stage === "paid" ? "Your sample payment succeeded. Review the same items, delivery address and payment choice from checkout." : "This is a sample declined-payment outcome. Change the payment choice to preview another result — nothing was charged."}</p>
        <div className="mt-6 flex flex-wrap gap-3"><Link href={stage === "paid" ? sampleDetailHref : "/checkout/preview"} className={primaryClass}>{stage === "paid" ? "View Order" : "Pay Another Way"}</Link><Link href={stage === "paid" ? "/" : "/checkout/preview"} className={actionClass}>{stage === "paid" ? "Continue Shopping" : "Retry Card"}</Link>{stage === "unpaid" && <Link href={sampleDetailHref} className={actionClass}>View Order</Link>}</div>
        <div className="mt-8"><SampleItems state={state} /></div>
      </div><SampleReceipt state={state} outcome={resultOutcome} />
    </div> : stage === "detail" ? <>
      <Link href={`/checkout/result/preview?state=${outcome}`} className="inline-flex min-h-11 items-center gap-2 text-sm hover:text-primary"><ArrowLeft size={15} aria-hidden="true" />Back to sample result</Link>
      <h1 className="mt-3 text-heading-32">Sample order {orderNumber}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Your preview items and checkout selections. This order exists only in this browser tab.</p>
      <div className="mt-6 grid min-w-0 items-start gap-7 lg:grid-cols-[minmax(0,1fr)_380px]"><SampleItems state={state} /><SampleReceipt state={state} outcome={outcome} /></div>
    </> : <>
      <h1 className="text-heading-32">{stage === "cart" ? "Cart" : "Checkout"}</h1>
      {stage === "cart" ? <p className="mt-1 text-sm text-muted-foreground">{quantity} items from {sellers.length} {sellers.length === 1 ? "seller" : "sellers"}</p> : <ol aria-label="Checkout progress" className="my-6 flex max-w-3xl flex-wrap justify-between gap-3 text-xs">{["Shipping", "Delivery", "Payment", "Review"].map((step, index) => <li key={step} className={`flex items-center gap-2 ${index < 3 ? "text-primary" : "text-muted-foreground"}`}><span className={`flex size-6 items-center justify-center rounded-full border ${index < 2 ? "border-primary bg-primary text-primary-foreground" : "border-current"}`}>{index < 2 ? <Check size={12} aria-hidden="true" /> : index + 1}</span>{step}</li>)}</ol>}
      <div className="mt-6 grid min-w-0 items-start gap-7 lg:grid-cols-[minmax(0,1fr)_380px]"><div className="min-w-0 space-y-5">
        {stage === "cart" ? <>{sellers.map((sellerId) => <section key={sellerId} className="overflow-hidden rounded-sm border border-border"><h2 className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-4 text-sm font-medium"><Store size={16} aria-hidden="true" />{state.items.find((item) => item.sellerId === sellerId)?.sellerName}<span className="ml-auto text-xs font-normal text-muted-foreground">Sample seller</span></h2>
          <div className="divide-y divide-border">{state.items.filter((item) => item.sellerId === sellerId).map((item) => <CartLine key={item.id} item={item} pending={false} saved={state.saved.includes(item.id)} onSave={() => setState((current) => ({ ...current, saved: current.saved.includes(item.id) ? current.saved.filter((id) => id !== item.id) : [...current.saved, item.id] }))} onQuantityChange={(quantity) => { if (quantity < 1 || quantity > 999 || !Number.isSafeInteger(quantity)) return; setState((current) => ({ ...current, items: current.items.map((candidate) => candidate.id === item.id ? { ...candidate, quantity, lineTotal: multiplyCartMoney(candidate.unitPrice, quantity) } : candidate) })); }} onRemove={() => setState((current) => ({ ...current, items: current.items.filter((candidate) => candidate.id !== item.id) }))} />)}</div>
        </section>)}{state.items.length === 0 && <div className="rounded-sm border border-border p-10 text-center"><Package className="mx-auto text-muted-foreground" aria-hidden="true" /><p className="mt-3">Your sample cart is empty.</p><button type="button" className={`${actionClass} mt-5`} onClick={() => setChoice("items", createBuyerPreviewState().items)}>Restore sample items</button></div>}</> : <>
          <section className="rounded-sm border border-border p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-semibold">1. Shipping Address</h2><button type="button" onClick={() => setAddingAddress((current) => !current)} className="flex min-h-11 items-center gap-1 text-xs"><Plus size={13} aria-hidden="true" />Add Address</button></div>
            <div className="mt-3 space-y-3">{state.addresses.map((address) => <label key={address.id} className={`flex cursor-pointer items-start gap-3 rounded-sm border p-4 ${state.selectedAddress === address.id ? "border-primary" : "border-border"}`}><input type="radio" name="preview-address" value={address.id} checked={state.selectedAddress === address.id} onChange={() => setChoice("selectedAddress", address.id)} className="mt-1 accent-primary" /><div className="min-w-0 flex-1 text-sm"><p className="font-medium">{address.label}</p><p className="mt-1 text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">{address.line}</p></div><span className="text-[10px] text-muted-foreground">{address.badge}</span></label>)}</div>
            {addingAddress && <form className="mt-4 border-t border-border pt-4" onSubmit={(event) => { event.preventDefault(); if (!newAddress.trim() || state.addresses.length >= 20) return; const id = `sample-${crypto.randomUUID()}`; setState((current) => ({ ...current, addresses: [...current.addresses, { id, label: "New sample address", line: newAddress.trim(), badge: "Preview" }], selectedAddress: id })); setAddingAddress(false); setNewAddress(""); }}><label htmlFor="preview-address-line" className="text-xs font-medium">Sample address</label><input id="preview-address-line" value={newAddress} required maxLength={300} onChange={(event) => setNewAddress(event.target.value)} className="mt-2 min-h-11 w-full rounded-sm border border-input px-3 text-sm" /><button type="submit" className={`${actionClass} mt-3`}>Save sample address</button></form>}
          </section>
          <section className="rounded-sm border border-border p-5 sm:p-6"><h2 className="text-sm font-semibold">2. Delivery</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{previewDeliveryOptions.map(({ id, title, amount, estimate }) => <label key={id} className={`flex cursor-pointer items-start gap-3 rounded-sm border p-4 ${state.delivery === id ? "border-primary" : "border-border"}`}><input type="radio" name="preview-delivery" checked={state.delivery === id} onChange={() => setChoice("delivery", id)} className="mt-1 accent-primary" /><Truck size={18} className="shrink-0" aria-hidden="true" /><div className="min-w-0 flex-1 text-xs"><div className="flex flex-wrap justify-between gap-2"><strong className="font-medium">{title}</strong><span>{formatVND(amount)}</span></div><p className="mt-2 text-muted-foreground">{estimate}</p></div></label>)}</div><p className="mt-4 text-[10px] text-muted-foreground">Sample delivery dates and fees.</p></section>
          <section className="rounded-sm border border-border p-5 sm:p-6"><h2 className="text-sm font-semibold">3. Payment</h2><div className="mt-4 space-y-3">{previewPaymentOptions.map(({ id, title, detail }) => <label key={id} className={`flex cursor-pointer items-start gap-3 rounded-sm border p-4 ${state.payment === id ? "border-primary" : "border-border"}`}><input type="radio" name="preview-payment" checked={state.payment === id} onChange={() => setChoice("payment", id)} className="mt-1 accent-primary" />{id === "card" ? <CreditCard size={18} className="shrink-0" aria-hidden="true" /> : <QrCode size={18} className="shrink-0" aria-hidden="true" />}<div className="text-sm"><p>{title}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div></label>)}</div></section>
        </>}
        <Link href={stage === "cart" ? "/" : "/cart/preview"} className="inline-flex min-h-11 items-center gap-2 text-sm hover:text-primary"><ArrowLeft size={15} aria-hidden="true" />{stage === "cart" ? "Continue shopping" : "Back to Cart"}</Link>
      </div><aside className="min-w-0" aria-label="Sample order summary">{summary}</aside></div>
    </>}
    {stage !== "detail" && <Link href={stage === "cart" ? "/cart" : "/checkout"} className="mt-8 inline-flex min-h-11 items-center gap-2 text-xs text-muted-foreground hover:text-primary"><MapPin size={14} aria-hidden="true" />Open live {stage === "cart" ? "cart" : "checkout"}</Link>}
  </section>;
}

export default BuyerCheckoutPreviewPage;
