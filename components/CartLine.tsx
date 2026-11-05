"use client";

import { Package } from "lucide-react";
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
};

function CartLine({
  item,
  product,
  pending,
  onQuantityChange,
  onRemove,
}: CartLineProps) {
  const name = product?.name ?? `Item ${item.productId}`;
  const sku = product?.skus.find((candidate) => candidate.id === item.skuId);
  const variant = [sku?.color, sku?.size].filter(Boolean).join(" · ");
  const image = product?.images.find((candidate) => candidate.imageUrl);
  const unitPrice = formatVND(item.unitPrice);
  const lineTotal = formatVND(multiplyCartMoney(item.unitPrice, item.quantity));

  return (
    <article
      data-testid={`cart-line-${item.id}`}
      aria-label={name}
      aria-busy={pending}
      className="min-w-0 rounded-sm border border-border bg-card p-4 text-card-foreground sm:p-6"
    >
      <div className="grid min-w-0 grid-cols-[80px_minmax(0,1fr)] gap-4 sm:grid-cols-[96px_minmax(0,1fr)] xl:grid-cols-[96px_minmax(0,1fr)_auto]">
        <div className="flex size-20 items-center justify-center overflow-hidden rounded-sm bg-muted sm:size-24">
          {image ? (
            // Catalog media URLs are delivered by the API, as in ProductGallery.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.imageUrl}
              alt={name}
              width={96}
              height={96}
              loading="lazy"
              className="size-full object-contain"
            />
          ) : (
            <Package
              size={28}
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
            <p className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">
              {variant}
            </p>
          ) : null}
          <p className="mt-2 text-sm text-muted-foreground [overflow-wrap:anywhere]">
            Unit price:{" "}
            <span className="font-mono tabular-nums text-foreground">
              {unitPrice}
            </span>
          </p>
          <button
            type="button"
            onClick={onRemove}
            disabled={pending}
            aria-label={`Remove ${name}`}
            className="mt-1 inline-flex min-h-11 min-w-11 items-center rounded-sm text-sm text-danger hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            Remove
          </button>
        </div>

        <div className="col-span-2 flex min-w-0 flex-wrap items-center justify-between gap-4 border-t border-border pt-4 sm:col-start-2 sm:col-span-1 xl:col-start-3 xl:row-start-1 xl:flex-nowrap xl:items-start xl:justify-end xl:border-t-0 xl:pt-0">
          <QuantityPicker
            value={item.quantity}
            onChange={onQuantityChange}
            disabled={pending}
            label={name}
            commitOnBlur
          />
          <p className="min-w-0 text-right text-sm [overflow-wrap:anywhere]">
            <span className="block text-muted-foreground">Line total</span>
            <span className="font-mono text-base font-semibold tabular-nums text-primary">
              {lineTotal}
            </span>
          </p>
        </div>
      </div>
    </article>
  );
}

export default CartLine;
