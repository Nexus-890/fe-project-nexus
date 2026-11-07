import Link from "next/link";
import { formatVND } from "./formatPrice";

type CartSummaryProps = {
  quantity: number;
  subtotal: string;
  pending?: boolean;
};

function CartSummary({ quantity, subtotal, pending = false }: CartSummaryProps) {
  const formattedSubtotal = formatVND(subtotal);

  return (
    <aside
      aria-label="Order summary"
      className="min-w-0 self-start rounded-sm border border-border bg-card p-6 text-card-foreground"
    >
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
    </aside>
  );
}

export default CartSummary;
