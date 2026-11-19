"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { formatVND } from "./formatPrice";

type CartSummaryProps = {
  quantity: number;
  subtotal: string;
  pending?: boolean;
  discountAmount?: string;
  total?: string;
  checkoutBlocked?: boolean;
  checking?: boolean;
  checkoutLabel?: string;
  onCheckout?: () => void;
  children?: ReactNode;
};

function CartSummary({ quantity, subtotal, pending = false, discountAmount, total, checkoutBlocked = false, checking = false, checkoutLabel = "Proceed to Checkout", onCheckout, children }: CartSummaryProps) {
  const formattedSubtotal = formatVND(subtotal);

  return (
    <aside
      aria-label="Order summary"
      className="min-w-0 self-start space-y-5 text-card-foreground"
    >
      {children}
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
        <div className="mt-3 flex justify-between gap-4 text-xs text-muted-foreground"><dt>Discount</dt><dd>{discountAmount === undefined ? "—" : `− ${formatVND(discountAmount)}`}</dd></div>
        <div className="mt-6 flex min-w-0 flex-wrap justify-between gap-x-4 gap-y-2 border-t border-border pt-4 text-base">
          <dt>Total</dt>
          <dd className="min-w-0 font-mono text-xl font-semibold tabular-nums text-primary [overflow-wrap:anywhere]">
            {total === undefined ? "—" : formatVND(total)}
          </dd>
        </div>
      </dl>
      {pending ? (
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          Updating your cart…
        </p>
      ) : null}
      {pending || checkoutBlocked || checking || onCheckout ? <button
        type="button"
        disabled={pending || checkoutBlocked || checking}
        onClick={onCheckout}
        className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-primary px-4 py-3 text-center text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {checking ? "Checking your cart…" : checkoutLabel}
      </button> : <Link href="/checkout" className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-primary px-4 py-3 text-center text-sm font-medium text-primary-foreground hover:bg-primary-hover">{checkoutLabel}</Link>}
      <p className="mt-3 text-xs leading-5 text-muted-foreground">Prices and stock are revalidated at checkout. Shipping is confirmed before you place your order.</p>
      </section>
    </aside>
  );
}

export default CartSummary;
