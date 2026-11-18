"use client";

import { Heart, Package } from "lucide-react";
import { multiplyCartMoney } from "@/features/cartUtils";
import type { CartItem } from "@/types/cartResponseType";
import type { ProductDetail } from "@/types/catalogResponseType";
import QuantityPicker from "./QuantityPicker";
import { formatVND } from "./formatPrice";

type CartLineProps = {
  item: CartItem;
  product?: ProductDetail;
  pending: boolean;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
  saved?: boolean;
  onSave?: () => void;
  available?: number;
};

function CartLine({
  item,
  product,
  pending,
  onQuantityChange,
  onRemove,
  saved = false,
  onSave,
  available,
}: CartLineProps) {
  const stockNote = available === undefined ? null : available === 0 ? "Out of stock. Remove this item to check out." : item.quantity > available ? `Only ${available} left. Lower the quantity to check out.` : null;
  const name = product?.name ?? item.productName ?? `Item ${item.productId}`;
  const sku = product?.skus.find((candidate) => candidate.id === item.skuId);
  const variant = [sku?.color ?? item.color, sku?.size ?? item.size].filter(Boolean).join(" · ");
  const imageUrl = product?.images.find((candidate) => candidate.imageUrl)?.imageUrl ?? item.imageUrl;
  const unitPrice = formatVND(item.unitPrice);
  const lineTotal = formatVND(multiplyCartMoney(item.unitPrice, item.quantity));

  return (
    <article
      data-testid={`cart-line-${item.id}`}
      aria-label={name}
      aria-busy={pending}
      className={`min-w-0 px-4 py-3 text-card-foreground ${stockNote ? "bg-danger/5" : "bg-card"}`}
    >
      <div className="grid min-w-0 grid-cols-[64px_minmax(0,1fr)] gap-x-3 gap-y-2 sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:items-center">
        <div className="flex size-16 items-center justify-center overflow-hidden rounded-sm bg-muted sm:size-[72px]">
          {imageUrl ? (
            // Catalog media URLs are delivered by the API, as in ProductGallery.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={name}
              width={72}
              height={72}
              loading="lazy"
              className="size-full object-contain"
            />
          ) : (
            <Package
              size={24}
              role="img"
              aria-label="Product image unavailable"
              className="text-muted-foreground"
            />
          )}
        </div>

        <div className="min-w-0">
          <h2 className="text-sm font-medium leading-5 [overflow-wrap:anywhere]">
            {name}
          </h2>
          {variant ? (
            <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
              {variant}
            </p>
          ) : null}
          {stockNote && <p role="alert" className="mt-1 text-xs font-medium text-danger">{stockNote}</p>}
          <p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">
            Unit price:{" "}
            <span className="font-mono tabular-nums text-foreground">
              {unitPrice}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-x-4">
          {onSave && <button type="button" onClick={onSave} aria-pressed={saved} disabled={pending} className="inline-flex min-h-11 min-w-11 items-center sm:min-h-8 sm:min-w-0 gap-1 text-xs text-muted-foreground hover:text-primary disabled:opacity-50"><Heart size={13} fill={saved ? "currentColor" : "none"} aria-hidden="true" />{saved ? "Saved for later" : "Save for Later"}</button>}
          <button
            type="button"
            onClick={onRemove}
            disabled={pending}
            aria-label={`Remove ${name}`}
            className="inline-flex min-h-11 min-w-11 items-center sm:min-h-8 sm:min-w-0 rounded-sm text-xs text-danger hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            Remove
          </button>
          </div>
        </div>

        <div className="col-span-2 flex min-w-0 items-center justify-between gap-4 sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:justify-end">
          <QuantityPicker
            value={item.quantity}
            onChange={onQuantityChange}
            disabled={pending}
            label={name}
            commitOnBlur
            compact
          />
          <p className="min-w-0 text-right text-sm [overflow-wrap:anywhere]">
            <span className="block text-xs text-muted-foreground">Line total</span>
            <span className="font-mono text-sm font-semibold tabular-nums text-primary">
              {lineTotal}
            </span>
          </p>
        </div>
      </div>
    </article>
  );
}

export default CartLine;
