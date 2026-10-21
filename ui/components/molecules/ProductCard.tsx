"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { formatVND } from "../../../lib/format-price";
import Link from "next/link";

import type { ProductCardProps } from "@/types/ui/type";
export type { ProductCardProps } from "@/types/ui/type";

export function ProductCard({ product }: ProductCardProps) {
  const price = formatVND(product.minPrice);
  const imageUrl = product.imageUrl?.trim();
  const [failedImage, setFailedImage] = useState<string | null>(null);

  return (
    <article className="w-full min-w-0 overflow-hidden rounded-sm border border-border bg-card text-card-foreground" aria-label={product.name}>
      <Link href={`/products/${encodeURIComponent(product.slug)}?id=${encodeURIComponent(product.id)}`} className="block min-w-0 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring">
      <div className="flex h-[232px] items-center justify-center overflow-hidden bg-muted">
        {imageUrl && failedImage !== imageUrl ? (
          <img src={imageUrl} alt={product.name} loading="lazy" decoding="async"
            onError={() => setFailedImage(imageUrl)} className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground" role="img" aria-label={`${product.name}: image unavailable`}>
            <ImageOff size={28} strokeWidth={1.5} aria-hidden="true" />
            <span>Image unavailable</span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5 px-3 pt-3 pb-[14px]">
        <h3 className="m-0 text-sm font-normal leading-5 [overflow-wrap:anywhere]">
          {product.name}
        </h3>
        {price !== null && (
          <p className="m-0 text-base font-semibold leading-6 tracking-[-0.02em] text-primary [overflow-wrap:anywhere]">
            <span className="text-xs font-normal tracking-normal">from </span>{price}
          </p>
        )}
      </div>
      </Link>
    </article>
  );
}

export default ProductCard;
