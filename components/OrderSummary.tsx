"use client";

import { useState, type ReactNode } from "react";
import { Package, ShieldCheck } from "lucide-react";
import { getCartQuantity, getCartSubtotal, multiplyCartMoney } from "../features/cartUtils";
import type { CartItem } from "../types/cartResponseType";
import type { CheckoutPreview } from "../types/checkoutType";
import type { ProductDetail } from "../types/catalogResponseType";
import { formatVND } from "./formatPrice";

export type OrderSummaryProps = {
  items: CartItem[];
  preview?: CheckoutPreview;
  loading: boolean;
  error?: string;
  onRetry: () => void;
  addressReady: boolean;
  children?: ReactNode;
};

export function CheckoutItem({ item, product }: { item: CartItem; product?: ProductDetail }) {
  const [failedImage, setFailedImage] = useState<string>();
  const name = product?.name ?? `Item ${item.productId}`;
  const sku = product?.skus.find((candidate) => candidate.id === item.skuId);
  const variant = [sku?.color, sku?.size].filter(Boolean).join(" · ");
  const imageUrl = product?.images.find((image) => image.imageUrl.trim())?.imageUrl;

  return (
    <li data-testid={`checkout-item-${item.id}`} className="grid min-w-0 grid-cols-[56px_minmax(0,1fr)] gap-3">
      <div className="flex size-14 items-center justify-center overflow-hidden rounded-sm bg-muted">
        {imageUrl && imageUrl !== failedImage ? (
          // Catalog returns media origins dynamically; use the existing Cart media policy.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={name}
            loading="lazy"
            width={56}
            height={56}
            onError={() => setFailedImage(imageUrl)}
            className="size-full object-contain"
          />
        ) : (
          <Package size={24} role="img" aria-label="Product image unavailable" className="text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 text-sm">
        <h3 className="font-medium leading-5 [overflow-wrap:anywhere]">{name}</h3>
        {variant ? <p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">{variant}</p> : null}
        <p className="mt-1 text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
          Qty {item.quantity} · Unit price: <span className="font-mono tabular-nums">{formatVND(item.unitPrice)}</span>
        </p>
        <p className="mt-1 font-mono font-medium tabular-nums [overflow-wrap:anywhere]">
          <span className="sr-only">Line total: </span>{formatVND(multiplyCartMoney(item.unitPrice, item.quantity))}
        </p>
      </div>
    </li>
  );
}

function OrderSummary({ items, preview, loading, error, onRetry, addressReady, children }: OrderSummaryProps) {
  const quantity = getCartQuantity(items);
  const subtotal = preview?.subtotal ?? getCartSubtotal(items);
  const quoted = addressReady && !loading && !error && preview && preview.shippingFee !== null;
  const estimated = !quoted && !error && preview?.shippingFee !== null;
  const shipping = loading
    ? "Calculating…"
    : error
      ? "Unavailable"
      : preview?.shippingFee === null
        ? "Unavailable"
        : quoted
          ? formatVND(preview.shippingFee)
          : "Enter your address";

  return (
    <aside aria-label="Order summary" className="min-w-0 space-y-4 self-start">
      <section aria-labelledby="checkout-items-title" className="min-w-0 rounded-sm border border-border bg-card p-5 text-card-foreground sm:p-6">
        <h2 id="checkout-items-title" className="text-sm font-medium">
          {quantity} {quantity === 1 ? "item" : "items"}
        </h2>
        <ul className="mt-5 space-y-5">
          {children ?? items.map((item) => <CheckoutItem key={item.id} item={item} />)}
        </ul>
      </section>
      <section aria-labelledby="checkout-summary-title" className="min-w-0 rounded-sm border border-border bg-card p-5 text-card-foreground sm:p-6">
        <h2 id="checkout-summary-title" className="text-base font-semibold">Order Summary</h2>
        <dl aria-live="polite" aria-atomic="true" aria-busy={loading} className="mt-5 space-y-4 text-sm">
          <div className="flex min-w-0 flex-wrap justify-between gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd data-testid="checkout-subtotal" className="min-w-0 font-mono tabular-nums [overflow-wrap:anywhere]">{formatVND(subtotal)}</dd>
          </div>
          <div className="flex min-w-0 flex-wrap justify-between gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">Shipping</dt>
            <dd data-testid="checkout-shipping" className="min-w-0 text-right font-mono tabular-nums [overflow-wrap:anywhere]">{shipping}</dd>
          </div>
          {quoted ? (
            <>
              <div className="flex min-w-0 flex-wrap justify-between gap-x-4 gap-y-1">
                <dt className="text-muted-foreground">Discount</dt>
                <dd className="min-w-0 font-mono tabular-nums [overflow-wrap:anywhere]">−{formatVND(preview.discountAmount)}</dd>
              </div>
              <div className="flex min-w-0 flex-wrap justify-between gap-x-4 gap-y-1">
                <dt className="text-muted-foreground">Tax</dt>
                <dd className="min-w-0 font-mono tabular-nums [overflow-wrap:anywhere]">{formatVND(preview.taxAmount)}</dd>
              </div>
            </>
          ) : null}
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border pt-5">
            <dt className="text-base font-medium">{estimated ? "Estimated total" : "Total"}</dt>
            <dd data-testid="checkout-total" className="min-w-0 font-mono text-xl font-semibold tabular-nums text-primary [overflow-wrap:anywhere]">
              {quoted ? formatVND(preview.total) : estimated ? formatVND(subtotal) : "—"}
            </dd>
          </div>
        </dl>
        {error ? (
          <div className="mt-4 text-sm">
            <p role="alert" className="break-words text-danger">{error}</p>
            <button type="button" onClick={onRetry} className="mt-1 inline-flex min-h-11 min-w-11 items-center rounded-sm font-medium text-primary underline underline-offset-4">
              Retry shipping estimate
            </button>
          </div>
        ) : preview?.shippingFee === null ? (
          <p role="status" className="mt-4 text-sm leading-5 text-muted-foreground">
            A shipping estimate is not available for this address yet.
          </p>
        ) : null}
        <p className="mt-5 flex items-start gap-2 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
          <ShieldCheck size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          Review your address and final costs before placing your order.
        </p>
      </section>
    </aside>
  );
}

export default OrderSummary;
