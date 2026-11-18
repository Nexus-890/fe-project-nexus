"use client";

import { useState } from "react";
import { Heart, Star } from "lucide-react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { formatVND, formatVNDRange } from "./formatPrice";
import Link from "next/link";
import ProductImage from "./ProductImage";
import { sortProductImages } from "./productImageUtils";

import type { ProductSummary } from "@/types/catalogResponseType";

export type ProductCardProps = {
  product: Pick<ProductSummary, "id" | "name" | "slug" | "minPrice" | "maxPrice" | "images">;
  /** Optional design preview until seller statistics and campaigns are delivered. */
  sampleDetails?: boolean;
};

export function ProductCard({ product, sampleDetails = false }: ProductCardProps) {
  const watchlist = useWatchlist();
  const [localSaved, setLocalSaved] = useState(false);
  const saved = watchlist ? watchlist.contains(product.id) : localSaved;
  const price =
    product.maxPrice === null
      ? formatVND(product.minPrice)
      : formatVNDRange(product.minPrice, product.maxPrice);
  const firstImage = sortProductImages(product.images)[0];

  return (
    <article
      className="relative flex h-full w-full min-w-0 flex-col overflow-hidden rounded-sm border border-border bg-card text-card-foreground transition-colors hover:border-primary/40"
      aria-label={product.name}
    >
      <Link
        href={`/products/${encodeURIComponent(product.slug)}?id=${encodeURIComponent(product.id)}`}
        className="flex h-full min-w-0 flex-1 flex-col focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
      >
        <div className="h-[232px] shrink-0 overflow-hidden bg-muted">
          <ProductImage
            key={firstImage?.imageUrl ?? "empty"}
            src={firstImage?.imageUrl}
            alt={product.name}
            productName={product.name}
            loading="lazy"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5 px-3 pt-3 pb-[14px]">
          <h3 className="m-0 line-clamp-2 h-10 text-sm font-normal leading-5 [overflow-wrap:anywhere]">
            {product.name}
          </h3>
          {sampleDetails ? <span className="w-fit rounded-sm border border-orange-300 px-1.5 py-0.5 text-[10px] leading-4 text-primary">Free ship</span> : null}
          <p className={`m-0 min-h-12 leading-6 [overflow-wrap:anywhere] ${price === null ? "text-sm text-muted-foreground" : "text-base font-semibold tracking-[-0.02em] text-primary"}`}>
            {price === null ? "Price unavailable" : <>{product.maxPrice === null && <span className="text-xs font-normal tracking-normal">from </span>}{price}</>}
          </p>
          {sampleDetails ? (
            <div className="mt-auto min-h-10 space-y-1 text-[11px] leading-4 text-muted-foreground">
              <p>126 sold</p>
              <p className="flex items-start gap-1 [overflow-wrap:anywhere]"><Star size={13} fill="currentColor" className="mt-0.5 shrink-0 text-warning" aria-hidden="true" /><span>4.8 · Nexus Demo Store</span></p>
            </div>
          ) : null}
        </div>
      </Link>
      {sampleDetails ? <span className="pointer-events-none absolute top-2 left-2 rounded-sm bg-primary px-2 py-1 text-[10px] font-medium leading-4 text-primary-foreground">Sample deal</span> : null}
      <button type="button" aria-label={`${saved ? "Remove" : "Save"} ${product.name} ${saved ? "from" : "to"} watchlist`} aria-pressed={saved} onClick={() => watchlist ? watchlist.toggle(product) : setLocalSaved((current) => !current)} className={`group/heart absolute top-1 right-1 grid min-h-11 min-w-11 place-items-center ${saved ? "text-primary" : "text-muted-foreground"}`}><span className="grid size-8 place-items-center rounded-full bg-card/95 shadow-sm ring-1 ring-border transition-colors group-hover/heart:text-primary"><Heart size={16} fill={saved ? "currentColor" : "none"} aria-hidden="true" /></span></button>
    </article>
  );
}

export default ProductCard;
