"use client";

import Link from "next/link";
import { formatVND } from "../components/formatPrice";
import { queryKeys } from "../configs/queryKeys";
import { useApiQuery } from "../hooks/useApi";
import { getProduct } from "../service/catalogService";
import type { CartItem } from "../types/cartResponseType";
import type { CheckoutConflict } from "../types/checkoutType";
import type { ApiError } from "../types/commonResponseType";

type CheckoutOrderFeedbackProps = {
  error: ApiError | null;
  conflict: CheckoutConflict | null;
  items: CartItem[];
  pending: boolean;
  canConfirm: boolean;
  uncertain: boolean;
  onConfirm: () => void;
};

function CheckoutOrderFeedback({ error, conflict, items, pending, canConfirm, uncertain, onConfirm }: CheckoutOrderFeedbackProps) {
  const item = conflict?.skuId ? items.find((line) => line.skuId === conflict.skuId) : undefined;
  const productId = item?.productId ?? "";
  const product = useApiQuery({
    queryKey: queryKeys.catalog.product(productId),
    service: (signal) => getProduct(productId, { signal }),
  }, { enabled: Boolean(productId && conflict), retry: false, staleTime: 60_000 });
  if (!error) return null;
  const itemName = (conflict?.kind === "insufficient-stock" && conflict.productName) || product.data?.name || (conflict?.skuId ? `Item ${conflict.skuId}` : "An item in your cart");

  return (
    <section role="alert" aria-labelledby="checkout-conflict-title" className="mt-5 space-y-3 rounded-sm border border-danger p-4 text-sm [overflow-wrap:anywhere]">
      <h3 id="checkout-conflict-title" className="font-semibold">
        {conflict?.kind === "price-changed" ? "Price changed" : conflict?.kind === "insufficient-stock" ? "Item out of stock" : "Unable to place your order"}
      </h3>
      {conflict?.kind === "insufficient-stock" ? <p>{itemName} doesn’t have enough stock for the quantity in your cart.</p> : <p>{error.detail || error.title}</p>}
      {conflict && conflict.kind !== "insufficient-stock" && <p className="font-medium">{itemName}</p>}
      {conflict?.kind === "price-changed" && <>
        <dl className="space-y-2">
          <div className="flex flex-wrap justify-between gap-2"><dt>Previous unit price</dt><dd className="font-mono tabular-nums">{formatVND(conflict.oldPrice)}</dd></div>
          <div className="flex flex-wrap justify-between gap-2"><dt>New unit price</dt><dd className="font-mono tabular-nums">{formatVND(conflict.newPrice)}</dd></div>
        </dl>
        <p>Review the updated total. Confirm the new price to place your order.</p>
        <button type="button" disabled={pending || !canConfirm} onClick={onConfirm} className="min-h-11 w-full rounded-sm bg-primary px-4 font-medium text-primary-foreground disabled:opacity-60">Confirm new price</button>
      </>}
      {conflict?.kind === "insufficient-stock" && <p>Return to your cart to remove this item or change its quantity before ordering.</p>}
      {uncertain && <p>We couldn’t confirm whether your order was created. Try Place order again to check the same purchase.</p>}
      {error.errors?.length ? <ul className="list-inside list-disc">{error.errors.map((entry, index) => <li key={`${entry.field}-${index}`}>{entry.field}: {entry.detail}</li>)}</ul> : null}
      {(conflict || error.code === "COMMERCE_PRICE_CHANGED") && <Link href="/cart" className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4">Back to cart</Link>}
    </section>
  );
}

export default CheckoutOrderFeedback;
