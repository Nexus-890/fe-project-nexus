"use client";

import Link from "next/link";
import { useState } from "react";
import { TicketPercent } from "lucide-react";
import { formatVND } from "./formatPrice";

type CartSummaryProps = {
  quantity: number;
  subtotal: string;
  pending?: boolean;
};

function CartSummary({ quantity, subtotal, pending = false }: CartSummaryProps) {
  const formattedSubtotal = formatVND(subtotal);
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");

  return (
    <aside
      aria-label="Order summary"
      className="min-w-0 self-start space-y-5 text-card-foreground"
    >
      <form className="rounded-sm border border-border bg-card p-5 sm:p-6" onSubmit={(event) => { event.preventDefault(); setNotice(code.trim().toUpperCase() === "NEXUS10" ? "Demo voucher selected. No discount is applied to your live order." : "This is a voucher preview. Try NEXUS10."); }}>
        <label htmlFor="cart-discount-code" className="flex items-center gap-2 text-sm font-medium"><TicketPercent size={16} aria-hidden="true" />Discount Code <span className="ml-auto rounded-sm bg-muted px-2 py-1 text-[10px] font-normal text-muted-foreground">Preview</span></label>
        <div className="mt-3 flex gap-2"><input id="cart-discount-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Enter coupon code" maxLength={32} className="min-h-11 min-w-0 flex-1 rounded-sm border border-input bg-background px-3 text-sm" /><button type="submit" className="min-h-11 rounded-sm border border-border px-3 text-xs font-medium hover:bg-secondary">Apply Code</button></div>
        <button type="button" onClick={() => setCode("NEXUS10")} className="mt-2 min-h-11 text-xs text-info">NEXUS10 · Preview voucher</button>
        {notice && <p role="status" className="mt-2 text-xs leading-5 text-muted-foreground">{notice}</p>}
      </form>
      <section className="rounded-sm border border-border bg-card p-5 sm:p-6">
      <h2 className="text-base font-semibold">Order Summary</h2>
      <dl className="mt-5 text-sm" aria-live="polite" aria-atomic="true">
        <div className="flex min-w-0 flex-wrap justify-between gap-x-4 gap-y-2">
          <dt className="text-muted-foreground">
            Subtotal ({quantity} {quantity === 1 ? "item" : "items"})
          </dt>
          <dd
            data-testid="cart-subtotal"
            className="min-w-0 font-mono tabular-nums [overflow-wrap:anywhere]"
          >
            {formattedSubtotal}
          </dd>
        </div>
        <div className="mt-4 flex justify-between gap-4 text-xs text-muted-foreground"><dt>Shipping</dt><dd>Calculated at checkout</dd></div>
        <div className="mt-3 flex justify-between gap-4 text-xs text-muted-foreground"><dt>Discount</dt><dd>—</dd></div>
        <div className="mt-6 flex min-w-0 flex-wrap justify-between gap-x-4 gap-y-2 border-t border-border pt-4 text-base">
          <dt>Total</dt>
          <dd className="min-w-0 font-mono text-xl font-semibold tabular-nums text-primary [overflow-wrap:anywhere]">
            {formattedSubtotal}
          </dd>
        </div>
      </dl>
      {pending ? (
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          Updating your cart…
        </p>
      ) : null}
      {pending ? <button
        type="button"
        disabled
        className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-primary px-4 py-3 text-center text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
      >
        Proceed to Checkout
      </button> : <Link href="/checkout" className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-primary px-4 py-3 text-center text-sm font-medium text-primary-foreground hover:bg-primary-hover">Proceed to Checkout</Link>}
      <p className="mt-3 text-xs leading-5 text-muted-foreground">Prices and stock are revalidated at checkout. Shipping is confirmed before you place your order.</p>
      </section>
    </aside>
  );
}

export default CartSummary;
